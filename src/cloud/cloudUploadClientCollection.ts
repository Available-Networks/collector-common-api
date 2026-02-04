import { CloudConfig, CloudProvider } from "../config/cloudConfig";
import Logger from "../logging";
import AWS3UploadClient from "./clients/aws3UploadClient";
import CloudUploadClient, { CloudUploadOpts } from "./cloudUploadClient";

const ClientBuilders: Record<CloudProvider, (config: CloudConfig) => Promise<CloudUploadClient>> = {
    "aws_s3": (config) => AWS3UploadClient.Create(
        config.AWS_S3_BUCKET_NAME,
        config.AWS_REGION,
        config.AWS_ACCESS_KEY_ID,
        config.AWS_SECRET_ACCESS_KEY
    ),
    "gcp": () => { throw new Error("not implemented") }
};

export default class CloudUploadClientCollection {
    #clients: CloudUploadClient[];

    constructor(clients?: CloudUploadClient[]) { 
        this.#clients = clients ?? [];        
    }

    static async FromConfig(CloudConfig: CloudConfig): Promise<CloudUploadClientCollection> {
        const providers = await Promise.all(
            CloudConfig.CLOUD_PROVIDERS.map((provider) => ClientBuilders[provider](CloudConfig))
        )

        Logger.info("Created " + providers.length + " providers")
        return new CloudUploadClientCollection(providers);
    }

    push = (client: CloudUploadClient) => this.#clients.push(client);
    remove = (client: CloudUploadClient) => this.#clients = this.#clients.filter(c => c != client);

    get clients() { return this.#clients }

    async upload(data: Buffer | string, opts: CloudUploadOpts) {
        await Promise.all(
            this.#clients.map(client => {
                client
                    .uploadFile(data, opts)
                    .catch((e: any) => Logger.error(`Failed to upload to ${client.name} - ${e.message}`))
            })
        )
    }

    DisconnectClients() {
        this.#clients.forEach(client => {
            client.Disconnect();
            Logger.debug(`Client ${client.name} destroyed`);
        });
    }
}