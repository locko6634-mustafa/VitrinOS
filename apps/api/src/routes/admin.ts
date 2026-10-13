import { FastifyPluginAsync } from 'fastify';
import { 
  users, 
  passwordCredentials,
  authSessions, 
  oneTimeTokens, 
  outboxJobs,
  securityAuditLog,
  leads,
  eq,
  and,
  inArray
} from '@vitrinos/db';
import { 
  generateSessionToken, 
  hashSessionToken,
  hashPassword
} from '@vitrinos/security';

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Admin ve MFA kontrol hook'u
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Yetkisiz erişim' });
    }

    if (request.user.role !== 'admin') {
      return reply.code(403).send({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }

    // AAL2 Güvenliği: Eğer admin'in doğrulanmış bir MFA kaydı varsa, session doğrulanmış olmalıdır.
    // auth.ts içinde MFA doğrulanmayan session'lar isRevoked=true ve kısa süreli (5 dk) olarak challenge modunda kalır.
    // Eğer istek atan session isRevoked=false ise zaten MFA doğrulanmıştır veya MFA aktif değildir.
    if (request.session?.isRevoked) {
      return reply.code(403).send({ code: 'MFA_REQUIRED', message: 'Çok faktörlü doğrulama (MFA) gereklidir' });
    }
  });

  // Kullanıcıları Listeleme
  fastify.get('/api/v1/admin/users', async (request, reply) => {
    const allUsers = await fastify.db.query.users.findMany({
      columns: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        lastSignInAt: true,
        createdAt: true,
      },
      orderBy: (users, { desc }) => [desc(users.createdAt)]
    });

    const userIds = allUsers.map((u) => u.id);
    const activeInviteTokens = userIds.length > 0
      ? await fastify.db.query.oneTimeTokens.findMany({
          where: and(
            inArray(oneTimeTokens.userId, userIds),
            eq(oneTimeTokens.purpose, 'activate_account')
          )
        })
      : [];
    const inviteMap = new Map(activeInviteTokens.map((t) => [t.userId, t]));

    const enrichedUsers = allUsers.map((user) => {
      const invite = inviteMap.get(user.id);
      return {
        ...user,
        hasPendingInvite: !!invite,
        pendingInviteId: invite ? invite.id : null,
        inviteExpired: invite ? new Date(invite.expiresAt) < new Date() : false
      };
    });

    return reply.send({ data: enrichedUsers });
  });

  // Davetleri Listeleme
  fastify.get('/api/v1/admin/invites', async (request, reply) => {
    const pendingTokens = await fastify.db.query.oneTimeTokens.findMany({
      where: eq(oneTimeTokens.purpose, 'activate_account'),
      orderBy: (tokens, { desc }) => [desc(tokens.createdAt)]
    });

    const userIds = [...new Set(pendingTokens.map((t) => t.userId))];
    const inviteUsers = userIds.length > 0
      ? await fastify.db.query.users.findMany({
          where: inArray(users.id, userIds),
          columns: {
            id: true,
            email: true,
            displayName: true,
            status: true,
            createdAt: true
          }
        })
      : [];
    const userMap = new Map(inviteUsers.map((u) => [u.id, u]));
    const now = new Date();

    const invites = pendingTokens.map((token) => {
      const user = userMap.get(token.userId);
      const isExpired = new Date(token.expiresAt) < now;
      return {
        id: token.id,
        userId: token.userId,
        email: user?.email || '',
        displayName: user?.displayName || '',
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
        isExpired,
        status: isExpired ? 'expired' : 'pending'
      };
    });

    return reply.send({ data: invites });
  });

  // Daveti Silme / İptal Etme
  fastify.delete('/api/v1/admin/invites/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    let tokenRecord = await fastify.db.query.oneTimeTokens.findFirst({
      where: and(
        eq(oneTimeTokens.id, id),
        eq(oneTimeTokens.purpose, 'activate_account')
      )
    });

    if (!tokenRecord) {
      tokenRecord = await fastify.db.query.oneTimeTokens.findFirst({
        where: and(
          eq(oneTimeTokens.userId, id),
          eq(oneTimeTokens.purpose, 'activate_account')
        )
      });
    }

    if (!tokenRecord) {
      return reply.code(404).send({ code: 'INVITE_NOT_FOUND', message: 'Davet kaydı bulunamadı' });
    }

    const targetUser = await fastify.db.query.users.findFirst({
      where: eq(users.id, tokenRecord.userId)
    });

    await fastify.db.transaction(async (tx) => {
      await tx.delete(oneTimeTokens).where(eq(oneTimeTokens.id, tokenRecord.id));
      if (targetUser && !targetUser.lastSignInAt) {
        await tx.delete(passwordCredentials).where(eq(passwordCredentials.userId, targetUser.id));
        await tx.delete(authSessions).where(eq(authSessions.userId, targetUser.id));
        await tx.delete(users).where(eq(users.id, targetUser.id));
      }
    });

    await fastify.db.insert(securityAuditLog).values({
      actorId: request.user!.id,
      action: 'invite_deleted',
      targetType: 'invite',
      targetId: tokenRecord.id,
      result: 'success',
      metadata: { email: targetUser?.email, userId: tokenRecord.userId }
    });

    return reply.send({ data: { success: true, message: 'Davet başarıyla silindi' } });
  });

  fastify.post('/api/v1/admin/users', async (request, reply) => {
    const { email, name } = request.body as { email?: string; name?: string };
    const normalizedEmail = email?.trim().toLowerCase();
    const displayName = name?.trim();

    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return reply.code(400).send({ code: 'INVALID_EMAIL', message: 'Geçerli bir e-posta adresi girin' });
    }
    if (!displayName || displayName.length < 2 || displayName.length > 120) {
      return reply.code(400).send({ code: 'INVALID_NAME', message: 'Kullanıcı adı 2-120 karakter arasında olmalıdır' });
    }

    const existingUser = await fastify.db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });
    if (existingUser) {
      return reply.code(409).send({ code: 'EMAIL_IN_USE', message: 'Bu e-posta adresi zaten kayıtlı' });
    }

    const activationToken = generateSessionToken();
    const temporaryPassword = await hashPassword(generateSessionToken());
    const [newUser] = await fastify.db.transaction(async (tx) => {
      const [createdUser] = await tx.insert(users).values({ email: normalizedEmail, displayName, role: 'user', status: 'active' }).returning();
      await tx.insert(passwordCredentials).values({ userId: createdUser.id, passwordHash: temporaryPassword });
      await tx.insert(oneTimeTokens).values({
        userId: createdUser.id,
        tokenHash: hashSessionToken(activationToken),
        purpose: 'activate_account',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      await tx.insert(outboxJobs).values({
        type: 'email',
        payload: { to: normalizedEmail, template: 'activate_account', data: { token: activationToken, email: normalizedEmail } }
      });
      return [createdUser];
    });

    await fastify.db.insert(securityAuditLog).values({
      actorId: request.user!.id,
      action: 'user_invited',
      targetType: 'user',
      targetId: newUser.id,
      result: 'success'
    });

    return reply.code(201).send({ data: { id: newUser.id, email: newUser.email, displayName: newUser.displayName } });
  });

  // Başvurular yalnızca yönetici yüzeyinden okunur ve güncellenir.
  fastify.get('/api/v1/admin/leads', async (request, reply) => {
    const allLeads = await fastify.db.query.leads.findMany({
      columns: {
        id: true,
        name: true,
        company: true,
        email: true,
        need: true,
        status: true,
        createdAt: true,
      },
      orderBy: (leads, { desc }) => [desc(leads.createdAt)]
    });

    return reply.send({ data: allLeads });
  });

  fastify.patch('/api/v1/admin/leads/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status?: string };

    if (!status || !['new', 'reviewed', 'approved', 'rejected'].includes(status)) {
      return reply.code(400).send({ code: 'INVALID_LEAD_STATUS', message: 'Geçersiz başvuru durumu' });
    }

    const [updatedLead] = await fastify.db.update(leads)
      .set({ status, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning({ id: leads.id, status: leads.status });

    if (!updatedLead) {
      return reply.code(404).send({ code: 'LEAD_NOT_FOUND', message: 'Başvuru bulunamadı' });
    }

    await fastify.db.insert(securityAuditLog).values({
      actorId: request.user!.id,
      action: 'lead_status_changed',
      targetType: 'lead',
      targetId: id,
      result: 'success',
      metadata: { status }
    });

    return reply.send({ data: updatedLead });
  });

  // Kullanıcı Durumunu Değiştirme (active/suspended)
  fastify.patch('/api/v1/admin/users/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: 'active' | 'suspended' };

    if (!['active', 'suspended'].includes(status)) {
      return reply.code(400).send({ code: 'INVALID_STATUS', message: 'Geçersiz durum değeri' });
    }

    const targetUser = await fastify.db.query.users.findFirst({
      where: eq(users.id, id)
    });

    if (!targetUser) {
      return reply.code(404).send({ code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı' });
    }

    // Kendini askıya almayı engelle
    if (targetUser.id === request.user!.id && status === 'suspended') {
      return reply.code(400).send({ code: 'SELF_SUSPENSION_PREVENTED', message: 'Kendi hesabınızı askıya alamazsınız' });
    }

    await fastify.db.transaction(async (tx) => {
      await tx.update(users).set({
        status,
        updatedAt: new Date()
      }).where(eq(users.id, id));

      // Eğer kullanıcı askıya alındıysa tüm oturumlarını sonlandır
      if (status === 'suspended') {
        await tx.update(authSessions).set({
          isRevoked: true,
          updatedAt: new Date()
        }).where(eq(authSessions.userId, id));
      }
    });

    await fastify.db.insert(securityAuditLog).values({
      actorId: request.user!.id,
      action: 'user_status_changed',
      targetType: 'user',
      targetId: id,
      result: 'success',
      metadata: { newStatus: status }
    });

    return reply.send({ data: { success: true, message: `Kullanıcı durumu '${status}' olarak güncellendi` } });
  });

  // Kullanıcı Rolünü Değiştirme (admin/user)
  fastify.patch('/api/v1/admin/users/:id/role', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { role } = request.body as { role: 'admin' | 'user' };

    if (!['admin', 'user'].includes(role)) {
      return reply.code(400).send({ code: 'INVALID_ROLE', message: 'Geçersiz rol değeri' });
    }

    const targetUser = await fastify.db.query.users.findFirst({
      where: eq(users.id, id)
    });

    if (!targetUser) {
      return reply.code(404).send({ code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı' });
    }

    // Kendi rolünü değiştirmeyi engelle
    if (targetUser.id === request.user!.id) {
      return reply.code(400).send({ code: 'SELF_ROLE_CHANGE_PREVENTED', message: 'Kendi rolünüzü değiştiremezsiniz' });
    }

    await fastify.db.update(users).set({
      role,
      updatedAt: new Date()
    }).where(eq(users.id, id));

    await fastify.db.insert(securityAuditLog).values({
      actorId: request.user!.id,
      action: 'user_role_changed',
      targetType: 'user',
      targetId: id,
      result: 'success',
      metadata: { newRole: role }
    });

    return reply.send({ data: { success: true, message: `Kullanıcı rolü '${role}' olarak güncellendi` } });
  });

  // Kullanıcı Oturumlarını Geçersiz Kılma
  fastify.post('/api/v1/admin/users/:id/sessions/revoke', async (request, reply) => {
    const { id } = request.params as { id: string };

    const targetUser = await fastify.db.query.users.findFirst({
      where: eq(users.id, id)
    });

    if (!targetUser) {
      return reply.code(404).send({ code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı' });
    }

    await fastify.db.update(authSessions).set({
      isRevoked: true,
      updatedAt: new Date()
    }).where(eq(authSessions.userId, id));

    await fastify.db.insert(securityAuditLog).values({
      actorId: request.user!.id,
      action: 'user_sessions_revoked',
      targetType: 'user',
      targetId: id,
      result: 'success'
    });

    return reply.send({ data: { success: true, message: 'Kullanıcının tüm aktif oturumları sonlandırıldı' } });
  });

  // Kullanıcıya Şifre Sıfırlama Bağlantısı Gönderme (Yönetici tetiklemeli)
  fastify.post('/api/v1/admin/users/:id/password-reset', async (request, reply) => {
    const { id } = request.params as { id: string };

    const targetUser = await fastify.db.query.users.findFirst({
      where: eq(users.id, id)
    });

    if (!targetUser || targetUser.status !== 'active') {
      return reply.code(404).send({ code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı veya aktif değil' });
    }

    const token = generateSessionToken();
    const hashedToken = hashSessionToken(token);

    await fastify.db.insert(oneTimeTokens).values({
      userId: targetUser.id,
      tokenHash: hashedToken,
      purpose: 'forgot_password',
      expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 saat geçerli
    });

    await fastify.db.insert(outboxJobs).values({
      type: 'email',
      payload: {
        to: targetUser.email,
        template: 'forgot_password',
        data: {
          token,
          email: targetUser.email
        }
      }
    });

    await fastify.db.insert(securityAuditLog).values({
      actorId: request.user!.id,
      action: 'admin_triggered_password_reset',
      targetType: 'user',
      targetId: id,
      result: 'success'
    });

    return reply.send({ data: { success: true, message: 'Şifre sıfırlama bağlantısı e-posta olarak gönderildi' } });
  });

  // Kullanıcı Silme
  fastify.delete('/api/v1/admin/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const targetUser = await fastify.db.query.users.findFirst({
      where: eq(users.id, id)
    });

    if (!targetUser) {
      return reply.code(404).send({ code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı' });
    }

    // Kendini silmeyi engelle
    if (targetUser.id === request.user!.id) {
      return reply.code(400).send({ code: 'SELF_DELETION_PREVENTED', message: 'Kendi hesabınızı silemezsiniz' });
    }

    await fastify.db.transaction(async (tx) => {
      await tx.delete(oneTimeTokens).where(eq(oneTimeTokens.userId, id));
      await tx.delete(authSessions).where(eq(authSessions.userId, id));
      await tx.delete(passwordCredentials).where(eq(passwordCredentials.userId, id));
      await tx.delete(users).where(eq(users.id, id));
    });

    await fastify.db.insert(securityAuditLog).values({
      actorId: request.user!.id,
      action: 'user_deleted',
      targetType: 'user',
      targetId: id,
      result: 'success',
      metadata: { email: targetUser.email, displayName: targetUser.displayName }
    });

    return reply.send({ data: { success: true, message: 'Kullanıcı başarıyla silindi' } });
  });
};
