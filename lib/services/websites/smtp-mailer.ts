/**
 * Minimal SMTP submission client for alert emails (no dependency).
 *
 * Sends through the owner's EXISTING mailbox provider (authenticated SMTP
 * submission), from the mailbox to itself, so no DNS change, sending
 * domain or new subscription is needed. Supported:
 *   - implicit TLS (port 465) or STARTTLS (port 587); TLS is mandatory and
 *     certificates are verified (plain SMTP is refused except to loopback,
 *     for tests)
 *   - AUTH PLAIN, or AUTH LOGIN when that is all the server offers (e.g.
 *     Microsoft 365)
 *   - one plain-text message per connection, body base64-encoded (so no
 *     line-length or dot-stuffing issues), RFC 2047 subject when non-ASCII
 * Every step has a deadline; any unexpected reply fails the send, so the
 * receiver answers 502 and the app retries. Credentials are never logged.
 */
import { randomBytes } from "node:crypto";
import net from "node:net";
import tls from "node:tls";

import type { Mailer, OutboundEmail } from "./alert-receiver";

export interface SmtpConfig {
  host: string;
  port: number;
  /** "tls" = implicit TLS (465), "starttls" = upgrade (587). "none" only to loopback (tests). */
  security: "tls" | "starttls" | "none";
  user: string;
  pass: string;
  /** Overall deadline for one message. Default 20 s. */
  timeoutMs?: number;
  /** EHLO name. Default "localhost". */
  heloName?: string;
  /** Test seam: extra TLS options (e.g. a test CA). Never disables verification in production code paths. */
  tlsOptions?: tls.ConnectionOptions;
}

export class SmtpError extends Error {
  constructor(
    message: string,
    public readonly code: number | null,
    public readonly stage: string
  ) {
    super(message);
    this.name = "SmtpError";
  }
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

export function parseSmtpConfig(env: Record<string, string | undefined>): { config: SmtpConfig | null; problems: string[] } {
  const problems: string[] = [];
  const host = env.ALERT_SMTP_HOST?.trim() ?? "";
  const port = Number(env.ALERT_SMTP_PORT ?? "");
  const security = (env.ALERT_SMTP_SECURITY ?? (port === 465 ? "tls" : "starttls")).trim() as SmtpConfig["security"];
  const user = env.ALERT_SMTP_USER ?? "";
  const pass = env.ALERT_SMTP_PASS ?? "";
  if (!/^[A-Za-z0-9.-]+$/.test(host)) problems.push("ALERT_SMTP_HOST");
  if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push("ALERT_SMTP_PORT");
  if (!["tls", "starttls", "none"].includes(security) || (security === "none" && !LOOPBACK.has(host))) problems.push("ALERT_SMTP_SECURITY");
  if (!user) problems.push("ALERT_SMTP_USER");
  if (!pass) problems.push("ALERT_SMTP_PASS");
  return problems.length ? { config: null, problems } : { config: { host, port, security, user, pass }, problems };
}

const encodeHeader = (v: string) => (/^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`);

/** RFC 5322 message with a base64 text/plain body. */
export function buildMessage(m: OutboundEmail, now: Date = new Date()): string {
  for (const v of [m.from, m.to, m.subject]) if (/[\r\n]/.test(v)) throw new SmtpError("header injection refused", null, "build");
  const domain = m.from.split("@")[1] ?? "localhost";
  const body = Buffer.from(m.text.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n");
  return [
    `From: ${m.from}`,
    `To: ${m.to}`,
    `Subject: ${encodeHeader(m.subject)}`,
    `Date: ${now.toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${randomBytes(12).toString("hex")}@${domain}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "Auto-Submitted: auto-generated",
    "",
    body,
  ].join("\r\n");
}

/** Line-oriented SMTP conversation over a (possibly upgraded) socket. */
class Conversation {
  private buf = "";
  private waiters: Array<(line: string) => void> = [];
  private failure: Error | null = null;

  constructor(public socket: net.Socket) {
    this.attach(socket);
  }

  attach(socket: net.Socket) {
    this.socket = socket;
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      this.buf += chunk;
      let i: number;
      while ((i = this.buf.indexOf("\r\n")) >= 0) {
        const line = this.buf.slice(0, i);
        this.buf = this.buf.slice(i + 2);
        const w = this.waiters.shift();
        if (w) w(line);
        else this.pending.push(line);
      }
    });
    const fail = (err: Error) => {
      this.failure ??= err;
      for (const w of this.waiters.splice(0)) w("\u0000");
    };
    socket.on("error", fail);
    socket.on("close", () => fail(new SmtpError("connection closed", null, "io")));
  }

  private pending: string[] = [];

  private nextLine(): Promise<string> {
    const queued = this.pending.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) =>
      this.waiters.push((line) => (line === "\u0000" ? reject(this.failure ?? new SmtpError("connection lost", null, "io")) : resolve(line)))
    );
  }

  /** Reads one (possibly multi-line) reply. */
  async reply(stage: string): Promise<{ code: number; lines: string[] }> {
    const lines: string[] = [];
    for (;;) {
      const line = await this.nextLine();
      const m = /^(\d{3})([ -])(.*)$/.exec(line);
      if (!m) throw new SmtpError("malformed reply", null, stage);
      lines.push(m[3]);
      if (m[2] === " ") return { code: Number(m[1]), lines };
    }
  }

  async expect(stage: string, ok: number[]): Promise<string[]> {
    const r = await this.reply(stage);
    if (!ok.includes(r.code)) throw new SmtpError(`unexpected ${r.code} at ${stage}`, r.code, stage);
    return r.lines;
  }

  async command(line: string, stage: string, ok: number[]): Promise<string[]> {
    this.socket.write(`${line}\r\n`);
    return this.expect(stage, ok);
  }
}

export function createSmtpMailer(cfg: SmtpConfig): Mailer {
  if (cfg.security === "none" && !LOOPBACK.has(cfg.host)) throw new Error("plain SMTP is only allowed to loopback");
  const timeoutMs = cfg.timeoutMs ?? 20_000;
  const helo = cfg.heloName ?? "localhost";

  async function send(m: OutboundEmail): Promise<void> {
    const data = buildMessage(m);
    const socket: net.Socket =
      cfg.security === "tls"
        ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host, ...cfg.tlsOptions })
        : net.connect({ host: cfg.host, port: cfg.port });
    const conv = new Conversation(socket);
    const timer = setTimeout(() => socket.destroy(new SmtpError("timed out", null, "timeout")), timeoutMs);
    try {
      await conv.expect("greeting", [220]);
      let caps = await conv.command(`EHLO ${helo}`, "ehlo", [250]);

      if (cfg.security === "starttls") {
        if (!caps.some((c) => /^STARTTLS\b/i.test(c))) throw new SmtpError("server does not offer STARTTLS", null, "starttls");
        await conv.command("STARTTLS", "starttls", [220]);
        const plain = conv.socket;
        plain.removeAllListeners("data");
        plain.removeAllListeners("error");
        plain.removeAllListeners("close");
        const secure = tls.connect({ socket: plain, servername: cfg.host, ...cfg.tlsOptions });
        await new Promise<void>((resolve, reject) => {
          secure.once("secureConnect", resolve);
          secure.once("error", reject);
        });
        conv.attach(secure);
        caps = await conv.command(`EHLO ${helo}`, "ehlo-tls", [250]);
      }

      const auth = caps.find((c) => /^AUTH\b/i.test(c)) ?? "";
      if (/\bPLAIN\b/i.test(auth)) {
        const token = Buffer.from(`\u0000${cfg.user}\u0000${cfg.pass}`, "utf8").toString("base64");
        await conv.command(`AUTH PLAIN ${token}`, "auth", [235]);
      } else if (/\bLOGIN\b/i.test(auth)) {
        await conv.command("AUTH LOGIN", "auth", [334]);
        await conv.command(Buffer.from(cfg.user, "utf8").toString("base64"), "auth-user", [334]);
        await conv.command(Buffer.from(cfg.pass, "utf8").toString("base64"), "auth", [235]);
      } else {
        throw new SmtpError("server offers no supported AUTH method", null, "auth");
      }

      const addr = (v: string) => v.replace(/^.*<([^>]+)>.*$/, "$1").trim();
      await conv.command(`MAIL FROM:<${addr(m.from)}>`, "mail", [250]);
      await conv.command(`RCPT TO:<${addr(m.to)}>`, "rcpt", [250, 251]);
      await conv.command("DATA", "data", [354]);
      conv.socket.write(`${data}\r\n.\r\n`);
      await conv.expect("data-end", [250]);
      conv.socket.write("QUIT\r\n");
    } finally {
      clearTimeout(timer);
      conv.socket.end();
    }
  }

  return { send };
}
