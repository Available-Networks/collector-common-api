import z from "zod";

import {
    NodeEnv,
    ServiceLocation
} from '../types';

import { LogLevel } from "../../logging";

/**
 * Base configuration schema shared across all services.
 *
 * Includes logging, environment, service identity, and location metadata.
 *
 * Validation rules:
 * - `SERVICE_NAME` is always required.
 * - If `SERVICE_LOCATION` is `"site"`, `SITE_NAME` must be provided.
 *
 * Defaults:
 * - `LOG_LEVEL` defaults to `"debug"`.
 * - `NODE_ENV` defaults to `"development"`.
 * - `SERVICE_LOCATION` defaults to `"global"`.
 */
export const zBaseConfig = z.object({
     /**
     * Logging verbosity level for the service.
     */
    LOG_LEVEL: z.enum(LogLevel).default("debug"),

    /**
     * Current Node environment.
     */
    NODE_ENV: z.enum(NodeEnv).default("development"),

    /**
     * Logical name of the service. Required.
    */
    SERVICE_NAME: z.string().nonempty("SERVICE_NAME is required"),

    /**
     * Service deployment scope.
     * `"global"` or `"site"`.
     */
    SERVICE_LOCATION: z.enum(ServiceLocation).default("global"),

    /**
     * Site identifier when SERVICE_LOCATION is `"site"`.
     */
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

/**
 * Base configuration schema shared across all services.
 *
 * Includes logging, environment, service identity, and location metadata.
 *
 * - If `SERVICE_LOCATION` is `"site"`, `SITE_NAME` must be provided.
 */
export type BaseConfig = z.infer<typeof zBaseConfig>;
