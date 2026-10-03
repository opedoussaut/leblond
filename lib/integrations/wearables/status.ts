import type { ProviderAvailability } from "./types";

/**
 * Single source of truth for what a provider's connection status is.
 * "CONNECTED" is only possible when a stored authorization exists — it can
 * never be derived from configuration alone.
 */
export function resolveProviderStatus(input: {
  plannedOnly: boolean;
  configured: boolean;
  environment: "production" | "development";
  connection: { status: "CONNECTED" | "DISCONNECTED" | "ERROR" } | null;
}): ProviderAvailability {
  if (input.plannedOnly) return "NOT_YET_AVAILABLE";
  if (!input.configured) return "REQUIRES_PROVIDER_APPROVAL";
  if (input.connection?.status === "CONNECTED") return "CONNECTED";
  if (input.connection?.status === "ERROR") return "ERROR";
  if (input.connection?.status === "DISCONNECTED") return "DISCONNECTED";
  return input.environment === "development" ? "DEVELOPMENT_TESTING" : "AVAILABLE";
}

export function canStartAuthorization(status: ProviderAvailability): boolean {
  return status === "AVAILABLE" || status === "DEVELOPMENT_TESTING" || status === "DISCONNECTED" || status === "ERROR";
}
