import { CloudConfig } from "../config";
import Logger from "../logging";
import { AWS3UploadClient } from "./clients";
import CloudUploadClient, { CloudProvider, CloudUploadOpts } from "./cloudUploadClient";

/**
 * Maps configured cloud providers to their respective client builders.
 *
 * Each builder receives the global cloud configuration and returns a fully
 * initialized upload client.
 */
const ClientBuilders: Record<CloudProvider, (config: CloudConfig) => Promise<CloudUploadClient>> = {
    "aws_s3": (config) => AWS3UploadClient.Create(
        config.AWS_S3_BUCKET_NAME,
        config.AWS_REGION,
        config.AWS_ACCESS_KEY_ID,
        config.AWS_SECRET_ACCESS_KEY
    )
};

/**
 * Collection wrapper managing multiple cloud upload clients.
 *
 * This allows uploads to be dispatched to multiple providers in parallel,
 * enabling redundancy or multi-cloud storage strategies.
 *
 * Typical lifecycle:
 * 1. Construct via {@link FromConfig}
 * 2. Upload data via {@link upload}
 * 3. Cleanup clients via {@link DisconnectClients}
 *
 * @example
 * ```ts
 * const collection = await CloudUploadClientCollection.FromConfig(config);
 *
 * await collection.upload(buffer, opts);
 *
 * collection.DisconnectClients();
 * ```
 */
export default class CloudUploadClientCollection {
    /**
     * Managed upload clients.
     */
    #clients: CloudUploadClient[];

    /**
     * Creates a client collection.
     *
     * @param clients - Optional preconstructed clients
     */
    constructor(clients?: CloudUploadClient[]) { 
        this.#clients = clients ?? [];        
    }

    /**
     * Builds a collection from application configuration.
     *
     * Instantiates one upload client per configured cloud provider.
     *
     * @param CloudConfig - Application cloud configuration
     * @returns Initialized client collection
     */
    static async FromConfig(CloudConfig: CloudConfig): Promise<CloudUploadClientCollection> {
        const providers = await Promise.all(
            CloudConfig.CLOUD_PROVIDERS.map((provider) => ClientBuilders[provider](CloudConfig))
        )

        Logger.debug(`Created ${providers.length} cloud upload providers - ${providers.map(p => p.name)}`);
        return new CloudUploadClientCollection(providers);
    }

    /**
     * Adds a client to the collection.
     */
    push = (client: CloudUploadClient) => this.#clients.push(client);

    /**
     * Removes a client instance from the collection.
     */
    remove = (client: CloudUploadClient) => this.#clients = this.#clients.filter(c => c != client);

    /**
     * Returns all managed clients.
     */
    get clients() { return this.#clients }


    /**
     * Uploads data to all configured cloud providers in parallel.
     *
     * Individual provider failures are logged but do not abort uploads
     * to other providers.
     *
     * @param data - Payload to upload
     * @param opts - Upload options
     */
    async upload(data: Buffer | string, opts: CloudUploadOpts) {
        await Promise.all(
            this.#clients.map(client => 
                client.uploadFile(data, opts)
                    .catch((e: any) => Logger.error(`Failed to upload to ${client.name} - ${e.message}`))
            )
        )
    }

    /**
     * Disconnects all managed clients and releases resources.
     */
    DisconnectClients() {
        this.#clients.forEach(client => {
            client.Disconnect();
            Logger.debug(`Client ${client.name} destroyed`);
        });
    }
}