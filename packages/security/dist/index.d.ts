/**
 * Parolayı Argon2id ile hashler.
 * Planlanan minimum parametreler: m=19456 (19MB), t=2, p=1
 */
export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(hash: string, plain: string): Promise<boolean>;
/**
 * Webhook imzası oluşturma (HMAC SHA-256)
 */
export declare function generateHmacSignature(payload: string, secret: string): string;
/**
 * Webhook imzası doğrulama
 */
export declare function verifyHmacSignature(payload: string, signature: string, secret: string): boolean;
