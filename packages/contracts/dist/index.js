"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthStatusResponseSchema = void 0;
const zod_1 = require("zod");
exports.HealthStatusResponseSchema = zod_1.z.object({
    status: zod_1.z.string(),
    uptime: zod_1.z.number(),
    timestamp: zod_1.z.string(),
    services: zod_1.z.object({
        database: zod_1.z.string(),
        storage: zod_1.z.string().optional(),
    }).optional(),
});
//# sourceMappingURL=index.js.map