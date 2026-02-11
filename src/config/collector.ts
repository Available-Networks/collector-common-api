import z from "zod";
import { zBaseConfig } from "./modules/base";
import { zCloudConfig } from "./modules/cloud";
import { zApiConfig } from "./modules/api";

/**
 * Complete configuration schema for a collector service.
 *
 * Combines:
 * - Base service configuration (`zBaseConfig`)
 * - Cloud provider configuration (`zCloudConfig`)
 * - API server configuration (`zApiConfig`)
 *
 * This schema ensures that all necessary fields for running a collector
 * are present and validated according to their respective rules.
 *
 * @example usage:
 * ```ts
 * import { zCollectorConfig } from "./config/collectorConfig";
 *
 * const config = zCollectorConfig.parse(process.env);
 * console.log(config.SERVICE_NAME, config.CLOUD_PROVIDERS);
 * ```
 */
export const zCollectorConfig = zBaseConfig
    .extend(zCloudConfig.shape)
    .extend(zApiConfig.shape);

/**
 * Complete configuration type for a collector service.
 *
 * This schema ensures that all necessary fields for running a collector
 * are present and validated according to their respective rules.
 */
export type CollectorConfig = z.infer<typeof zCollectorConfig>;
