import { AxiosError, AxiosResponse } from "axios";
import { LogLevel, type Logger } from "../logging";

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
export const printErrorAndReturnNull = (e: any, logger: Logger) => {
    const [ logLevel, message ] = writeAxiosErrorLog(e as AxiosError)
    logger.logWithLevel(message, logLevel);
    return null;
}
