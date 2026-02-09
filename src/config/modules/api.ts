import z from "zod";
import { HttpProtocol } from "../types";

export const zPortDefault = (defaultPort: number) => {
    return z.preprocess(
        (v) => {
            if(v === "" || v === undefined) {
                return defaultPort;
            }

            return (v instanceof String)
                ? parseInt(v as string)
                : v;
        },
        z.coerce.number().refine(v => v > 0 && v <= 65535, {
            message: "Invalid port number",
        })
    );
}

export const zApiConfig = z.object({
  API_PROTOCOL: z.enum(HttpProtocol),
  API_HOST: z.string().nonempty(),
  API_HTTP_PORT: zPortDefault(80),
  API_HTTPS_PORT: zPortDefault(443)
})

export type ApiConfig = z.infer<typeof zApiConfig>;
