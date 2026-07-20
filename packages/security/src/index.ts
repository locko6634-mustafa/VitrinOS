import crypto from 'node:crypto';
import argon2 from 'argon2';

/**
 * Parolayı Argon2id ile hashler.
 * Planlanan minimum parametreler: m=19456 (19MB), t=2, p=1
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * Webhook imzası oluşturma (HMAC SHA-256)
 */
export function generateHmacSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Webhook imzası doğrulama
 */
export function verifyHmacSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = generateHmacSignature(payload, secret);
  
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'utf-8'),
    Buffer.from(expectedSignature, 'utf-8')
  );
}

/**
 * 32-byte kriptografik rastgele session token üretir.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Session token'ı SHA-256 ile hashler.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * AES-256-GCM için env anahtarını 32-byte'a türetir.
 */
function deriveKey(key: string): Buffer {
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * TOTP sırrını AES-256-GCM ile şifreler.
 */
export function encryptTotpSecret(secret: string, key: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(key), iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

/**
 * Şifreli TOTP sırrını çözer.
 */
export function decryptTotpSecret(encryptedData: string, key: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Geçersiz şifreli veri formatı');
  }
  const [ivHex, encryptedHex, authTagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(key), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted as any, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Base32 decode işlemi.
 */
function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.toUpperCase().replace(/=+$/, '');
  const length = clean.length;
  let bits = 0;
  let value = 0;
  let index = 0;
  const buffer = Buffer.alloc(Math.floor((length * 5) / 8));

  for (let i = 0; i < length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) {
      throw new Error('Geçersiz base32 karakteri');
    }
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      buffer[index++] = (value >> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return buffer;
}

/**
 * HMAC-SHA1 tabanlı HOTP üretir.
 */
function generateHotp(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  let tempCounter = counter;
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = tempCounter & 0xff;
    tempCounter = Math.floor(tempCounter / 256);
  }
  
  const hmac = crypto.createHmac('sha1', secret).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  
  const otp = code % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * TOTP kodu doğrular (varsayılan 30 sn penceresi ve +-1 toleransı ile).
 */
export function verifyTotpCode(code: string, secretBase32: string, window = 1): boolean {
  try {
    const secret = base32Decode(secretBase32);
    const currentCounter = Math.floor(Date.now() / 1000 / 30);
    for (let i = -window; i <= window; i++) {
      if (generateHotp(secret, currentCounter + i) === code) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Yeni bir TOTP sırrı (Base32 formatında) üretir.
 */
export function generateTotpSecret(length = 20): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

/**
 * Google Authenticator vb. için TOTP URI üretir.
 */
export function generateTotpUri(email: string, secret: string, issuer = 'VitrinOS'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

/**
 * Tek kullanımlık yedek kodlar (MFA recovery codes) üretir.
 * 8 adet, 8 haneli alfa-sayısal kod.
 */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString('hex'));
  }
  return codes;
}

