import { z } from "zod";
import Logger from "./logging/logger";
import AWS3Uploader from "./cloud/uploaders/aws3Uploader";

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
    if(data === undefined || data === null) {
        return false;
    }

    switch(typeof data) {
        case "string": return data.trim().length > 0;
        case "number": return Number.isFinite(data);
        case "object": break;
        default: return true;
    }

    if(Array.isArray(data)) {
        for(const datum of data) {
            if(isValidData(datum)) return true;
        }

        return false;
    } else {
        if(hasKeys(data)) {
            for(const datum of Object.values(data)) {
                if(isValidData(datum)) return true;
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
