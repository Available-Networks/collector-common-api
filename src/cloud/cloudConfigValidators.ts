import z from "zod";

export const validateAWSConfig = (data: any, ctx: z.RefinementCtx) => {
    const requiredAwsFields = [
        "AWS_SECRET_ACCESS_KEY",
        "AWS_ACCESS_KEY_ID",
        "AWS_S3_BUCKET_NAME",
        "AWS_REGION"
    ];

    for(const field of requiredAwsFields) {
        if(!data[field]) {
            ctx.addIssue({
                code: "custom",
                message: `In production, when CLOUD_CLIENT is 'aws_s3', ${field} is required.`
            });
        }
    }
}