"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MfaConfirmRequestSchema = exports.ActivateAccountRequestSchema = exports.ResetPasswordRequestSchema = exports.MfaVerifyRequestSchema = exports.LoginRequestSchema = void 0;
const zod_1 = require("zod");
exports.LoginRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email('Geçersiz e-posta adresi'),
    password: zod_1.z.string().min(6, 'Parola en az 6 karakter olmalıdır'),
    rememberMe: zod_1.z.boolean().optional().default(false),
});
exports.MfaVerifyRequestSchema = zod_1.z.object({
    challengeToken: zod_1.z.string().min(1, 'Challenge token zorunludur'),
    code: zod_1.z.string().length(6, 'TOTP kodu 6 haneli olmalıdır').regex(/^\d+$/, 'TOTP kodu sadece rakamlardan oluşmalıdır'),
    rememberDevice: zod_1.z.boolean().optional().default(false),
});
exports.ResetPasswordRequestSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token zorunludur'),
    password: zod_1.z.string().min(6, 'Yeni parola en az 6 karakter olmalıdır'),
});
exports.ActivateAccountRequestSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token zorunludur'),
    password: zod_1.z.string().min(6, 'Parola en az 6 karakter olmalıdır'),
});
exports.MfaConfirmRequestSchema = zod_1.z.object({
    code: zod_1.z.string().length(6, 'TOTP kodu 6 haneli olmalıdır').regex(/^\d+$/, 'TOTP kodu sadece rakamlardan oluşmalıdır'),
});
//# sourceMappingURL=auth.js.map