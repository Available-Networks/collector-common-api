import z from "zod";
import { HttpProtocol } from "../types";
import { zPortDefault } from "../../utils";

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
