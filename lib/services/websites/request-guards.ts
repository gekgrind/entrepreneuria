/**
 * Request-level guards for the website inquiry route. Pure (no env), so
 * they are unit-tested without a server.
 */
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

type HeaderReader = { get(name: string): string | null };

/**
 * The client address as set by the reverse proxy in X-Real-IP. The proxy
 * must overwrite that header with the address it accepted the connection
 * from. X-Forwarded-For is not read: its leading entries come from the
 * client. Returns null when the header is missing or not an IP address.
 */
export function proxyClientIp(headers: HeaderReader): string | null {
  const value = headers.get("x-real-ip")?.trim();
  return value && isIP(value) ? value : null;
}

/** Keyed hash of the client address. Requires a non-empty salt. */
export function hashClientIp(ip: string, salt: string): string {
  if (!salt) throw new Error("hashClientIp requires a salt");
  return createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32);
}

/** Rate-limit key for the client; requests without a known address share one bucket. */
export function ipRateLimitKey(ipHash: string | null): string {
  return ipHash ? `ip:${ipHash}` : "ip:unknown";
}

export type CappedBody = { ok: true; text: string } | { ok: false; reason: "too_large" | "malformed" };

/**
 * Reads a request body as UTF-8, counting bytes. A declared Content-Length
 * over the cap is refused before anything is read, and a body without one
 * is read only up to the cap.
 */
export async function readBodyCapped(request: Request, maxBytes: number): Promise<CappedBody> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared.trim())) return { ok: false, reason: "malformed" };
    if (Number(declared) > maxBytes) return { ok: false, reason: "too_large" };
  }
  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, reason: "too_large" };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}
