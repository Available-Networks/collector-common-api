import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import z from "zod";

import CloudUploadClient, { CloudUploadOpts } from "../cloudUploadClient";
import { formatDate } from "../../utils";
import {LoggerFactory} from "../../logging/logger";

/**
 * Cached formatted date used when auto-generating filenames.
 * Evaluated once at module load time.
 */
const timeToday = formatDate(new Date());

/**
 * AWS S3 implementation of {@link CloudUploadClient}.
 *
 * This client uploads arbitrary payloads (JSON, text, binary) to an S3 bucket
 * using the AWS SDK v3. It supports both explicit file paths and convention-
 * based path generation derived from {@link CloudUploadOpts}.
 *
 * @example
 * ```ts
 * const client = await AWS3UploadClient.Create(
 *   "my-bucket",
 *   "us-east-1",
 *   process.env.AWS_ACCESS_KEY_ID!,
 *   process.env.AWS_SECRET_ACCESS_KEY!
 * );
 *
 * await client.upload(JSON.stringify(data), {
 *   serviceName: "inventory",
 *   dataSourceName: "proxmox",
 *   serviceLocation: "global"
 * });
 *
 * client.Disconnect();
 * ```
 */
export default class AWS3UploadClient extends CloudUploadClient {
    /**
     * Underlying AWS SDK S3 client.
     * Set to `null` after {@link Disconnect} is called.
     */
    #s3Client: S3Client | null;

    /**
     * Target S3 bucket name.
     */
    #bucketName: string;

    /**
     * Creates a new AWS S3 upload client.
     *
     * This constructor is protected to enforce creation through
     * {@link Create}, keeping client initialization consistent across
     * cloud providers.
     *
     * @param bucketName - Name of the target S3 bucket
     * @param region - AWS region where the bucket is hosted
     * @param accessKeyId - AWS access key ID
     * @param secretAccessKey - AWS secret access key
     */
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

    /**
     * Gracefully shuts down the underlying S3 client.
     *
     * After calling this method, the instance should be considered unusable.
     * Further upload attempts will result in runtime errors.
     */
    Disconnect(): void {
        if (this.#s3Client) {
            this.#s3Client.destroy();
            this.#s3Client = null;
        }
    }

    /**
     * Factory method for creating an {@link AWS3UploadClient}.
     *
     * @param bucketName - Name of the target S3 bucket
     * @param region - AWS region where the bucket is hosted
     * @param accessKeyId - AWS access key ID
     * @param secretAccessKey - AWS secret access key
     * @returns A fully initialized {@link AWS3UploadClient}
     */
    static override async Create(bucketName: string, region: string, accessKeyId: string, secretAccessKey: string): Promise<AWS3UploadClient> {
        return new AWS3UploadClient(bucketName, region, accessKeyId, secretAccessKey);
    }

    /**
     * Uploads data to AWS S3.
     *
     * If `opts.filePath` is provided, it will be used verbatim as the S3 object key.
     * Otherwise, a deterministic path and filename will be generated based on
     * {@link CloudUploadOpts}.
     *
     * Generated filename format:
     * `{{serviceName}}-{{dataSourceName}}-{{YYYY-MM-DD}}.json`
     *
     * Generated path formats:
     * - Global:
     *   `global/{{serviceName}}/{{dataSourceName}}/{{filename}}`
     * - Site-specific:
     *   `{{serviceLocation}}/{{siteName}}/{{serviceName}}/{{dataSourceName}}/{{filename}}`
     *
     * @param data - Payload to upload (Buffer, Blob, or string)
     * @param opts - Upload options and metadata
     *
     * @throws If the underlying S3 client is disconnected
     * @throws If the AWS SDK `PutObjectCommand` fails
     */
    async upload(
        data: Buffer | Blob | string, 
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

        const logger = LoggerFactory.GetLogger();
        logger.info(`Successfully uploaded to S3 🪣  s3://${this.#bucketName}/${filePath}`);
    }

    /**
     * Validates AWS-specific configuration at runtime.
     *
     * Intended to be used during configuration parsing (e.g. environment
     * variable validation) when `CLOUD_CLIENT` is set to `"aws_s3"`.
     *
     * Adds Zod issues for any missing required AWS fields.
     *
     * @param data - Raw configuration object (typically process.env)
     * @param ctx - Zod refinement context
     * @returns `true` if all required fields are present, otherwise `false`
     */
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
                    path: [field],
                    message: `In production, when CLOUD_CLIENT is 'aws_s3', ${field} is required.`
                });
                success = false;
            }
        }

        return success;
    }
}
