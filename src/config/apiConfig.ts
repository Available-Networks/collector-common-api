import z from "zod";

export const HttpProtocol = [ "http", "https" ] as const;
export type HttpProtocol = typeof HttpProtocol[number];
export const zHttpProtocol = z.enum(HttpProtocol);

export const zPortDefault = (defaultPort: number) => {
    return z.preprocess(
        v => (v === "" || v === undefined ? defaultPort : v),
        z.coerce.number().refine(v => v > 0 && v <= 65535, {
            message: "Invalid port number",
        })
    );
}

export const zApiConfig = z.object({
  API_PROTOCOL: zHttpProtocol.optional().default("https"),
  API_HOST: z.string().nonempty(),
  API_HTTP_PORT: zPortDefault(80),
  API_HTTPS_PORT: zPortDefault(443)
})

export type ApiConfig = z.infer<typeof zApiConfig>;
