import Logger from "../logging";
import CloudUploadClient, { CloudUploadOpts } from "./cloudUploadClient";

export default class CloudUploadClientCollection {
    #clients: CloudUploadClient[];

    constructor(clients?: CloudUploadClient[]) {
        this.#clients = clients ?? [];
    }

    push = (client: CloudUploadClient) => this.#clients.push(client);
    remove = (client: CloudUploadClient) => this.#clients = this.#clients.filter(c => c != client);

    get clients() { return this.#clients }

    async upload(data: Buffer | string, opts: CloudUploadOpts) {
        await Promise.all(
            this.#clients.map(client => {
                client.uploadFile(data, opts).catch((e: any) => Logger.error(`Failed to upload to ${client.name} - ${e.message}`))
            })
        )
    }
}