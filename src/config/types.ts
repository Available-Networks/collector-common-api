/**
 * Supported HTTP protocols.
 */
export const HttpProtocol = [ "http", "https" ] as const;
export type HttpProtocol = typeof HttpProtocol[number];

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

/*
* Allowed file extensions to upload
*/
export const FileExtension = ["json","ndjson","csv","raw"] as const;
export type FileExtension = typeof FileExtension[number];
