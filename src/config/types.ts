// Protocols
export const HttpProtocol = [ "http", "https" ] as const;
export type HttpProtocol = typeof HttpProtocol[number];

// Log levels
export const LogLevel = ["error", "warn", "info", "http", "verbose", "debug", "silly"] as const;
export type LogLevel = typeof LogLevel[number];

// Node environments
export const NodeEnv = ["development", "production", "test", "staging"] as const;
export type NodeEnv = typeof NodeEnv[number];

// Service Location
export const ServiceLocation = ["site","global"] as const;
export type ServiceLocation = typeof ServiceLocation[number];

// Cloud clients available
export const CloudProvider = ["aws_s3", "gcp"] as const;
export type CloudProvider = typeof CloudProvider[number];

