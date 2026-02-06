import z from "zod";
import { zBaseConfig } from "./modules/base";
import { zCloudConfig } from "./modules/cloud";
import { zApiConfig } from "./modules/api";

export const zCollectorConfig = zBaseConfig
    .extend(zCloudConfig.shape)
    .extend(zApiConfig.shape);

export type CollectorConfig = z.infer<typeof zCollectorConfig>;
