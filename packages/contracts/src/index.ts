import { z } from 'zod';

export const HealthStatusResponseSchema = z.object({
  status: z.string(),
  uptime: z.number(),
  timestamp: z.string(),
  services: z.object({
    database: z.string(),
    storage: z.string().optional(),
  }).optional(),
});

export type HealthStatusResponse = z.infer<typeof HealthStatusResponseSchema>;
