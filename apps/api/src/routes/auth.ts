import { FastifyPluginAsync } from 'fastify';
import { 
  users, 
  passwordCredentials, 
  authSessions, 
  mfaFactors, 
  oneTimeTokens, 
  outboxJobs,
  securityAuditLog,
  eq,
  and,
  gt
} from '@vitrinos/db';
import { 
  hashPassword, 
  verifyPassword, 
  generateSessionToken, 
  hashSessionToken,
  generateTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
  generateTotpUri,
  verifyTotpCode,
  generateBackupCodes
} from '@vitrinos/security';
import { 
  LoginRequestSchema, 
  MfaVerifyRequestSchema, 
  ResetPasswordRequestSchema, 
  ActivateAccountRequestSchema,
  MfaConfirmRequestSchema
} from '@vitrinos/contracts';
import { config } from '../config.js';

// FastifyRequest genişletmesi
declare module 'fastify' {
  interface FastifyRequest {
    user: typeof users.$inferSelect | null;
    session: typeof authSessions.$inferSelect | null;
  }
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Session doğrulama hook'u (Tüm isteklerde çalışabilir, isteğe bağlı olarak rotalarda kontrol edilir)
  fastify.addHook('preHandler', async (request) => {
    const sessionToken = request.cookies.session;
    if (!sessionToken) {
      request.user = null;
      request.session = null;
      return;
    }

    const hashedToken = hashSessionToken(sessionToken);
    const dbSession = await fastify.db.query.authSessions.findFirst({
      where: and(
        eq(authSessions.hashedSessionId, hashedToken),
        eq(authSessions.isRevoked, false),
        gt(authSessions.expiresAt, new Date())
      )
    });

    if (!dbSession) {
      request.user = null;
      request.session = null;
      return;
    }

    const dbUser = await fastify.db.query.users.findFirst({
      where: eq(users.id, dbSession.userId)
    });

    if (!dbUser || dbUser.status !== 'active') {
      request.user = null;
      request.session = null;
      return;
    }

    request.user = dbUser;
    request.session = dbSession;
  });

  // Giriş Rotaları
  fastify.post('/auth/login', async (request, reply) => {
    const { email, password } = LoginRequestSchema.parse(request.body);
    const normalizedEmail = email.toLowerCase().trim();

    const userRecord = await fastify.db.query.users.findFirst({
      where: eq(users.email, normalizedEmail)
    });

    if (!userRecord || userRecord.status !== 'active') {
      await fastify.db.insert(securityAuditLog).values({
        action: 'login',
        result: 'failure',
        metadata: { email: normalizedEmail, reason: 'Kullanıcı bulunamadı veya aktif değil' }
      });
      return reply.code(401).send({ code: 'INVALID_CREDENTIALS', message: 'Geçersiz e-posta veya parola' });
    }

    const creds = await fastify.db.query.passwordCredentials.findFirst({
      where: eq(passwordCredentials.userId, userRecord.id)
    });

    if (!creds || !(await verifyPassword(creds.passwordHash, password))) {
      await fastify.db.insert(securityAuditLog).values({
        actorId: userRecord.id,
        action: 'login',
        result: 'failure',
        metadata: { email: normalizedEmail, reason: 'Hatalı parola' }
      });
      return reply.code(401).send({ code: 'INVALID_CREDENTIALS', message: 'Geçersiz e-posta veya parola' });
    }

    // MFA Faktörünü denetle
    const activeMfa = await fastify.db.query.mfaFactors.findFirst({
      where: and(
        eq(mfaFactors.userId, userRecord.id),
        eq(mfaFactors.status, 'verified')
      )
    });

    if (activeMfa) {
      // MFA Aktif, geçici challenge token oluştur
      const challengeToken = generateSessionToken();
      const hashedChallenge = hashSessionToken(challengeToken);
      
      // Geçici session olarak 5 dakika süreli kaydet, isRevoked=true yapalım ki normal API kullanamasın
      await fastify.db.insert(authSessions).values({
        hashedSessionId: hashedChallenge,
        userId: userRecord.id,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 dakika geçerli
        isRevoked: true, // Henüz verified değil
        ipDigest: request.ip,
        userAgentDigest: request.headers['user-agent'] || null
      });

      await fastify.db.insert(securityAuditLog).values({
        actorId: userRecord.id,
        action: 'login_challenge',
        result: 'success',
        metadata: { email: normalizedEmail }
      });

      return reply.send({ data: { mfaRequired: true, challengeToken } });
    }

    // Normal Session Oluştur
    const sessionToken = generateSessionToken();
    const hashedToken = hashSessionToken(sessionToken);

    await fastify.db.insert(authSessions).values({
      hashedSessionId: hashedToken,
      userId: userRecord.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 Gün
      isRevoked: false,
      ipDigest: request.ip,
      userAgentDigest: request.headers['user-agent'] || null
    });

    // Last sign in güncelle
    await fastify.db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, userRecord.id));

    await fastify.db.insert(securityAuditLog).values({
      actorId: userRecord.id,
      action: 'login',
      result: 'success',
      metadata: { email: normalizedEmail }
    });

    reply.setCookie('session', sessionToken, {
      path: '/',
      secure: config.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 // 30 gün
    });

    return reply.send({ data: { user: { id: userRecord.id, email: userRecord.email, role: userRecord.role } } });
  });

  // MFA Doğrulama Rotaları
  fastify.post('/auth/mfa/verify', async (request, reply) => {
    const { challengeToken, code } = MfaVerifyRequestSchema.parse(request.body);
    const hashedChallenge = hashSessionToken(challengeToken);

    const challengeSession = await fastify.db.query.authSessions.findFirst({
      where: and(
        eq(authSessions.hashedSessionId, hashedChallenge),
        eq(authSessions.isRevoked, true), // Geçici challenge oturumları true olarak kaydedilmişti
        gt(authSessions.expiresAt, new Date())
      )
    });

    if (!challengeSession) {
      return reply.code(400).send({ code: 'INVALID_CHALLENGE', message: 'Geçersiz veya süresi dolmuş challenge token' });
    }

    const activeMfa = await fastify.db.query.mfaFactors.findFirst({
      where: and(
        eq(mfaFactors.userId, challengeSession.userId),
        eq(mfaFactors.status, 'verified')
      )
    });

    if (!activeMfa) {
      return reply.code(400).send({ code: 'NO_MFA_SETUP', message: 'Kullanıcının kurulmuş bir MFA faktörü bulunamadı' });
    }

    const decryptedSecret = decryptTotpSecret(activeMfa.secret, config.MFA_ENCRYPTION_KEY);
    const isValid = verifyTotpCode(code, decryptedSecret);

    if (!isValid) {
      await fastify.db.insert(securityAuditLog).values({
        actorId: challengeSession.userId,
        action: 'mfa_verify',
        result: 'failure',
        metadata: { reason: 'Hatalı TOTP kodu' }
      });
      return reply.code(401).send({ code: 'INVALID_MFA_CODE', message: 'Geçersiz TOTP doğrulama kodu' });
    }

    // Challenge session'ı sil veya güncelle
    await fastify.db.delete(authSessions).where(eq(authSessions.id, challengeSession.id));

    // Yeni tam yetkili session oluştur
    const sessionToken = generateSessionToken();
    const hashedToken = hashSessionToken(sessionToken);

    await fastify.db.insert(authSessions).values({
      hashedSessionId: hashedToken,
      userId: challengeSession.userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 Gün
      isRevoked: false,
      ipDigest: request.ip,
      userAgentDigest: request.headers['user-agent'] || null
    });

    // Last sign in güncelle
    await fastify.db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, challengeSession.userId));

    await fastify.db.insert(securityAuditLog).values({
      actorId: challengeSession.userId,
      action: 'login_mfa',
      result: 'success'
    });

    reply.setCookie('session', sessionToken, {
      path: '/',
      secure: config.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60
    });

    const userRecord = await fastify.db.query.users.findFirst({
      where: eq(users.id, challengeSession.userId)
    });

    return reply.send({ data: { user: { id: userRecord!.id, email: userRecord!.email, role: userRecord!.role } } });
  });

  // Çıkış
  fastify.post('/auth/logout', async (request, reply) => {
    if (request.session) {
      await fastify.db.update(authSessions).set({ isRevoked: true }).where(eq(authSessions.id, request.session.id));
      await fastify.db.insert(securityAuditLog).values({
        actorId: request.user?.id,
        action: 'logout',
        result: 'success'
      });
    }
    reply.clearCookie('session', { path: '/' });
    return reply.send({ data: { success: true } });
  });

  // Aktif Oturum
  fastify.get('/auth/session', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Yetkisiz erişim' });
    }
    return reply.send({ 
      data: { 
        user: { 
          id: request.user.id, 
          email: request.user.email, 
          role: request.user.role 
        } 
      } 
    });
  });

  // Şifremi Unuttum
  fastify.post('/auth/password/forgot', async (request, reply) => {
    const { email } = request.body as { email: string };
    const normalizedEmail = email.toLowerCase().trim();

    const userRecord = await fastify.db.query.users.findFirst({
      where: eq(users.email, normalizedEmail)
    });

    // Bilgi sızıntısını önlemek için kullanıcı var olsa da olmasa da 200 döneriz.
    if (userRecord && userRecord.status === 'active') {
      const token = generateSessionToken();
      const hashedToken = hashSessionToken(token);

      await fastify.db.insert(oneTimeTokens).values({
        userId: userRecord.id,
        tokenHash: hashedToken,
        purpose: 'forgot_password',
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 saat geçerli
      });

      // E-posta gönderimini outbox tablosuna yazalım
      await fastify.db.insert(outboxJobs).values({
        type: 'email',
        payload: {
          to: normalizedEmail,
          template: 'forgot_password',
          data: {
            token,
            email: normalizedEmail
          }
        }
      });

      await fastify.db.insert(securityAuditLog).values({
        actorId: userRecord.id,
        action: 'password_reset_request',
        result: 'success'
      });
    }

    return reply.send({ data: { success: true, message: 'Eğer e-posta adresi kayıtlı ise sıfırlama bağlantısı gönderilmiştir.' } });
  });

  // Şifre Sıfırlama
  fastify.post('/auth/password/reset', async (request, reply) => {
    const { token, password } = ResetPasswordRequestSchema.parse(request.body);
    const hashedToken = hashSessionToken(token);

    const tokenRecord = await fastify.db.query.oneTimeTokens.findFirst({
      where: and(
        eq(oneTimeTokens.tokenHash, hashedToken),
        eq(oneTimeTokens.purpose, 'forgot_password'),
        gt(oneTimeTokens.expiresAt, new Date())
      )
    });

    if (!tokenRecord) {
      return reply.code(400).send({ code: 'INVALID_TOKEN', message: 'Geçersiz veya süresi dolmuş sıfırlama tokenı' });
    }

    const hashedNewPassword = await hashPassword(password);

    // Şifreyi güncelle ve tokenı sil (atomik transaction)
    await fastify.db.transaction(async (tx) => {
      await tx.update(passwordCredentials).set({
        passwordHash: hashedNewPassword,
        passwordChangedAt: new Date(),
        securityVersion: 1
      }).where(eq(passwordCredentials.userId, tokenRecord.userId));

      await tx.delete(oneTimeTokens).where(eq(oneTimeTokens.id, tokenRecord.id));
      
      // Kullanıcının tüm aktif session'larını iptal et (güvenlik için)
      await tx.update(authSessions).set({ isRevoked: true }).where(eq(authSessions.userId, tokenRecord.userId));
    });

    await fastify.db.insert(securityAuditLog).values({
      actorId: tokenRecord.userId,
      action: 'password_reset_complete',
      result: 'success'
    });

    return reply.send({ data: { success: true, message: 'Şifreniz başarıyla güncellendi' } });
  });

  // İlk Şifre Aktivasyonu (Taşınmış kullanıcılar için)
  fastify.post('/auth/password/activate', async (request, reply) => {
    const { token, password } = ActivateAccountRequestSchema.parse(request.body);
    const hashedToken = hashSessionToken(token);

    const tokenRecord = await fastify.db.query.oneTimeTokens.findFirst({
      where: and(
        eq(oneTimeTokens.tokenHash, hashedToken),
        eq(oneTimeTokens.purpose, 'activate_account'),
        gt(oneTimeTokens.expiresAt, new Date())
      )
    });

    if (!tokenRecord) {
      return reply.code(400).send({ code: 'INVALID_TOKEN', message: 'Geçersiz veya süresi dolmuş aktivasyon tokenı' });
    }

    const hashedNewPassword = await hashPassword(password);

    await fastify.db.transaction(async (tx) => {
      // passwordCredentials tablosuna ekle veya güncelle
      await tx.insert(passwordCredentials).values({
        userId: tokenRecord.userId,
        passwordHash: hashedNewPassword,
        securityVersion: 1
      }).onConflictDoUpdate({
        target: passwordCredentials.userId,
        set: {
          passwordHash: hashedNewPassword,
          passwordChangedAt: new Date()
        }
      });

      await tx.delete(oneTimeTokens).where(eq(oneTimeTokens.id, tokenRecord.id));
    });

    await fastify.db.insert(securityAuditLog).values({
      actorId: tokenRecord.userId,
      action: 'account_activated',
      result: 'success'
    });

    return reply.send({ data: { success: true, message: 'Hesabınız başarıyla aktive edildi. Giriş yapabilirsiniz.' } });
  });

  // MFA Kurulum / Kaydetme (Giriş Yapmış Kullanıcılar İçin)
  fastify.post('/auth/mfa/enroll', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Yetkisiz erişim' });
    }

    const rawSecret = generateTotpSecret();
    const encryptedSecret = encryptTotpSecret(rawSecret, config.MFA_ENCRYPTION_KEY);
    const qrCodeUri = generateTotpUri(request.user.email, rawSecret);

    // Geçici mfa factor oluştur (unverified)
    // Önce eski unverified olanları silelim ki temizlik olsun
    await fastify.db.delete(mfaFactors).where(
      and(
        eq(mfaFactors.userId, request.user.id),
        eq(mfaFactors.status, 'unverified')
      )
    );

    await fastify.db.insert(mfaFactors).values({
      userId: request.user.id,
      secret: encryptedSecret,
      status: 'unverified'
    });

    return reply.send({ data: { secret: rawSecret, qrCodeUri } });
  });

  // MFA Onaylama
  fastify.post('/auth/mfa/confirm', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Yetkisiz erişim' });
    }

    const { code } = MfaConfirmRequestSchema.parse(request.body);

    const tempFactor = await fastify.db.query.mfaFactors.findFirst({
      where: and(
        eq(mfaFactors.userId, request.user.id),
        eq(mfaFactors.status, 'unverified')
      )
    });

    if (!tempFactor) {
      return reply.code(400).send({ code: 'NO_MFA_ENROLLED', message: 'Kurulmakta olan bir MFA faktörü bulunamadı' });
    }

    const decryptedSecret = decryptTotpSecret(tempFactor.secret, config.MFA_ENCRYPTION_KEY);
    const isValid = verifyTotpCode(code, decryptedSecret);

    if (!isValid) {
      return reply.code(400).send({ code: 'INVALID_MFA_CODE', message: 'Geçersiz TOTP doğrulama kodu' });
    }

    // MFA'yı aktifleştir, eski verified olanları kaldır
    await fastify.db.transaction(async (tx) => {
      await tx.delete(mfaFactors).where(
        and(
          eq(mfaFactors.userId, request.user!.id),
          eq(mfaFactors.status, 'verified')
        )
      );

      await tx.update(mfaFactors).set({
        status: 'verified'
      }).where(eq(mfaFactors.id, tempFactor.id));
    });

    await fastify.db.insert(securityAuditLog).values({
      actorId: request.user.id,
      action: 'mfa_enabled',
      result: 'success'
    });

    return reply.send({ data: { success: true, message: 'MFA başarıyla etkinleştirildi' } });
  });

  // MFA Kapatma / Kaldırma
  fastify.delete('/auth/mfa', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Yetkisiz erişim' });
    }

    await fastify.db.delete(mfaFactors).where(eq(mfaFactors.userId, request.user.id));

    await fastify.db.insert(securityAuditLog).values({
      actorId: request.user.id,
      action: 'mfa_disabled',
      result: 'success'
    });

    return reply.send({ data: { success: true, message: 'MFA başarıyla devre dışı bırakıldı' } });
  });
};
