import { z } from "zod";
import Logger from "./logging/logger";
import { CloudUploadClientCollection, CloudUploadOpts } from "./cloud";
import * as fs from 'fs/promises';
import * as path from "path";
import type { NodeEnv } from "./config/types";
import { AxiosError, AxiosResponse } from "axios";

const commonErrorFields = [ "error", "message", "issue" ]

export const writeAxiosErrorLog = (error: AxiosError): void => {
    const route: string = error.config.url;
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
        Logger.warn(finalMessage);
        return;
    }

    Logger.error(`Endpoint '${route}' -> unexpected error (${error.status}) -> ${errorMessage} | ${moreInfo}`); 
}

export const printErrorAndReturnNull = (e: any) => {
    if (e.isAxiosError) {
        writeAxiosErrorLog(e as AxiosError)
    } else {
        Logger.error("Unexpected error was thrown when trying to get node data: " + e.message);
    }
    return null;
}

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

export const cidrRegex = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\/(?:3[0-2]|[12]?\d)$/;
export const ipRegex = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export const hasKeys = (value: unknown): value is Record<string, unknown> => {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        Object.keys(value).length > 0
    );
}

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


export interface FileMeta {
    serviceName: string,
    dataSourceName: string,
    timeToday: string
}

export const exportDataToFile = (rootDir: string, data: any, meta: FileMeta): void => {
    const { serviceName, dataSourceName, timeToday } = meta;

    const filename = `${serviceName}-${dataSourceName}-${timeToday}.json`;
    const filePath = path.join(rootDir, filename);
    const serializedData = JSON.stringify(data, null, 2);

    Logger.info(`Writing data source ${dataSourceName} to '${filePath}'`);
    fs.writeFile(filePath, serializedData);
}

export const exportData = async (
    uploaders: CloudUploadClientCollection,
    theData: any,
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
                const opts: CloudUploadOpts = {
                    ...uploadOpts,
                    dataSourceName
                }
                uploaders.upload(serializedData, opts);
            } else {
                const filename = `${uploadOpts.serviceName}-${dataSourceName}-${timeToday}.json`;
                const filePath = path.join("data", filename);
                Logger.info(`Writing data source ${dataSourceName.padEnd(longestName + 1)} to '${filePath}'`);
                fs.writeFile(filePath, serializedData);
            }
        })
    )
}
