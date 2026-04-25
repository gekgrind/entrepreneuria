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

export function getSafeAuthRedirect(
  value: string | null,
  fallback = "/dashboard",
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

export function buildOAuthRedirect(origin: string, nextUrl: string) {
  if (nextUrl.startsWith("https://")) {
    return nextUrl;
  }

  return `${origin}${nextUrl}`;
}
