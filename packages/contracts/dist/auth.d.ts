import { z } from 'zod';
export declare const LoginRequestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export declare const MfaVerifyRequestSchema: z.ZodObject<{
    challengeToken: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    challengeToken: string;
}, {
    code: string;
    challengeToken: string;
}>;
export type MfaVerifyRequest = z.infer<typeof MfaVerifyRequestSchema>;
export declare const ResetPasswordRequestSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    token: string;
}, {
    password: string;
    token: string;
}>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
export declare const ActivateAccountRequestSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    token: string;
}, {
    password: string;
    token: string;
}>;
export type ActivateAccountRequest = z.infer<typeof ActivateAccountRequestSchema>;
export declare const MfaConfirmRequestSchema: z.ZodObject<{
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
}, {
    code: string;
}>;
export type MfaConfirmRequest = z.infer<typeof MfaConfirmRequestSchema>;
