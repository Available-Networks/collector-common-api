export default abstract class CloudUploadClient {
    constructor() {}
    abstract uploadFile(filePath: string, body: Buffer | Uint8Array | Blob | string): Promise<boolean>;
}