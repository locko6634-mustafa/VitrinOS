import { z } from 'zod';
export declare const HealthStatusResponseSchema: z.ZodObject<{
    status: z.ZodString;
    uptime: z.ZodNumber;
    timestamp: z.ZodString;
    services: z.ZodOptional<z.ZodObject<{
        database: z.ZodString;
        storage: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        database: string;
        storage?: string | undefined;
    }, {
        database: string;
        storage?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: string;
    uptime: number;
    timestamp: string;
    services?: {
        database: string;
        storage?: string | undefined;
    } | undefined;
}, {
    status: string;
    uptime: number;
    timestamp: string;
    services?: {
        database: string;
        storage?: string | undefined;
    } | undefined;
}>;
export type HealthStatusResponse = z.infer<typeof HealthStatusResponseSchema>;
