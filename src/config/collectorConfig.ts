import z from "zod";
import { zBaseConfig } from "./baseConfig";
import { zCloudConfig } from "./cloudConfig";
import { zApiConfig } from "./apiConfig";

export const zCollectorConfig = zBaseConfig
    .extend(zCloudConfig.shape)
    .extend(zApiConfig.shape)
    
export type CollectorConfig = z.infer<typeof zCollectorConfig>;
