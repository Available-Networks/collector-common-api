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