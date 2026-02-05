import { z } from "zod";
import Logger from "./logging/logger";
import { CloudUploadClientCollection, CloudUploadOpts } from "./cloud";
import * as fs from 'fs/promises';
import * as path from "path";
import { NodeEnv } from "./config";
import { AxiosError } from "axios";



export const writeAxiosErrorLog = (error: AxiosError): void => {
    const route: string = error.config.url;
    const errorData: any = error.response?.data;
    const message: string = (errorData.message ?? error.message).trim();
    const moreInfo = error.response.statusText;

    switch (error.status) {
        case 400: Logger.warn(`Endpoint '${route}' -> ${message} | ${moreInfo}`); break;
        case 403: Logger.warn(`Endpoint '${route}' -> ${message} | ${moreInfo}`); break;
        case 500: Logger.error(`Endpoint '${route}' -> ${message} | ${moreInfo}`); break;
        case 501: Logger.warn(`Endpoint '${route}' -> ${message} | ${moreInfo}`); break;
        default: Logger.error(`Endpoint '${route}' threw an uncaught error -> ${message} | ${moreInfo}`); break;
    }
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
        for (const datum of data) {
            if (isValidData(datum)) return true;
        }

        return false;
    } else {
        if (hasKeys(data)) {
            for (const datum of Object.values(data)) {
                if (isValidData(datum)) return true;
            }
        }

        return false;
    }
}

export const formatDate = (d: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, "0")

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
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