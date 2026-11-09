/**
 * Request guards for the leads-only intake: bounded body read, origin and
 * content-type checks, and trusted client-IP resolution.
 *
 * Pure and dependency-free so each rule is unit-tested without a server.
 */
import { createHash } from "node:crypto";
import { isIP } from "node:net";

import type { ClientIpSource } from "./leads-config";

export type BodyRead = { ok: true; text: string } | { ok: false; reason: "too_large" | "unreadable" };

/**
 * Reads at most `maxBytes` of the body. Rejects on a declared length over
 * the cap before reading anything, and aborts a stream that exceeds it, so
 * an oversized body is never buffered in full.
 */
export async function readBodyCapped(request: Request, maxBytes: number): Promise<BodyRead> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const n = Number(declared);
    if (!Number.isFinite(n) || n < 0) return { ok: false, reason: "unreadable" };
    if (n > maxBytes) return { ok: false, reason: "too_large" };
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
    return { ok: false, reason: "unreadable" };
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(merged) };
}

/** Only the configured public origin may post. A missing Origin header fails closed. */
export function isAllowedOrigin(request: Request, allowedOrigin: string): boolean {
  return request.headers.get("origin") === allowedOrigin;
}

export function isJsonContentType(request: Request): boolean {
  const ct = request.headers.get("content-type") ?? "";
  return /^application\/json\s*(;|$)/i.test(ct);
}

/**
 * Resolves the client IP from the one header the operator says the proxy
 * controls. Never trusts a client-supplied leftmost X-Forwarded-For entry.
 * Returns null when the header is missing or not a valid IP address.
 */
export function resolveClientIp(headers: Headers, source: ClientIpSource): string | null {
  let candidate: string | undefined;
  if (source.kind === "x-real-ip") {
    candidate = headers.get("x-real-ip")?.trim();
  } else {
    const parts = (headers.get("x-forwarded-for") ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    candidate = parts.length >= source.hops ? parts[parts.length - source.hops] : undefined;
  }
  return candidate && isIP(candidate) !== 0 ? candidate : null;
}

/** Same construction the existing route uses, so evidence stays comparable. */
export function hashClientIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** Evidence marker when no trusted IP could be resolved (rate limiting then uses one shared bucket). */
export const UNRESOLVED_IP_MARKER = "ip-unresolved";
