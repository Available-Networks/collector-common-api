import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import CloudUploadClient, { CloudUploadOpts } from "./cloudUploadClient";
import { formatDate } from "../util";
import z from "zod";
import Logger from "../logging";

const timeToday = formatDate(new Date());

export default class AWS3UploadClient extends CloudUploadClient {
    #s3Client: S3Client | null;
    #bucketName: string;

    protected constructor(bucketName: string, region: string, accessKeyId: string, secretAccessKey: string) {
        super("AWS S3");
        
        this.#bucketName = bucketName;
        this.#s3Client = new S3Client({
            region: region,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey
            }
        });
    }

    Destroy(): void {
        if (this.#s3Client) {
            this.#s3Client.destroy();
            this.#s3Client = null;
        }
    }

    static override async Create(bucketName: string, region: string, accessKeyId: string, secretAccessKey: string): Promise<AWS3UploadClient> {
        return new AWS3UploadClient(bucketName, region, accessKeyId, secretAccessKey);
    }

    async upload(
        data: Buffer | Uint8Array | Blob | string, 
        opts: CloudUploadOpts
    ) {
        let { filePath, filename } = opts;

        if(!filePath) {
            const {
                serviceName,
                dataSourceName, 
                serviceLocation,
                siteName
            } = opts;

            filename = filename ?? `${serviceName}-${dataSourceName}-${timeToday}.json`;
            filePath = serviceLocation === "global"
                ? `${serviceLocation}/${serviceName}/${dataSourceName}/${filename}`
                : `${serviceLocation}/${siteName}/${serviceName}/${dataSourceName}/${filename}`;
        }

        const command = new PutObjectCommand({
            Bucket: this.#bucketName,
            Key: filePath,
            Body: data
        });

        await this.#s3Client!.send(command);
        Logger.info(`Successfully uploaded to S3 🪣  s3://${this.#bucketName}/${filePath}`);
    }

    static override validateConfig = (data: any, ctx: z.RefinementCtx): boolean => {
        const requiredAwsFields = [
            "AWS_SECRET_ACCESS_KEY",
            "AWS_ACCESS_KEY_ID",
            "AWS_S3_BUCKET_NAME",
            "AWS_REGION"
        ];
    
        let success = true;

        for(const field of requiredAwsFields) {
            if(!data[field]) {
                ctx.addIssue({
                    code: "custom",
                    message: `In production, when CLOUD_CLIENT is 'aws_s3', ${field} is required.`
                });
                success = false;
            }
        }

        return success;
    }
}
