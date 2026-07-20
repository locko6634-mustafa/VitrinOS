import { z } from 'zod';
import crypto from 'node:crypto';
import { leads, leadAttempts, outboxJobs, eq, and, gt } from '@vitrinos/db';
const LeadSubmitSchema = z.object({
    name: z.string().min(2, 'İsim en az 2 karakter olmalıdır'),
    email: z.string().email('Geçersiz e-posta adresi'),
    company: z.string().min(2, 'Şirket adı en az 2 karakter olmalıdır'),
    website: z.string().url('Geçersiz web sitesi URL').optional().or(z.literal('')),
    need: z.string().optional(),
    note: z.string().optional(),
    // Honeypot ve güvenlik alanları (Frontend form sözleşmesine uygun)
    companyFax: z.string().optional(), // Honeypot alanı (boş olmalı)
    leadStartedAt: z.coerce.number().optional(), // Form başlangıç zaman damgası
});
export const leadsRoutes = async (fastify) => {
    // POST /api/v1/leads (Public uç, giriş gerektirmez)
    fastify.post('/api/v1/leads', async (request, reply) => {
        const ipAddress = request.ip;
        const body = LeadSubmitSchema.parse(request.body);
        const normalizedEmail = body.email.toLowerCase().trim();
        // 1. Honeypot kontrolü (companyFax doluysa bot demektir)
        const isHoneypotTriggered = !!body.companyFax;
        // 2. Çok hızlı doldurma koruması (örneğin 2 saniyeden kısa sürede gönderildiyse bot olabilir)
        const now = Date.now();
        const isTooFast = body.leadStartedAt ? (now - body.leadStartedAt < 2000) : false;
        // Email + IP hash'i üret (leadAttempts takibi için)
        const attemptHash = crypto.createHash('sha256').update(`${normalizedEmail}:${ipAddress}`).digest('hex');
        // 3. Rate Limit Kontrolü (Aynı IP'den son 1 saatte en fazla 5 deneme yapılabilir)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentAttempts = await fastify.db.query.leadAttempts.findMany({
            where: and(eq(leadAttempts.ipAddress, ipAddress), gt(leadAttempts.createdAt, oneHourAgo))
        });
        if (recentAttempts.length >= 5) {
            // Limit aşıldı, engelle
            await fastify.db.insert(leadAttempts).values({
                email: normalizedEmail,
                ipAddress,
                attemptHash,
                status: 'blocked',
                lastError: 'IP rate limit exceeded',
            });
            return reply.code(429).send({
                code: 'TOO_MANY_REQUESTS',
                message: 'Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyiniz.'
            });
        }
        if (isHoneypotTriggered || isTooFast) {
            // Honeypot veya hız koruması tetiklendiğinde spam botu kandırmak için 200 OK döneriz,
            // ancak veritabanına blocked olarak kaydederiz ve lead eklemeyiz.
            await fastify.db.insert(leadAttempts).values({
                email: normalizedEmail,
                ipAddress,
                attemptHash,
                status: 'blocked',
                lastError: isHoneypotTriggered ? 'Honeypot triggered' : 'Submission too fast',
            });
            return reply.send({ success: true, message: 'Talebiniz başarıyla alındı.' });
        }
        // 4. Duplicate (Tekrarlayan e-posta) kontrolü (Son 24 saat içinde aynı e-posta)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const existingLead = await fastify.db.query.leads.findFirst({
            where: and(eq(leads.email, normalizedEmail), gt(leads.createdAt, oneDayAgo))
        });
        if (existingLead) {
            await fastify.db.insert(leadAttempts).values({
                email: normalizedEmail,
                ipAddress,
                attemptHash,
                status: 'blocked',
                lastError: 'Duplicate email within 24h',
            });
            // duplicate durumunda da 200 dönebiliriz ya da bilgilendirici mesaj veririz.
            return reply.send({ success: true, message: 'Talebiniz zaten alındı.' });
        }
        // Başarılı deneme: lead kaydı oluştur ve outbox işi ekle (örneğin hoş geldin e-postası için)
        await fastify.db.transaction(async (tx) => {
            const [newLead] = await tx.insert(leads).values({
                name: body.name,
                company: body.company,
                email: normalizedEmail,
                website: body.website || null,
                need: body.need || null,
                note: body.note || null,
                status: 'new',
            }).returning();
            await tx.insert(leadAttempts).values({
                email: normalizedEmail,
                ipAddress,
                attemptHash,
                status: 'allowed',
            });
            // Outbox task'i ekle (Transactional SMTP e-postası göndermek için worker işleyecek)
            await tx.insert(outboxJobs).values({
                type: 'send_lead_notification',
                payload: {
                    leadId: newLead.id,
                    email: normalizedEmail,
                    name: body.name,
                },
                status: 'queued',
            });
        });
        return reply.send({ success: true, message: 'Talebiniz başarıyla alındı. Teşekkür ederiz!' });
    });
};
//# sourceMappingURL=leads.js.map