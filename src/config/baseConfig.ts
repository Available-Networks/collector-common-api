import z from "zod";

// Log levels
const LogLevels = ["error", "warn", "info", "http", "verbose", "debug", "silly"] as const;
export const zLogLevel = z.enum(LogLevels);

// Node environments
const NodeEnvs = ["development", "production", "test", "staging"] as const;
export const zNodeEnv = z.enum(NodeEnvs);

const ServiceLocations = ["site","global"] as const;
export const zServiceLocations = z.enum(ServiceLocations);

export const zBaseConfig = z.object({
  LOG_LEVEL: zLogLevel.default("debug"),
  NODE_ENV: zNodeEnv.default("development"),
  SERVICE_NAME: z.string().nonempty("SERVICE_NAME is required"),
  SERVICE_LOCATION: zServiceLocations.default("site"),
  SITE_NAME: z.string().optional(),
});
export type BaseConfig = z.infer<typeof zBaseConfig>;
