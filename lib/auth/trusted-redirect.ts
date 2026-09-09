const DEFAULT_TRUSTED_ORIGINS = [
  "https://entrepreneuria.io",
  "https://prospra.entrepreneuria.io",
  "https://architecta.entrepreneuria.io",
  "https://directorium.entrepreneuria.io",
  "https://synceri.entrepreneuria.io",
];

function normalizeOrigin(value: string) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function getTrustedRedirectOrigins() {
  const origins = new Set(DEFAULT_TRUSTED_ORIGINS);
  const configuredAppUrls = [
    process.env.NEXT_PUBLIC_PROSPRA_APP_URL,
    process.env.NEXT_PUBLIC_ARCHITECTA_APP_URL,
    process.env.NEXT_PUBLIC_DIRECTORIUM_APP_URL,
    process.env.NEXT_PUBLIC_SYNCERI_APP_URL,
  ];

  for (const value of configuredAppUrls) {
    const origin = value ? normalizeOrigin(value) : null;

    if (origin) {
      origins.add(origin);
    }
  }

  return origins;
}

/**
 * Where an authenticated visitor belongs when nothing more specific was
 * requested.
 *
 * `/dashboard` rather than `/command-center`: it is the route the proxy
 * actually protects (PROTECTED_ROUTE_PREFIXES), and it forwards to the
 * command center itself. Sending people straight to `/command-center`
 * would route them around the authentication boundary.
 *
 * Deliberately NOT an onboarding route — `app/(app)/onboarding/step-3`
 * redirects to `/onboarding`, which does not exist and returns 404, so
 * there is no first-run flow for this to defer to yet. If one lands,
 * this constant is the single place that has to change.
 */
export const DEFAULT_AUTHENTICATED_PATH = "/dashboard";

export function getSafeAuthRedirect(
  value: string | null,
  fallback: string = DEFAULT_AUTHENTICATED_PATH,
) {
  if (!value) {
    return fallback;
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  try {
    const url = new URL(value);

    if (
      url.protocol === "https:" &&
      getTrustedRedirectOrigins().has(url.origin)
    ) {
      return url.toString();
    }
  } catch {
    return fallback;
  }

  return fallback;
}
