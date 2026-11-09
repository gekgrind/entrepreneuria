/**
 * Request helpers for the Websites inquiry route. Pure, so they are unit-tested.
 */
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

/**
 * The client IP as recorded by our reverse proxy: the LAST `X-Forwarded-For`
 * entry, which the proxy appends from the connection it accepted. Earlier
 * entries come from the client and are ignored. Returns null when there is
 * no usable value; callers must treat that as one shared, rate-limited
 * bucket, never as "no limit".
 *
 * Assumes exactly one trusted proxy in front of the app (see the PR notes).
 */
export function proxyClientIp(headers: Headers): string | null {
  const hops = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  const last = hops[hops.length - 1];
  return last && isIP(last) ? last : null;
}

/** Keyed hash of the proxy-recorded client IP. Never computed without a salt. */
export function clientIpHash(headers: Headers, salt: string): string | null {
  if (!salt) return null;
  const ip = proxyClientIp(headers);
  if (!ip) return null;
  return createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32);
}

export type CappedBody = { ok: true; text: string } | { ok: false; reason: "too_large" | "malformed" };

/**
 * Reads a request body as UTF-8, refusing more than `maxBytes` bytes.
 * Checks Content-Length before reading, then counts bytes while streaming
 * (Content-Length may be absent or wrong), and stops reading at the cap.
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
  try {
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
  } catch {
    return { ok: false, reason: "malformed" };
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
