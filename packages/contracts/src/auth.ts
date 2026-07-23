import { z } from 'zod';

export const LoginRequestSchema = z.object({
  email: z.string().email('Geçersiz e-posta adresi'),
  password: z.string().min(6, 'Parola en az 6 karakter olmalıdır'),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const MfaVerifyRequestSchema = z.object({
  challengeToken: z.string().min(1, 'Challenge token zorunludur'),
  code: z.string().length(6, 'TOTP kodu 6 haneli olmalıdır').regex(/^\d+$/, 'TOTP kodu sadece rakamlardan oluşmalıdır'),
});

export type MfaVerifyRequest = z.infer<typeof MfaVerifyRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1, 'Token zorunludur'),
  password: z.string().min(6, 'Yeni parola en az 6 karakter olmalıdır'),
});

export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const ActivateAccountRequestSchema = z.object({
  token: z.string().min(1, 'Token zorunludur'),
  password: z.string().min(6, 'Parola en az 6 karakter olmalıdır'),
});

export type ActivateAccountRequest = z.infer<typeof ActivateAccountRequestSchema>;

export const MfaConfirmRequestSchema = z.object({
  code: z.string().length(6, 'TOTP kodu 6 haneli olmalıdır').regex(/^\d+$/, 'TOTP kodu sadece rakamlardan oluşmalıdır'),
});

export type MfaConfirmRequest = z.infer<typeof MfaConfirmRequestSchema>;
