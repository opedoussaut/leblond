/** Reads provider configuration from server environment variables. */
export function envOf(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

export function apiEnvironment(prefix: string): "production" | "development" {
  return envOf(`${prefix}_API_ENV`) === "development" ? "development" : "production";
}
