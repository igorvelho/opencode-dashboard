import type { ProviderMetric } from "@shared/types";

export const PROVIDER_PALETTE = [
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
];

export const PROVIDER_MUTED = "#4b5563";

/**
 * Returns a stable hex colour for a providerId based on its position
 * in the sorted (by cost desc) providers array.
 * Zero-cost providers always get PROVIDER_MUTED.
 */
export function useProviderColour(
  providerId: string,
  providers: ProviderMetric[]
): string {
  const provider = providers.find(p => p.providerId === providerId);
  if (!provider || provider.cost === 0) return PROVIDER_MUTED;
  const index = providers.filter(p => p.cost > 0).indexOf(provider);
  return PROVIDER_PALETTE[index % PROVIDER_PALETTE.length];
}

/**
 * Returns a map of providerId → colour for all providers in the list.
 * Useful when you need colours for all providers at once (e.g. chart legend).
 */
export function buildProviderColourMap(providers: ProviderMetric[]): Record<string, string> {
  const map: Record<string, string> = {};
  const paid = providers.filter(p => p.cost > 0);
  providers.forEach(p => {
    const idx = paid.indexOf(p);
    map[p.providerId] = idx >= 0
      ? PROVIDER_PALETTE[idx % PROVIDER_PALETTE.length]
      : PROVIDER_MUTED;
  });
  return map;
}
