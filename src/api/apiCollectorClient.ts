import axios, { AxiosHeaders, type AxiosRequestConfig, type AxiosResponse } from "axios";
import z from "zod";

import InvalidAPIResponseError from "../errors/invalidApiResponseError";
import Logger from "../logging/logger";

const DEFAULT_REQUEST_TIMEOUT_SECONDS = 60;

export type ApiAuthConfig = {
    headers?: AxiosHeaders;
    body?: Record<string, any>;
};

/**
 * Generic abstract API client
 */
export default abstract class ApiCollectorClient {
    protected baseUrl: string;

    protected constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    protected abstract isConnected(): boolean;

    /**
     * Subclasses must provide authentication config (headers or body)
     */
    protected abstract get authConfig(): ApiAuthConfig | Promise<ApiAuthConfig>;

    /**
     * Protected connect function.
     * Must be overridden in subclasses for custom initialization.
     */
    public abstract init(): ApiCollectorClient | Promise<ApiCollectorClient>;

    public abstract getAllData(): Promise<Record<string, any>> | Record<string, any>;

    /**
     * Generic request method.
     * Accepts full AxiosRequestConfig to allow custom headers, query params, etc.
     */
    protected async request(
        method: "GET" | "POST" | "PUT" | "DELETE",
        endpoint: string,
        opts?: AxiosRequestConfig
    ): Promise<AxiosResponse<any, any, {}> | null> {
        const authConfig = await this.authConfig;

        const url = `${this.baseUrl}/${endpoint}`;
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
