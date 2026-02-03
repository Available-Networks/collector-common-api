import Logger from "../../logging/logger";
import { S3Client, PutObjectCommand, paginateListBuckets, type Bucket, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import CloudUploadClient from "./cloudUploadClient";

export default class AWS3Uploader extends CloudUploadClient {
    private _s3Client: S3Client | null;
    private _bucketName: string;

    public get bucketName(): string {
        return this._bucketName;
    }

    private constructor(s3Client: S3Client, bucketName: string) {
        super();
        
        this._s3Client = s3Client;
        this._bucketName = bucketName;
    }

    public static Connect(region: string, accessKeyId: string, secretAccessKey: string, bucketName: string): AWS3Uploader {
        Logger.debug("Initializing AWS S3 Client");

        const client = new S3Client({
            region: region,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey
            }
        });

        const s3Client = new AWS3Uploader(client, bucketName);
        return s3Client;
    }

    public get isConnected() {
        return this._s3Client !== null;
    }

    public Destroy(): void {
        if (this._s3Client) {
            this._s3Client.destroy();
            this._s3Client = null;
        }
    }

    public async getAllBuckets() {
        const buckets: Bucket[] = [];

        for await (const page of paginateListBuckets({ client: this._s3Client! }, {})) {
            buckets.push(...page.Buckets!);
        }

        Logger.debug(`Buckets: ${buckets.map((bucket) => bucket.Name).join(", ")}`);
        return buckets;
    }

    public override async uploadFile(filePath: string, body: Buffer | Uint8Array | Blob | string): Promise<boolean> {
        const command = new PutObjectCommand({
            Bucket: this._bucketName,
            Key: filePath,
            Body: body
        });

        try {
            Logger.debug(`Uploading data to bucket '${this._bucketName}' at path '${filePath}'`);
            await this._s3Client!.send(command);

            const uploaded = await this.validateFileExistsInBucket(filePath);
            if(uploaded) {
                Logger.debug(`Successfully uploaded object to bucket '${this._bucketName}' at path '${filePath}'`);
                return true;
            } else {
                Logger.error(`Failed to upload object to S3, file does not exist`);
                return false;
            }
        } catch (error) {
            Logger.error(`Failed to upload object to S3: ${error}`);
            return false;
        }
    }

    public async createFolder(folderPath: string) {
        // ensure trailing slash
        const key = folderPath.endsWith("/")
            ? folderPath
            : `${folderPath}/`


        await this._s3Client!.send(
            new PutObjectCommand({
                Bucket: this._bucketName,
                Key: key,
                Body: "", // zero-byte object
            })
        );

        const exists = await this.folderExists(folderPath);
        return exists;
    }

    public async folderExists(prefix: string ): Promise<boolean> {
        const normalized = prefix.endsWith("/") ? prefix : `${prefix}/`

        const res = await this._s3Client!.send(
            new ListObjectsV2Command({
                Bucket: this._bucketName,
                Prefix: normalized,
                MaxKeys: 1, // we only care if *anything* exists
            })
        )

        return (res.KeyCount ?? 0) > 0
    }

    public async deleteObject(fullPath: string): Promise<boolean> {
        await this._s3Client!.send(
            new DeleteObjectCommand({
                Bucket: this._bucketName,
                Key: fullPath,
            })
        );

        const fileStillExists = await this.validateFileExistsInBucket(fullPath);
        return !fileStillExists;
    }

    public async validateFileExistsInBucket(key: string): Promise<boolean> {
        try {
            await this._s3Client!.send(
                new HeadObjectCommand({
                    Bucket: this._bucketName,
                    Key: key,
                })
            );
            return true;
        } catch (err: any) {
            if (err.name === "NotFound") return false;
            throw err; // permission / auth / networking errors
        }
    }
}
