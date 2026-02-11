import axios, { AxiosHeaders, AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import z from "zod";

import InvalidAPIResponseError from "../errors/invalidApiResponseError";
import Logger from "../logging/logger";

const DEFAULT_REQUEST_TIMEOUT_SECONDS = 60;
const MAX_RETRIES = 10;

/**
 * Base abstract API collector client.
 *
 * Provides:
 * - common HTTP request logic
 * - retry & exponential backoff
 * - authentication injection
 * - optional Zod validation
 *
 * Subclasses implement API-specific logic and data retrieval.
 */
export default abstract class ApiCollectorClient {
    /** Base URL used for all requests. */
    #baseUrl: string;
    
    /** Persistent headers shared across requests. */
    #persistentHeaders: AxiosHeaders;

    /** Persistent axios object */
    #axiosClient: AxiosInstance;
    
    /**
     * Constructs a new API client.
     *
     * @param baseUrl Base endpoint URL for API requests
     * @param persistentHeaders Persistent headers to be used in every request - intended for auth
     * @param needsDisconnect Whether subclass must implement disconnect logic
     */
    protected constructor(baseUrl: string, persistentHeaders: AxiosHeaders) {
        this.#baseUrl = baseUrl;
        this.#persistentHeaders = persistentHeaders;

        this.#axiosClient = axios.create({
            baseURL: baseUrl,
            headers: {
                "Content-Type": "application/json",
                ...persistentHeaders
            },
            timeout: 10 * 1000 // 10 seconds
        })
    }

    /** Base API URL getter. */
    get baseUrl() { return this.#baseUrl }
    
    /** Persistent headers shared across requests. */
    get persistentHeaders() { return this.#persistentHeaders }

    /**
     * Collector entrypoint implemented by subclasses.
     *
     * @returns Aggregated collector data
     */
    abstract getAllData(..._args): Promise<Record<string, any>> | Record<string, any>;

    /**
     * Factory constructor for subclasses.
     *
     * Subclasses must override this method.
     *
     * @throws Error Always throws unless overridden
     */
    static async Create(..._args: any[]): Promise<ApiCollectorClient> {
        throw new Error("Create() must be implemented by subclass");
    }

    /**
     * Disconnect hook.
     *
     * Subclasses override this when persistent sessions or sockets are used.
     */
    async disconnect() { }

    /**
     * Executes an Axios request with retry and exponential backoff.
     *
     * Retries occur for network failures, 5xx errors, and HTTP 429.
     * 400 and 404 responses fail immediately.
     *
     * @template T Response data type
     * @param config Axios request configuration
     * @param retries Maximum retry attempts
     * @param delayMs Base retry delay in milliseconds
     * @returns Axios response
     *
     * @throws Error When retries are exhausted or a non-retryable error occurs
     */
    private async requestWithRetry<T = any>(
        config: AxiosRequestConfig,
        retries = MAX_RETRIES,
        delayMs = 1000
    ): Promise<AxiosResponse<T>> {
        let lastError: Error;

        for (let attempt = 1; attempt <= retries; attempt++) {
            if(attempt === 1) {
                Logger.http(`[${config.method}] ${config.url}`);
            } else {
                Logger.http(`(retry ${attempt}/${retries}) [${config.method}] ${config.url}`);
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
     * Performs an authenticated HTTP request.
     *
     * Automatically injects authentication headers/body and applies retry logic.
     *
     * @param method HTTP method
     * @param endpoint Endpoint path relative to base URL
     * @param opts Optional Axios configuration overrides
     * @returns Axios response or null
     *
     * @throws InvalidAPIResponseError If response status is not successful
     * @throws AxiosError if axios errors
     */
    protected async request(
        method: "GET" | "POST" | "PUT" | "DELETE",
        endpoint: string,
        opts?: AxiosRequestConfig
    ): Promise<AxiosResponse<any, any, {}> | null> {
        const url = `${this.#baseUrl}/${endpoint}`;

        let paramsStr = (opts?.params) ? `?${opts.params.toString()}` : "";

        const options: AxiosRequestConfig = {
            url: url,
            method,
            headers: {
                "Content-Type": "application/json",
                ...this.#persistentHeaders,
                ...opts?.headers,
            },
            timeout: opts?.timeout ?? DEFAULT_REQUEST_TIMEOUT_SECONDS * 1000,
            ...opts,
        };

        const response: AxiosResponse | null = await this.requestWithRetry(options);
        if (!response) {
            return null;
        }

        const decodedUriStr = decodeURIComponent(`${url}${paramsStr}`);
        if (response.status >= 200 && response.status < 300) {
            Logger.http(`[${method} - ${response.statusText}] ${decodedUriStr}`);
        } else {
            Logger.error(`[${method} - ${response.statusText}] ${decodedUriStr}`);
            throw new InvalidAPIResponseError(endpoint, `HTTP ${response.status} - ${response.statusText}`);
        }

        return response;
    }

    
    /**
     * Executes a request and validates the result with Zod.
     *
     * @template S Zod schema type
     * @param method HTTP method
     * @param endpoint API endpoint path
     * @param schema Zod schema used for validation
     * @param opts Optional Axios configuration
     * @returns Parsed and validated data
     *
     * @throws InvalidAPIResponseError If response status is not successful
     * @throws AxiosError if axios errors
     */
    protected async requestAndParse<S extends z.ZodTypeAny>(
        method: "GET" | "POST" | "PUT" | "DELETE",
        endpoint: string,
        schema: S,
        opts?: AxiosRequestConfig
    ): Promise<z.infer<S>> {
        const data = await this.request(method, endpoint, opts);
        return schema.parse(data);
    }
}
