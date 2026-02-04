import z from "zod";
import Logger from "../logging";
import { zServiceLocations, zStrictlyParseConfig } from "../zodTypes";

const zCloudUploadClientOpts = z.object({
    filePath: z.string().optional(),
    serviceLocation: zServiceLocations,
    siteName: z.string().optional(),
    serviceName: z.string().optional(),
    dataSourceName: z.string().optional(),
    filename: z.string().optional()
})
.superRefine((data, ctx) => {
    if(data.filePath) {
        if(data.serviceLocation) { Logger.debug("Using filePath argument for uploading; skipping 'serviceLocation'") }
        if(data.siteName) { Logger.debug("Using filePath argument for uploading; skipping 'siteName'") }
        if(data.serviceName) { Logger.debug("Using filePath argument for uploading; skipping 'serviceName'") }
        if(data.dataSourceName) { Logger.debug("Using filePath argument for uploading; skipping 'dataSourceName'") }
        if(data.filename) { Logger.debug("Using filePath argument for uploading; skipping 'filename'") }
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

export type CloudUploadOpts = z.infer<typeof zCloudUploadClientOpts>;

export default abstract class CloudUploadClient {
    #name: string;
    
    protected constructor(name: string) { this.#name = name }
    
    get name() { return this.#name };
    
    async uploadFile(
        body: Buffer | Uint8Array | Blob | string,
        opts: CloudUploadOpts
    ) {
        zStrictlyParseConfig(zCloudUploadClientOpts, opts);
        await this.upload(body, opts);
    }

    static async Create(..._args: any[]): Promise<CloudUploadClient> {
        throw new Error("Create() must be implemented by subclass");
    }

    protected abstract upload(
        body: Buffer | Uint8Array | Blob | string,
        opts: CloudUploadOpts
    );

    static safeValidateUploadOpts = (opts: CloudUploadOpts): boolean => {
        return zCloudUploadClientOpts.safeParse(opts).success;
    }

    static validateConfig = (data: any, ctx: z.RefinementCtx): boolean => {
        throw new Error("Not implemented");
    }
}