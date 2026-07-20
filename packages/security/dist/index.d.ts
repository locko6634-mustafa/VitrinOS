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
/**
 * 32-byte kriptografik rastgele session token üretir.
 */
export declare function generateSessionToken(): string;
/**
 * Session token'ı SHA-256 ile hashler.
 */
export declare function hashSessionToken(token: string): string;
/**
 * TOTP sırrını AES-256-GCM ile şifreler.
 */
export declare function encryptTotpSecret(secret: string, key: string): string;
/**
 * Şifreli TOTP sırrını çözer.
 */
export declare function decryptTotpSecret(encryptedData: string, key: string): string;
/**
 * TOTP kodu doğrular (varsayılan 30 sn penceresi ve +-1 toleransı ile).
 */
export declare function verifyTotpCode(code: string, secretBase32: string, window?: number): boolean;
/**
 * Yeni bir TOTP sırrı (Base32 formatında) üretir.
 */
export declare function generateTotpSecret(length?: number): string;
/**
 * Google Authenticator vb. için TOTP URI üretir.
 */
export declare function generateTotpUri(email: string, secret: string, issuer?: string): string;
/**
 * Tek kullanımlık yedek kodlar (MFA recovery codes) üretir.
 * 8 adet, 8 haneli alfa-sayısal kod.
 */
export declare function generateBackupCodes(count?: number): string[];
