import { users, authSessions, oneTimeTokens, outboxJobs, securityAuditLog, eq } from '@vitrinos/db';
import { generateSessionToken, hashSessionToken } from '@vitrinos/security';
export const adminRoutes = async (fastify) => {
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
                role: true,
                status: true,
                lastSignInAt: true,
                createdAt: true,
            },
            orderBy: (users, { desc }) => [desc(users.createdAt)]
        });
        return reply.send({ data: allUsers });
    });
    // Kullanıcı Durumunu Değiştirme (active/suspended)
    fastify.patch('/api/v1/admin/users/:id/status', async (request, reply) => {
        const { id } = request.params;
        const { status } = request.body;
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
        if (targetUser.id === request.user.id && status === 'suspended') {
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
            actorId: request.user.id,
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
        const { id } = request.params;
        const { role } = request.body;
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
        if (targetUser.id === request.user.id) {
            return reply.code(400).send({ code: 'SELF_ROLE_CHANGE_PREVENTED', message: 'Kendi rolünüzü değiştiremezsiniz' });
        }
        await fastify.db.update(users).set({
            role,
            updatedAt: new Date()
        }).where(eq(users.id, id));
        await fastify.db.insert(securityAuditLog).values({
            actorId: request.user.id,
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
        const { id } = request.params;
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
            actorId: request.user.id,
            action: 'user_sessions_revoked',
            targetType: 'user',
            targetId: id,
            result: 'success'
        });
        return reply.send({ data: { success: true, message: 'Kullanıcının tüm aktif oturumları sonlandırıldı' } });
    });
    // Kullanıcıya Şifre Sıfırlama Bağlantısı Gönderme (Yönetici tetiklemeli)
    fastify.post('/api/v1/admin/users/:id/password-reset', async (request, reply) => {
        const { id } = request.params;
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
            actorId: request.user.id,
            action: 'admin_triggered_password_reset',
            targetType: 'user',
            targetId: id,
            result: 'success'
        });
        return reply.send({ data: { success: true, message: 'Şifre sıfırlama bağlantısı e-posta olarak gönderildi' } });
    });
};
//# sourceMappingURL=admin.js.map