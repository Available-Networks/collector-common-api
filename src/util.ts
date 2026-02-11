import { z } from "zod";
import Logger from "./logging/logger";
import { CloudUploadClientCollection, CloudUploadOpts } from "./cloud";
import * as fs from 'fs/promises';
import * as path from "path";
import type { LogLevel, NodeEnv } from "./config/types";
import { AxiosError, AxiosResponse } from "axios";

// -----------------------------------------------------------------------------
// Axios / HTTP Error Utilities
// -----------------------------------------------------------------------------
/**
 * Common fields in an API error response to look for
 */
const commonErrorFields = [ "error", "message", "issue" ]

/**
 * Logs a formatted AxiosError to the Logger
 *
 * @param error - AxiosError thrown from a failed HTTP request
 */
export const writeAxiosErrorLog = (error: AxiosError): [LogLevel, string] => {
    const route: string = error.config?.url;
    const response: AxiosResponse | undefined = error.response;

    const errorData: any = response?.data;
    
    // find the error messages kinda
    let errorMessage = "";
    if(errorData) {
        if(errorData instanceof Object) {
            const errorDataObject = errorData as Object;
    
            const errorMessages = commonErrorFields
                .filter(field => Object.keys(errorDataObject).includes(field));
    
            errorMessage = (errorMessages.length < 1) 
                ? JSON.stringify(errorDataObject, null, 2)
                : errorMessages.join(",");
        } else {
            errorMessage = errorData.toString();
        }
    } else {
        errorMessage = error.message;
    }
    
    const moreInfo = response?.statusText;

    let finalMessage = `Endpoint '${route}' (${error.status}) -> ${errorMessage}`;
    if(moreInfo !== undefined) { finalMessage += ` | ${moreInfo}`; }

    if(error.status === 400 || error.status === 403 || error.status === 501 || error.status === 500) {
        return ["warn", finalMessage]
    }

    finalMessage = `Endpoint '${route}' -> unexpected error (${error.status}) -> ${errorMessage} | ${moreInfo}`
    return [ "error", finalMessage ]
}

/**
 * Logs an error (Axios or generic) and returns null
 *
 * @param e - Error object
 * @returns null always
 */
export const printErrorAndReturnNull = (e: any) => {
    const [ logLevel, message ] = writeAxiosErrorLog(e as AxiosError)
    Logger.logWithLevel(message, logLevel);
    return null;
}

// -----------------------------------------------------------------------------
// Zod Parsing Utility
// -----------------------------------------------------------------------------
/**
 * Parses unknown data using a Zod schema and throws on invalid input
 *
 * @param schema - Zod schema to validate against
 * @param data - Input data
 * @returns Validated and parsed data
 * @throws Error if data does not conform to schema
 */
export function zParseUsing<T>(
    schema: z.ZodType<T>,
    data: unknown
): T {
    const result = schema.safeParse(data);

    if (!result.success) {
        Logger.error(JSON.stringify(result.error.format(), null, 2));
        throw new Error("Invalid JSON input");
    }

    return result.data;
}

// -----------------------------------------------------------------------------
// Regex Utilities
// -----------------------------------------------------------------------------
/** CIDR notation regex (e.g., "192.168.0.0/24") */
export const cidrRegex = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\/(?:3[0-2]|[12]?\d)$/;

/** IPv4 address regex (e.g., "192.168.0.1") */
export const ipRegex = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

// -----------------------------------------------------------------------------
// Data Validation Utilities
// -----------------------------------------------------------------------------
/**
 * Checks whether a value is a non-empty object
 *
 * @param value - Value to check
 * @returns true if the value is a non-null object with at least one key
 */
export const hasKeys = (value: unknown): value is Record<string, unknown> => {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        Object.keys(value).length > 0
    );
}

/**
 * Checks whether a data object or primitive contains valid data
 *
 * @param data - Data to check
 * @returns true if data is non-empty / non-null
 */
export const isValidData = (data: unknown): boolean => {
    if (data === undefined || data === null) {
        return false;
    }

    switch (typeof data) {
        case "string": return data.trim().length > 0;
        case "number": return Number.isFinite(data);
        case "object": break;
        default: return true;
    }

    if (Array.isArray(data)) {
        return data.some(datum => isValidData(datum));
    } else {
        return hasKeys(data) && Object.values(data).some(datum => isValidData(datum));
    }
}

// -----------------------------------------------------------------------------
// Date Utilities
// -----------------------------------------------------------------------------
/**
 * Formats a Date object into a string like "YYYY-MM-DD_DD_HH:MM:SS"
 *
 * @param d - Date object
 * @returns Formatted date string
 */
export const formatDate = (d: Date): string => {
    const pad = (n: number, prefix: string = "0") => n.toString().padStart(2, prefix);

    const fullYear = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const fullDate = pad(d.getDate()) + "_";
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());

    return `${fullYear}-${month}-${fullDate}_${hours}:${minutes}:${seconds}`
}

// -----------------------------------------------------------------------------
// File Export Utilities
// -----------------------------------------------------------------------------
/** Metadata for file exports */
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

    Logger.info(`Writing data source ${dataSourceName} to '${filePath}'`);
    fs.writeFile(filePath, serializedData);
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
    const timeToday = formatDate(new Date());
    const longestName = Math.max(...Object.keys(theData).map(n => n.length));
    const isProduction = nodeEnv === "production";

    await Promise.all(
        Object.entries(theData).map(([dataSourceName, data]) => {
            if (!isValidData(data)) {
                Logger.warn(`Data source '${dataSourceName}' returned no data`);
                return null;
            }

            const serializedData = JSON.stringify(data, null, 2);
            if (isProduction) {
                const opts: CloudUploadOpts = { ...uploadOpts, dataSourceName };
                uploaders.upload(serializedData, opts);
            } else {
                const filename = `${uploadOpts.serviceName}-${dataSourceName}-${timeToday}.json`;
                const filePath = path.join("data", filename);
                Logger.info(`Writing data source ${dataSourceName.padEnd(longestName + 1)} to '${filePath}'`);
                fs.writeFile(filePath, serializedData);
            }
        })
    );
};