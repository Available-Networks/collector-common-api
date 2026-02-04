import z from "zod";
import { zBaseConfig } from "./baseConfig";
import { zCloudConfig } from "./cloudConfig";

export const zCollectorConfig = zBaseConfig.extend(zCloudConfig.shape)
export type CollectorConfig = z.infer<typeof zCollectorConfig>;
