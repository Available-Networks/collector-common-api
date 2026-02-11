import z from "zod";
import { HttpProtocol } from "../types";

/**
 * Creates a Zod schema that parses and validates TCP port numbers while
 * applying a default value when none is provided.
 *
 * Behavior:
 * - Empty string or undefined values resolve to the provided default port.
 * - String values are parsed into numbers.
 * - Values are coerced into numbers when possible.
 * - Final value must be within the valid TCP port range (1–65535).
 *
 * This helper is primarily intended for environment-variable driven configs
 * where ports are commonly passed as strings.
 *
 * @param defaultPort - Port number used when input is empty or undefined
 * @returns Zod schema validating and coercing a port number
 *
 * @example
 * ```ts
 * const schema = zPortDefault(8080);
 * schema.parse(undefined); // → 8080
 * schema.parse("3000");    // → 3000
 * ```
 */
export const zPortDefault = (defaultPort: number) => {
    return z.preprocess(
        (v) => {
            // Apply default if value is empty or undefined
            if(v === "" || v === undefined) {
                return defaultPort;
            }

            // Parse string values into numbers
            return (v instanceof String)
                ? parseInt(v as string)
                : v;
        },
        z.coerce.number().refine(v => v > 0 && v <= 65535, {
            message: "Invalid port number",
        })
    );
}

/**
 * API server configuration schema.
 *
 * Defines protocol, host, and ports used by the application API.
 * Ports receive defaults if not explicitly provided.
 */
export const zApiConfig = z.object({
  API_PROTOCOL: z.enum(HttpProtocol),
  API_HOST: z.string().nonempty(),
  API_HTTP_PORT: zPortDefault(80),
  API_HTTPS_PORT: zPortDefault(443)
})

/**
 * API server configuration schema.
 *
 * Defines protocol, host, and ports used by the application API.
 * Ports receive defaults if not explicitly provided.
 */
export type ApiConfig = z.infer<typeof zApiConfig>;
