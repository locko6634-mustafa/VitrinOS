"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.generateHmacSignature = generateHmacSignature;
exports.verifyHmacSignature = verifyHmacSignature;
exports.generateSessionToken = generateSessionToken;
exports.hashSessionToken = hashSessionToken;
exports.encryptTotpSecret = encryptTotpSecret;
exports.decryptTotpSecret = decryptTotpSecret;
exports.verifyTotpCode = verifyTotpCode;
exports.generateTotpSecret = generateTotpSecret;
exports.generateTotpUri = generateTotpUri;
exports.generateBackupCodes = generateBackupCodes;
const node_crypto_1 = __importDefault(require("node:crypto"));
const argon2_1 = __importDefault(require("argon2"));
/**
 * Parolayı Argon2id ile hashler.
 * Planlanan minimum parametreler: m=19456 (19MB), t=2, p=1
 */
async function hashPassword(password) {
    return argon2_1.default.hash(password, {
        type: argon2_1.default.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1
    });
}
async function verifyPassword(hash, plain) {
    try {
        return await argon2_1.default.verify(hash, plain);
    }
    catch {
        return false;
    }
}
/**
 * Webhook imzası oluşturma (HMAC SHA-256)
 */
function generateHmacSignature(payload, secret) {
    return node_crypto_1.default.createHmac('sha256', secret).update(payload).digest('hex');
}
/**
 * Webhook imzası doğrulama
 */
function verifyHmacSignature(payload, signature, secret) {
    const expectedSignature = generateHmacSignature(payload, secret);
    if (signature.length !== expectedSignature.length) {
        return false;
    }
    return node_crypto_1.default.timingSafeEqual(Buffer.from(signature, 'utf-8'), Buffer.from(expectedSignature, 'utf-8'));
}
/**
 * 32-byte kriptografik rastgele session token üretir.
 */
function generateSessionToken() {
    return node_crypto_1.default.randomBytes(32).toString('hex');
}
/**
 * Session token'ı SHA-256 ile hashler.
 */
function hashSessionToken(token) {
    return node_crypto_1.default.createHash('sha256').update(token).digest('hex');
}
/**
 * AES-256-GCM için env anahtarını 32-byte'a türetir.
 */
function deriveKey(key) {
    return node_crypto_1.default.createHash('sha256').update(key).digest();
}
/**
 * TOTP sırrını AES-256-GCM ile şifreler.
 */
function encryptTotpSecret(secret, key) {
    const iv = node_crypto_1.default.randomBytes(12);
    const cipher = node_crypto_1.default.createCipheriv('aes-256-gcm', deriveKey(key), iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}
/**
 * Şifreli TOTP sırrını çözer.
 */
function decryptTotpSecret(encryptedData, key) {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
        throw new Error('Geçersiz şifreli veri formatı');
    }
    const [ivHex, encryptedHex, authTagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = node_crypto_1.default.createDecipheriv('aes-256-gcm', deriveKey(key), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
/**
 * Base32 decode işlemi.
 */
function base32Decode(base32) {
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
function generateHotp(secret, counter) {
    const counterBuffer = Buffer.alloc(8);
    let tempCounter = counter;
    for (let i = 7; i >= 0; i--) {
        counterBuffer[i] = tempCounter & 0xff;
        tempCounter = Math.floor(tempCounter / 256);
    }
    const hmac = node_crypto_1.default.createHmac('sha1', secret).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    const otp = code % 1000000;
    return otp.toString().padStart(6, '0');
}
/**
 * TOTP kodu doğrular (varsayılan 30 sn penceresi ve +-1 toleransı ile).
 */
function verifyTotpCode(code, secretBase32, window = 1) {
    try {
        const secret = base32Decode(secretBase32);
        const currentCounter = Math.floor(Date.now() / 1000 / 30);
        for (let i = -window; i <= window; i++) {
            if (generateHotp(secret, currentCounter + i) === code) {
                return true;
            }
        }
        return false;
    }
    catch {
        return false;
    }
}
/**
 * Yeni bir TOTP sırrı (Base32 formatında) üretir.
 */
function generateTotpSecret(length = 20) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes = node_crypto_1.default.randomBytes(length);
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
        result += alphabet[bytes[i] % alphabet.length];
    }
    return result;
}
/**
 * Google Authenticator vb. için TOTP URI üretir.
 */
function generateTotpUri(email, secret, issuer = 'VitrinOS') {
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}
/**
 * Tek kullanımlık yedek kodlar (MFA recovery codes) üretir.
 * 8 adet, 8 haneli alfa-sayısal kod.
 */
function generateBackupCodes(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        codes.push(node_crypto_1.default.randomBytes(4).toString('hex'));
    }
    return codes;
}
//# sourceMappingURL=index.js.map