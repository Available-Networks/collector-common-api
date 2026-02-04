import axios, { AxiosHeaders, type AxiosRequestConfig, type AxiosResponse } from "axios";
import z from "zod";

import InvalidAPIResponseError from "../errors/invalidApiResponseError";
import Logger from "../logging/logger";

const DEFAULT_REQUEST_TIMEOUT_SECONDS = 60;

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

    abstract getAllData(): Promise<Record<string, any>> | Record<string, any>;

    static async Create(..._args: any[]): Promise<ApiCollectorClient> {
        throw new Error("Create() must be implemented by subclass");
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
        const authConfig = this.#authConfig;

        const url = `${this.#baseUrl}/${endpoint}`;
        const options: AxiosRequestConfig<any> = {
            url: url,
            method,
            headers: {
                "Content-Type": "application/json",
                ...authConfig.headers,
                ...opts?.headers,
            },
            data: {
                ...opts?.data,
            },
            timeout: opts?.timeout ?? DEFAULT_REQUEST_TIMEOUT_SECONDS * 1000,
            ...opts,
        };

        if(authConfig.body) {
            options.data = {
                ...authConfig.body,
                ...options.data,
            };
        }

        const response: AxiosResponse = await axios.request(options);
        if(response.status >= 200 && response.status < 300) {
            Logger.http(`[${method} - ${response.statusText}] ${url}`);
        } else {
            Logger.error(`[${method} - ${response.statusText}] ${url}`);
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
