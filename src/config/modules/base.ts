import z from "zod";

import {
    LogLevel,
    NodeEnv,
    ServiceLocation
} from '../types';


export const zBaseConfig = z.object({
  LOG_LEVEL: z.enum(LogLevel).default("debug"),
  NODE_ENV: z.enum(NodeEnv).default("development"),
  SERVICE_NAME: z.string().nonempty("SERVICE_NAME is required"),
  SERVICE_LOCATION: z.enum(ServiceLocation).default("site"),
  SITE_NAME: z.string().optional()
})
.superRefine((cfg, ctx) => {
    if (
        cfg.SERVICE_LOCATION === "site" &&
        !cfg.SITE_NAME
    ) {
        ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SITE_NAME"],
        message: "SITE_NAME required when SERVICE_LOCATION=site",
        });
    }
});
    
export type BaseConfig = z.infer<typeof zBaseConfig>;
