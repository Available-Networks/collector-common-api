import * as fs from 'fs/promises';
import * as path from 'path';
import { CloudUploadClientCollection, CloudUploadOpts } from '../cloud';
import { NodeEnv } from '../config/types';
import { LoggerFactory, type Logger } from '../logging';
import { formatDate, isValidData } from './util';

import parquet from "parquetjs-lite";
import { readFile, unlink } from "fs/promises";
import { z } from "zod";
import { Util } from '..';


export interface FileMeta {
    serviceName: string,
    dataSourceName: string,
    timeToday: string
}

/**
 * Exports data to a JSON file
 *
 * @param rootDir - Directory to write file
 * @param data - Data to serialize
 * @param meta - File metadata
 */
export const exportDataToFile = (rootDir: string, data: any, meta: FileMeta): void => {
    const { serviceName, dataSourceName, timeToday } = meta;

    const filename = `${serviceName}-${dataSourceName}-${timeToday}.json`;
    const filePath = path.join(rootDir, filename);
    const serializedData = JSON.stringify(data, null, 2);

    fs.writeFile(filePath, serializedData, "utf-8");
}


/**
 * Exports multiple data sources to either local files or cloud storage.
 *
 * @param uploaders - Cloud uploader collection
 * @param theData - Object mapping data source names to data
 * @param nodeEnv - Node environment ("production" writes to cloud)
 * @param uploadOpts - Options for cloud upload
 */
export const exportData = async (
    uploaders: CloudUploadClientCollection,
    theData: Record<string, any>,
    nodeEnv: NodeEnv,
    uploadOpts: CloudUploadOpts
) => {
    const logger = LoggerFactory.GetLogger();

    const timeToday = formatDate(new Date());
    const longestName = Math.max(...Object.keys(theData).map(n => n.length));
    const isProduction = nodeEnv === "production";

    await Promise.all(
        Object.entries(theData).map(([dataSourceName, data]) => {
            if (!isValidData(data)) {
                logger.warn(`Data source '${dataSourceName}' returned no data`);
                return;
            }

            if (isProduction) {
                const opts: CloudUploadOpts = { ...uploadOpts, dataSourceName };

                const serializedData = opts.extension === "ndjson"
                    ? Util.toNDJSON(data)
                    : JSON.stringify(data, null, 2);
                    
                uploaders.upload(serializedData, opts);
            } else {
                const filename = `${uploadOpts.serviceName}-${dataSourceName}-${timeToday}.json`;
                const filePath = path.join("data", filename);

                logger.info(`Writing data source ${dataSourceName.padEnd(longestName + 1)} to '${filePath}'`);
                
                exportDataToFile("data", data, {
                    dataSourceName: dataSourceName,
                    serviceName: uploadOpts.serviceName,
                    timeToday: timeToday
                });
            }
        })
    );
};

type ParquetFieldType = "UTF8" | "INT64" | "DOUBLE" | "BOOLEAN";

/**
 * Maps a Zod type to its corresponding Parquet field type.
 * Unwraps nullable/optional wrappers to get the inner type.
 * Falls back to UTF8 for complex types (arrays, objects, enums) which are JSON-stringified.
 *
 * @param zodType - The Zod type to map
 * @returns The corresponding Parquet field type
 */
function zodTypeToParquet(zodType: z.ZodTypeAny): ParquetFieldType {
  const typeName = (zodType as any)._def?.typeName ?? zodType.def?.type;

  switch (typeName) {
    case "ZodString": case "string": return "UTF8";
    
    case "ZodNumber": case "number": return "DOUBLE";

    case "ZodBoolean": case "boolean": return "BOOLEAN";

    case "ZodNullable": case "nullable":
      return zodTypeToParquet((zodType as any)._def?.innerType ?? (zodType as any).def?.innerType);
    case "ZodOptional": case "optional":
      return zodTypeToParquet((zodType as any)._def?.innerType ?? (zodType as any).def?.innerType);
      
    default:
      return "UTF8";
  }
}

/**
 * Converts an array of objects to a Parquet-formatted Buffer using a Zod schema
 * to infer column types.
 *
 * - Primitive types (string, number, boolean) are mapped to their Parquet equivalents.
 * - Nullable/optional fields are marked as optional in the Parquet schema.
 * - Complex types (arrays, objects) are JSON-stringified to UTF8.
 * - Null/undefined values are written as null.
 *
 * @param data - Array of objects to convert. Must match the provided Zod schema shape.
 * @param schema - A Zod object schema used to infer Parquet column types.
 *                 Must be a plain `z.object()` — transformed schemas do not expose `.shape`
 *                 and should not be used here.
 * @returns A Buffer containing the Parquet-encoded data, ready for upload or writing to disk.
 *
 * @throws {Error} If the data array is empty.
 *
 * @example
 * const buffer = await convertToParquet(myArray, zApplicationSchemaBase);
 * await fs.writeFile("output.parquet", buffer);
 */
export async function convertToParquet<T extends z.ZodRawShape>(
    data: Record<string, any>[],
    schema: z.ZodObject<T>
): Promise<Buffer> {
    if (!data.length) throw new Error("Cannot convert empty array to parquet");

    const shape = schema.shape;

    const parquetSchema = new parquet.ParquetSchema(
        Object.fromEntries(
            Object.entries(shape).map(([key, zodType]) => {
                const isNullable = zodType instanceof z.ZodNullable || zodType instanceof z.ZodOptional;
                return [key, { type: zodTypeToParquet(zodType as z.ZodTypeAny), optional: isNullable }];
            })
        )
    );

    const tmpFile = `/tmp/parquet-${Date.now()}.parquet`;
    const writer = await parquet.ParquetWriter.openFile(parquetSchema, tmpFile);

    for (const row of data) {
        const serialized = Object.fromEntries(
            Object.entries(row).map(([k, v]) => [
                k,
                typeof v === "object" && v !== null ? JSON.stringify(v) : v ?? null,
            ])
        );
        await writer.appendRow(serialized);
    }

    await writer.close();
    const buffer = await readFile(tmpFile);
    await unlink(tmpFile);
    return buffer;
}

/**
 * Converts an array of objects to Newline Delimited JSON (NDJSON) format.
 *
 * AWS Glue and Athena cannot query top-level JSON arrays — they expect
 * each record to be a separate JSON object on its own line with no array wrapper.
 *
 * @param data - Array of objects to convert
 * @returns A string where each line is a JSON-serialized object
 *
 * @example
 * const body = toNDJSON([{ id: 1 }, { id: 2 }]);
 * // '{"id":1}\n{"id":2}'
 */
export function toNDJSON(data: Record<string, any>[]): string {
    return data.map((record) => JSON.stringify(record)).join("\n");
}