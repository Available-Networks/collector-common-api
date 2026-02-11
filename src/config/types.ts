/**
 * Supported HTTP protocols.
 */
export const HttpProtocol = [ "http", "https" ] as const;
export type HttpProtocol = typeof HttpProtocol[number];

/**
 * Valid log levels used by the service logger.
 */
export const LogLevel = ["error", "warn", "info", "http", "verbose", "debug", "silly"] as const;
export type LogLevel = typeof LogLevel[number];

/**
 * Supported Node.js environments for the service.
 */
export const NodeEnv = ["development", "production", "test", "staging"] as const;
export type NodeEnv = typeof NodeEnv[number];

/**
 * Logical location/scope of a service.
 *
 * - `"global"`: service is deployed globally
 * - `"site"`: service is deployed to a specific site
 */
export const ServiceLocation = ["site","global"] as const;
export type ServiceLocation = typeof ServiceLocation[number];

/**
 * Available cloud provider clients.
 *
 * Extend this array as new cloud backends are supported.
 */
export const CloudProvider = ["aws_s3" ] as const;
export type CloudProvider = typeof CloudProvider[number];

