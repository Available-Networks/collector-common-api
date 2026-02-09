import axios, { AxiosHeaders, type AxiosRequestConfig, type AxiosResponse } from "axios";
import z from "zod";

import InvalidAPIResponseError from "../errors/invalidApiResponseError";
import Logger from "../logging/logger";
import { Util } from "..";

const DEFAULT_REQUEST_TIMEOUT_SECONDS = 60;
const MAX_RETRIES = 10;

export type ApiCollectorAuthConfig = {
    headers?: AxiosHeaders;
    body?: Record<string, any>;
};

/**
 * Generic abstract API client
 */
export default abstract class ApiCollectorClient {
    #baseUrl: string;
    #authConfig: ApiCollectorAuthConfig;

    protected constructor(baseUrl: string, authConfig: ApiCollectorAuthConfig) {
        this.#baseUrl = baseUrl;
        this.#authConfig = authConfig;
    }

    get baseUrl() { return this.#baseUrl }
    get authConfig() { return this.#authConfig }

    abstract getAllData(): Promise<Record<string, any>> | Record<string, any>;

    static async Create(..._args: any[]): Promise<ApiCollectorClient> {
        throw new Error("Create() must be implemented by subclass");
    }

    abstract disconnect();

    private async requestWithRetry<T = any>(
        config: AxiosRequestConfig,
        retries = 5,
        delayMs = 1000
    ): Promise<AxiosResponse<T>> {
        let lastError: Error;

        for (let attempt = 1; attempt <= retries; attempt++) {
            if(attempt === 1) {
                Logger.debug(`[${config.method}] ${config.url}`);
            } else {
                Logger.debug(`(retry ${attempt}/${retries}) [${config.method}] ${config.url}`);
            }

            try {
                return await axios(config);
            } catch (err: any) {
                const status = err.response?.status;

                // Fail fast on 400 or 404
                if (status === 400 || status === 404) {
                    throw err;
                }

                // Retry only on network errors, internal server errors, or too many requests
                if (attempt === retries || (status && status < 500 && status !== 429)) {
                    throw err;
                }

                lastError = err;

                await new Promise((res) => setTimeout(res, delayMs * 2 ** attempt)); // "exponential backoff"
            }
        }

        throw lastError;
    }

    /**
     * Generic request method.
     * Accepts full AxiosRequestConfig to allow custom headers, query params, etc.
     */
    protected async request(
        method: "GET" | "POST" | "PUT" | "DELETE",
        endpoint: string,
        opts?: AxiosRequestConfig
    ): Promise<AxiosResponse<any, any, {}> | null> {
        const url = `${this.#baseUrl}/${endpoint}`;

        let paramsStr = (opts?.params) ? `?${opts.params.toString()}` : "";
        const decodedUriStr = decodeURIComponent(`${url}${paramsStr}`);


        const authConfig = this.#authConfig;
        const options: AxiosRequestConfig<any> = {
            url: url,
            method,
            headers: {
                "Content-Type": "application/json",
                ...authConfig.headers,
                ...opts?.headers,
            },
            timeout: opts?.timeout ?? DEFAULT_REQUEST_TIMEOUT_SECONDS * 1000,
            ...opts,
        };

        if (opts?.data) {
            options.data = { ...opts?.data }
        }

        if (authConfig.body) {
            options.data = {
                ...authConfig.body,
                ...options.data,
            };
        }

        const response: AxiosResponse | null = await this
            .requestWithRetry(options)
            .catch(Util.printErrorAndReturnNull);

        if (!response) {
            return null;
        }

        if (response.status >= 200 && response.status < 300) {
            Logger.http(`[${method} - ${response.statusText}] ${decodedUriStr}`);
        } else {
            Logger.error(`[${method} - ${response.statusText}] ${decodedUriStr}`);
            throw new InvalidAPIResponseError(endpoint, `HTTP ${response.status} - ${response.statusText}`);
        }

        return response;
    }

    /**
     * Request + Zod parsing
     */
    protected async requestAndParse<S extends z.ZodTypeAny>(
        method: "GET" | "POST" | "PUT" | "DELETE",
        endpoint: string,
        schema: S,
        opts?: AxiosRequestConfig
    ): Promise<z.infer<S>> {
        const data = await this.request(method, endpoint, opts);
        const parsed = schema.safeParse(data);

        if (!parsed.success) {
            throw new InvalidAPIResponseError(endpoint, JSON.stringify(parsed.error.issues, null, 2));
        }

        return parsed.data;
    }
}
