export * from './auth.js';
import { z } from 'zod';
export declare const HealthStatusResponseSchema: any;
export type HealthStatusResponse = z.infer<typeof HealthStatusResponseSchema>;
