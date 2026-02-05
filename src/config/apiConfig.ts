import z from "zod";

export const HttpProtocol = [ "http", "https" ] as const;
export type HttpProtocol = typeof HttpProtocol[number];
export const zHttpProtocol = z.enum(HttpProtocol);

export const zPort = z
    .string()
    .default("")
    .transform((val: string) => parseInt(val!, 10))
    .refine((val: number) => !isNaN(val) && val > 0 && val <= 65535, {
        message: "Invalid port number"
    })

export const zApiConfig = z.object({
  PROTOCOL: zHttpProtocol.default("https"),
  HTTP_PORT: zPort.default(80).optional(),
  HTTPS_PORT: zPort.default(443).optional()
})
export type ApiConfig = z.infer<typeof zApiConfig>;
