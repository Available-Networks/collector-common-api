import z from "zod";

const LogLevels = [
  "error",
  "warn",
  "info",
  "http",
  "verbose",
  "debug",
  "silly",
] as const;

const NodeEnvs = [
  "development",
  "production",
  "test",
  "staging",
] as const;

const ServiceLocations = [
  "site", 
  "global"
] as const;

export const zLogLevels = z.enum(LogLevels).default("info");
export type LogLevel = z.infer<typeof zLogLevels>;

export const zNodeEnvs = z.enum(NodeEnvs).default("development");
export type NodeEnv = z.infer<typeof zNodeEnvs>;

export const zServiceLocations = z.enum(ServiceLocations).default("global");
export type ServiceLocation = z.infer<typeof zServiceLocations>;