/**
 * Node HTTP host for the alert receiver on the app server.
 *
 * Binds to loopback only: the app reaches it at http://127.0.0.1:<port>/alerts
 * and nothing outside the machine can. No DNS, TLS certificate or nginx
 * change is needed. Every request still goes through the full check order
 * in alert-receiver.ts (signature, replay, payload, cooldown, cap).
 *
 * Extra guard here: a coarse per-minute request ceiling (all callers), so a
 * runaway local caller can't burn CPU on signature checks.
 */
import http from "node:http";

import { createMemoryStore, handleAlertRequest, MAX_BODY_BYTES, type DedupeStore, type Mailer, type ReceiverConfig } from "./alert-receiver";

export interface ReceiverServerOptions {
  port: number;
  /** Loopback only. */
  host?: "127.0.0.1" | "::1";
  config: ReceiverConfig;
  mailer: Mailer;
  store?: DedupeStore;
  /** Requests per minute across all callers. Default 120. */
  maxPerMinute?: number;
  nowMs?: () => number;
  log?: (msg: string, meta?: Record<string, unknown>) => void;
}

export function createAlertReceiverServer(opts: ReceiverServerOptions): http.Server {
  const host = opts.host ?? "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "::1") throw new Error("the alert receiver binds to loopback only");
  const store = opts.store ?? createMemoryStore(opts.nowMs);
  const max = opts.maxPerMinute ?? 120;
  const now = opts.nowMs ?? Date.now;
  let windowStart = now();
  let count = 0;

  const server = http.createServer((req, res) => {
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(body));
    };

    if (now() - windowStart >= 60_000) {
      windowStart = now();
      count = 0;
    }
    if (++count > max) {
      opts.log?.("rejected", { reason: "rate" });
      req.resume();
      return reply(429, { ok: false });
    }

    const chunks: Buffer[] = [];
    let size = 0;
    let aborted = false;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES + 1) {
        aborted = true;
        reply(413, { ok: false });
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", async () => {
      if (aborted) return;
      try {
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
        const method = req.method ?? "GET";
        const request = new Request(`http://${host === "::1" ? "[::1]" : host}${req.url ?? "/"}`, {
          method,
          headers,
          body: method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks),
        });
        const response = await handleAlertRequest(request, { config: opts.config, store, mailer: opts.mailer, nowMs: opts.nowMs, log: opts.log });
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (err) {
        opts.log?.("receiver error", { error: (err as Error).name });
        if (!res.headersSent) reply(500, { ok: false });
      }
    });
  });
  server.listen(opts.port, host);
  return server;
}
