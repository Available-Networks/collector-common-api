/**
 * Error thrown when an API route returns data that is invalid
 * or does not match the expected structure.
 *
 * Includes the route and the raw response data for debugging.
 *
 * @example
 * ```ts
 * try {
 *   const result = await apiCall("/some/route");
 *   if (!isValid(result)) {
 *     throw new InvalidAPIResponseError("/some/route", result);
 *   }
 * } catch (err) {
 *   if (err instanceof InvalidAPIResponseError) {
 *     console.error(`Invalid response from ${err.route}:`, err.data);
 *   }
 * }
 * ```
 */
export default class InvalidAPIResponseError extends Error {
    /** The API route that returned invalid data */
    private readonly _route: string;

    /** The raw data returned by the API */
    private readonly _data: any;

    /**
     * Returns the API route that caused the error.
     */
    public get route(): string {
        return this._route;
    }

    /**
     * Returns the raw API response data.
     */
    public get data(): any {
        return this._data;
    }

    /**
     * Creates a new InvalidAPIResponseError.
     *
     * @param route - The API route that returned invalid data
     * @param data - The raw response data
     */
    constructor(route: string, data: any) {
        // Build a descriptive error message
        const message = `API route '${route}' returned invalid data: ${JSON.stringify(data)}`;
        super(message);

        // Maintain proper prototype chain (important when extending built-ins)
        Object.setPrototypeOf(this, InvalidAPIResponseError.prototype);

        this._route = route;
        this._data = data;
    }
}
