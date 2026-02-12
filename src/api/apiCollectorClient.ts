import axios, { 
    AxiosHeaders,
    AxiosInstance,
    Method,
    type AxiosRequestConfig,
    type AxiosResponse 
} from "axios";

import z from "zod";

import { InvalidAPIResponseError } from "../errors";
import Logger from "../logging";


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
    /** Persistent axios object */
    protected axiosClient: AxiosInstance;

    #MAX_RETRIES=10;

    /**
     * Constructs a new API client.
     *
     * @param baseUrl Base endpoint URL for API requests
     * @param persistentHeaders Persistent headers to be used in every request - intended for auth
     * @param needsDisconnect Whether subclass must implement disconnect logic
     */
    protected constructor(baseUrl: string, persistentHeaders: AxiosHeaders, maxRetries: number = 10) {
        this.axiosClient = axios.create({
            baseURL: baseUrl,
            headers: {
                "Content-Type": "application/json",
                ...persistentHeaders
            },
            timeout: 30 * 1000 // 30 seconds
        })

        Logger.debug("Created axios client for base url: " + baseUrl);

        this.#MAX_RETRIES = maxRetries;
        this.initInterceptors();
    }

    private initInterceptors() {
        const methodEmojiMap = {
            GET: "💌",
            POST: "📬",
            PUT: "🔄",
            PATCH: "🩹",
            DELETE: "❌",
        };

        this.axiosClient.interceptors.request.use((config) => {
            const emoji = methodEmojiMap[config.method.toUpperCase()]
            Logger.http(`[${emoji} ${config.method.toUpperCase()}] ${config.baseURL}${config.url}`);
            return config;
        });
        
        // this.axiosClient.interceptors.response.use(async error => { 
        //     return this.retryOrThrow(error) 
        // })
    }

    private async retryOrThrow(error: any) {
        const config = error.config;

        if (!config) throw error;

        config.__retryCount = config.__retryCount || 0;

        const status = error.response?.status;

        const shouldRetry =
            (!status || status >= 500 || status === 429) &&
            config.__retryCount < this.#MAX_RETRIES;

        if (!shouldRetry) {
            throw error;
        }

        config.__retryCount++;

        const delay = 500 * 2 ** config.__retryCount;

        Logger.warn(
            `Retry ${config.__retryCount}/${this.#MAX_RETRIES} -> ${config.url}`
        );

        await new Promise(r => setTimeout(r, delay));

        return this.axiosClient(config);
    }

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
    protected async request<T = any>(
        method: Method,
        endpoint: string,
        opts?: AxiosRequestConfig
    ): Promise<AxiosResponse> {
        const response = await this.axiosClient.request<T>({
            method,
            url: `/${endpoint}`,
            ...opts
        });

        if (response.status < 200 || response.status >= 300) {
            throw new InvalidAPIResponseError(
                endpoint, `HTTP ${response.status}`
            );
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
        const response = await this.request(method, endpoint, opts);
        return schema.parse(response.data);
    }
}
