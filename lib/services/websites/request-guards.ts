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
  const value = headers.get("x-real-ip")?.trim().toLowerCase();
  if (!value || !isIP(value)) return null;
  // An IPv4 client seen through an IPv6 socket is the same client.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
  return mapped && isIP(mapped[1]) === 4 ? mapped[1] : value;
}

/** The eight 16-bit groups of a valid IPv6 address. */
function ipv6Groups(ip: string): number[] {
  let text = ip;
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text);
  if (v4) {
    const [a, b, c, d] = v4[1].split(".").map(Number);
    text = `${text.slice(0, v4.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = text.includes("::") ? text.split("::") : [text, null];
  const parse = (part: string) => (part ? part.split(":").map((g) => parseInt(g, 16)) : []);
  const left = parse(head);
  const right = tail === null ? [] : parse(tail);
  return [...left, ...Array(8 - left.length - right.length).fill(0), ...right];
}

/**
 * The address range one client is assumed to control, for rate limiting:
 * the address itself for IPv4, its /64 network for IPv6 (a single
 * subscriber is commonly assigned a whole /64).
 */
export function rateLimitAddress(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  return `${ipv6Groups(ip).slice(0, 4).map((g) => g.toString(16)).join(":")}::/64`;
}

/** Keyed hash of the client address. Requires a non-empty salt. */
export function hashClientIp(ip: string, salt: string): string {
  if (!salt) throw new Error("hashClientIp requires a salt");
  return createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32);
}

/** Rate-limit key for the client; requests without a known address share one bucket. */
export function ipRateLimitKey(ipBucket: string | null): string {
  return ipBucket ? `ip:${ipBucket}` : "ip:unknown";
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
