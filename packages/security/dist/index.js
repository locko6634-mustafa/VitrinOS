"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.generateHmacSignature = generateHmacSignature;
exports.verifyHmacSignature = verifyHmacSignature;
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
//# sourceMappingURL=index.js.map