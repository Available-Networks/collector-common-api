import z from "zod";
import { ServiceLocation } from "../config/types";

import { LoggerFactory } from "../logging/logger";

/**
 * Available cloud provider clients.
 *
 * Extend this array as new cloud backends are supported.
 */
export const CloudProvider = ["aws_s3" ] as const;
export type CloudProvider = typeof CloudProvider[number];

/**
 * Options used when uploading data via a {@link CloudUploadClient}.
 *
 * These options either:
 * 1. Provide an explicit `filePath`, or
 * 2. Provide enough metadata to construct a deterministic path.
 */
export type CloudUploadOpts = z.infer<typeof zCloudUploadClientOpts>;

/**
 * Base abstraction for cloud upload clients.
 *
 * Concrete implementations (AWS S3, GCP, etc.) must extend this class
 * and implement transport-specific logic for uploading data.
 *
 * Subclasses are responsible for:
 * - Upload implementation
 * - Connection lifecycle
 * - Configuration validation
 *
 * @example
 * ```ts
 * const client = await AWS3UploadClient.Create(...);
 *
 * await client.uploadFile(buffer, opts);
 *
 * client.Disconnect();
 * ```
 */
export default abstract class CloudUploadClient {
    /**
     * Human-readable client name.
     */
    #name: string;

    /**
     * Creates a cloud upload client.
     *
     * Protected to enforce creation via subclass factory methods.
     *
     * @param name - Display name of the upload provider
     */
    protected constructor(name: string) { this.#name = name; }
    
    /**
     * Returns the provider name.
     */
    get name() { return this.#name };
    
    /**
     * Public wrapper for uploading data.
     *
     * Delegates to subclass implementation while providing a stable public
     * interface across implementations.
     *
     * @param body - Data payload to upload
     * @param opts - Upload configuration options
     */
    async uploadFile(
        body: Buffer | Uint8Array | Blob | string,
        opts: CloudUploadOpts
    ) {
        await this.upload(body, opts);
    }

    /**
     * Disconnects and releases any client resources.
     *
     * After calling this method, the client instance should not be reused.
     */
    abstract Disconnect();

    /**
     * Factory method for creating a concrete upload client.
     *
     * Must be implemented by subclasses.
     *
     * @throws Always throws unless overridden by subclass.
     */
    static async Create(..._args: any[]): Promise<CloudUploadClient> {
        throw new Error("Create() must be implemented by subclass");
    }

    /**
     * Provider-specific upload implementation.
     *
     * Subclasses must implement the actual transport logic.
     *
     * @param body - Data payload to upload
     * @param opts - Upload configuration options
     */
    protected abstract upload(
        body: Buffer | Uint8Array | Blob | string,
        opts: CloudUploadOpts
    );

    /**
     * Safely validates upload options.
     *
     * Does not throw; returns validation success status instead.
     *
     * @param opts - Upload options to validate
     * @returns `true` if options are valid
     */
    static safeValidateUploadOpts = (opts: CloudUploadOpts): boolean => {
        return zCloudUploadClientOpts.safeParse(opts).success;
    }

    /**
     * Validates provider configuration.
     *
     * Intended to be overridden by subclasses to validate environment or
     * configuration inputs.
     *
     * @param data - Raw configuration data
     * @param ctx - Zod refinement context
     * @throws Always throws unless overridden
     */
    static validateConfig = (data: any, ctx: z.RefinementCtx): boolean => {
        throw new Error("Not implemented");
    }
}

/**
 * Zod schema describing valid upload options.
 *
 * Behavior:
 * - If `filePath` is provided, it overrides all other path parameters.
 * - Otherwise, sufficient metadata must be provided to construct a path.
 */
const zCloudUploadClientOpts = z.object({
    filePath: z.string().optional(),
    serviceLocation: z.enum(ServiceLocation),
    siteName: z.string().optional(),
    serviceName: z.string().optional(),
    dataSourceName: z.string().optional(),
    filename: z.string().optional()
})
.superRefine((data, ctx) => {
    const logger = LoggerFactory.GetLogger();

    // If filePath is provided, skip metadata validation
    if(data.filePath) {
        if(data.serviceLocation) { logger.debug("Using filePath argument for uploading; skipping 'serviceLocation'") }
        if(data.siteName) { logger.debug("Using filePath argument for uploading; skipping 'siteName'") }
        if(data.serviceName) { logger.debug("Using filePath argument for uploading; skipping 'serviceName'") }
        if(data.dataSourceName) { logger.debug("Using filePath argument for uploading; skipping 'dataSourceName'") }
        if(data.filename) { logger.debug("Using filePath argument for uploading; skipping 'filename'") }
        return;
    }

    let messages = [];
    if(!data.serviceName) { messages.push("serviceName must be specified if not using absolute file pathing"); }
    if(!data.dataSourceName) { messages.push("dataSourceName must be specified if not using absolute file pathing"); }
    
    if(!data.serviceLocation) { 
        messages.push("serviceLocation must be specified if not using absolute file pathing"); 
    } else if(data.serviceLocation === "site" && !data.siteName) { 
        messages.push("siteName must be specified if not using absolute file pathing"); 
    }

    messages.forEach((message: string) => ctx.addIssue({
        code: "custom",
        message: message
    }))
})
