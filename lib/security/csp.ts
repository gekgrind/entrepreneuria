/*
 * Content Security Policy for every document the hub serves.
 *
 * Built per request in the proxy, with a fresh nonce: Next.js reads the
 * nonce back from the request's CSP header and stamps it on every script
 * it renders (parse-request-headers.js reads `content-security-policy`,
 * then `content-security-policy-report-only`). `'strict-dynamic'` lets
 * those scripts load what they need — next/script injecting Cloudflare
 * Turnstile, chunk loading — while a script tag that did not come from
 * the app (an injected `<script src>` or inline block) has no nonce and
 * is refused.
 *
 * Rollout is controlled by CSP_MODE (server-only, read per request):
 *
 *   report-only (default)  The full policy is sent as
 *                          Content-Security-Policy-Report-Only, so nothing
 *                          is blocked; violations are reported to
 *                          CSP_REPORT_PATH.
 *   enforce                The full policy is enforced.
 *   off                    No nonce policy (kill switch).
 *
 * In every mode a small static baseline (no framing, no <base> hijack,
 * no plugins) is enforced from next.config.mjs; see BASELINE_DIRECTIVES.
 *
 * Any other value falls back to report-only: a typo must never enforce.
 */

export const CSP_REPORT_PATH = "/api/security/csp-report";
export const CSP_REPORT_GROUP = "csp-endpoint";

export type CspMode = "report-only" | "enforce" | "off";

/* Cloudflare Turnstile: api.js is a script, the challenge is an iframe. */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/* OAuth provider avatars the account UI renders as <img>. */
const AVATAR_IMAGE_ORIGINS = [
  "https://lh3.googleusercontent.com",
  "https://avatars.githubusercontent.com",
];

/* app/tools/financial-projector imports a Google Fonts stylesheet. */
const GOOGLE_FONTS_STYLESHEET_ORIGIN = "https://fonts.googleapis.com";
const GOOGLE_FONTS_FILE_ORIGIN = "https://fonts.gstatic.com";

/* Also part of the full policy. Kept identical to BASELINE_CSP in
   lib/security/browser-headers.mjs, which enforces them statically (a
   test holds the two together). None of these can break a page this app
   renders: nothing frames the hub, it sets no <base>, and it embeds no
   plugins. */
const BASELINE_DIRECTIVES: Record<string, string[]> = {
  "frame-ancestors": ["'none'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
};

export function getCspMode(value: string | undefined = process.env.CSP_MODE): CspMode {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "enforce" || normalized === "off") {
    return normalized;
  }

  return "report-only";
}

/** 128 random bits, base64: the CSP nonce for one response. */
export function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

/**
 * The Supabase project's origin (https) and its realtime origin (wss),
 * or nothing when the URL is missing or not https.
 */
export function getSupabaseConnectOrigins(
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
) {
  if (!supabaseUrl) {
    return [];
  }

  try {
    const url = new URL(supabaseUrl);

    if (url.protocol !== "https:") {
      return [];
    }

    return [url.origin, `wss://${url.host}`];
  } catch {
    return [];
  }
}

function serialize(directives: Record<string, string[]>) {
  return Object.entries(directives)
    .map(([name, sources]) => (sources.length > 0 ? `${name} ${sources.join(" ")}` : name))
    .join("; ");
}

export type ContentSecurityPolicyOptions = {
  nonce: string;
  mode: Exclude<CspMode, "off">;
  supabaseUrl?: string;
  isDevelopment?: boolean;
};

/** The full policy, as enforced under `enforce` or reported under `report-only`. */
export function buildContentSecurityPolicy({
  nonce,
  mode,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  isDevelopment = process.env.NODE_ENV !== "production",
}: ContentSecurityPolicyOptions) {
  const supabase = getSupabaseConnectOrigins(supabaseUrl);
  const supabaseHttps = supabase.filter((origin) => origin.startsWith("https://"));

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    /* 'self' and the Turnstile origin are only read by browsers without
       'strict-dynamic' support (CSP2); CSP3 browsers rely on the nonce.
       React's development build evaluates code for its callstacks, so
       'unsafe-eval' is added in development only. */
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      TURNSTILE_ORIGIN,
      ...(isDevelopment ? ["'unsafe-eval'"] : []),
    ],
    /* Inline style attributes are rendered server-side throughout the
       app (React `style` props, Radix, motion libraries), so styles keep
       'unsafe-inline'. Styles cannot run script; this is the accepted
       trade-off of a nonce-based script policy. */
    "style-src": ["'self'", "'unsafe-inline'", GOOGLE_FONTS_STYLESHEET_ORIGIN],
    "img-src": ["'self'", "data:", "blob:", ...supabaseHttps, ...AVATAR_IMAGE_ORIGINS],
    "font-src": ["'self'", "data:", GOOGLE_FONTS_FILE_ORIGIN],
    "connect-src": ["'self'", ...supabase, TURNSTILE_ORIGIN],
    "frame-src": [TURNSTILE_ORIGIN],
    /* three.js text rendering (troika) builds its worker from a blob. */
    "worker-src": ["'self'", "blob:"],
    "media-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "form-action": ["'self'"],
    ...BASELINE_DIRECTIVES,
    "report-uri": [CSP_REPORT_PATH],
    "report-to": [CSP_REPORT_GROUP],
  };

  /* Ignored (with a console warning) in a report-only policy. */
  if (mode === "enforce" && !isDevelopment) {
    directives["upgrade-insecure-requests"] = [];
  }

  return serialize(directives);
}

/** The baseline as a policy string (what next.config.mjs enforces). */
export function buildBaselinePolicy() {
  return serialize(BASELINE_DIRECTIVES);
}

/* Request headers a client could send to influence the nonce Next.js
   extracts; always replaced by the proxy's own. */
export const CSP_REQUEST_HEADERS = [
  "content-security-policy",
  "content-security-policy-report-only",
  "x-nonce",
] as const;

type HeaderBag = Pick<Headers, "set" | "delete">;

export type PreparedContentSecurityPolicy = {
  mode: CspMode;
  nonce: string | null;
  /** Response headers to set on whatever the proxy returns. */
  responseHeaders: Record<string, string>;
};

/**
 * Builds this request's policy and rewrites the request headers Next.js
 * reads the nonce from. Must run before any `NextResponse.next({ request })`
 * is constructed, because that snapshot is what reaches the renderer.
 */
export function prepareContentSecurityPolicy(
  requestHeaders: HeaderBag,
  {
    mode = getCspMode(),
    reportOrigin,
    nonce = createNonce(),
    supabaseUrl,
    isDevelopment,
  }: {
    mode?: CspMode;
    /** Absolute origin the Reporting API endpoint is addressed on. */
    reportOrigin: string;
    nonce?: string;
    supabaseUrl?: string;
    isDevelopment?: boolean;
  },
): PreparedContentSecurityPolicy {
  for (const name of CSP_REQUEST_HEADERS) {
    requestHeaders.delete(name);
  }

  if (mode === "off") {
    return { mode, nonce: null, responseHeaders: {} };
  }

  const policy = buildContentSecurityPolicy({ nonce, mode, supabaseUrl, isDevelopment });
  /* Only the header carrying the nonce goes on the request: Next.js reads
     `content-security-policy` first, and the baseline has no nonce. */
  const policyHeader =
    mode === "enforce" ? "content-security-policy" : "content-security-policy-report-only";

  requestHeaders.set(policyHeader, policy);
  requestHeaders.set("x-nonce", nonce);

  /*
   * Only the header that carries the nonce. Next.js copies every proxy
   * RESPONSE header onto the forwarded request too
   * (router-utils/resolve-routes.js: `req.headers[key] = value`), and it
   * reads `content-security-policy` before the report-only header. A
   * nonce-less baseline sent from here would therefore shadow the nonce
   * and every script would render without one. The baseline is a static
   * header in next.config.mjs instead (lib/security/browser-headers.mjs).
   */
  const responseHeaders: Record<string, string> = {
    [policyHeader]: policy,
    "reporting-endpoints": `${CSP_REPORT_GROUP}="${new URL(CSP_REPORT_PATH, reportOrigin).toString()}"`,
  };

  return { mode, nonce, responseHeaders };
}

export function applyContentSecurityPolicy<T extends { headers: Headers }>(
  response: T,
  prepared: PreparedContentSecurityPolicy,
) {
  for (const [name, value] of Object.entries(prepared.responseHeaders)) {
    response.headers.set(name, value);
  }

  return response;
}
