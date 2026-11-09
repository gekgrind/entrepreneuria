import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import tls from "node:tls";

import { buildMessage, createSmtpMailer, ehloName, parseSmtpConfig, SmtpError } from "./smtp-mailer";

const MSG = { from: "owner@example.test", to: "owner@example.test", subject: "[Entrepreneuria Websites] Test alert", text: "Line one\nLine two" };

interface Transcript {
  lines: string[];
  data: string;
}

/**
 * Scripted SMTP server. `mode`: "plain" (no TLS), "starttls" (upgrades on
 * STARTTLS), "tls" (implicit TLS listener). `auth` = the AUTH line offered.
 */
function fakeSmtp(opts: {
  mode: "plain" | "starttls" | "tls";
  auth?: string;
  offerStartTls?: boolean;
  acceptAuth?: boolean;
  silent?: boolean;
  cert?: { key: Buffer; cert: Buffer };
  /** Behave like Google Workspace SMTP relay with IP auth for this domain. */
  relayDomain?: string;
}) {
  const transcript: Transcript = { lines: [], data: "" };
  const handle = (sock: net.Socket, secured: boolean) => {
    let inData = false;
    let loginStep = 0;
    let buf = "";
    const say = (s: string) => sock.write(`${s}\r\n`);
    if (!opts.silent && !secured) say("220 fake ESMTP");
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let i: number;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            say("250 queued");
          } else transcript.data += `${line}\r\n`;
          continue;
        }
        transcript.lines.push(line);
        if (loginStep === 1) {
          loginStep = 2;
          say("334 UGFzc3dvcmQ6");
          continue;
        }
        if (loginStep === 2) {
          loginStep = 0;
          say(opts.acceptAuth === false ? "535 bad credentials" : "235 ok");
          continue;
        }
        const up = line.toUpperCase();
        if (opts.relayDomain && up.startsWith("EHLO") && /^EHLO\s+(localhost|\[?127\.)/i.test(line)) {
          say("421-4.7.0 Try again later, closing connection. (EHLO)\r\n421 4.7.0 https://support.google.com/a/answer/3221692");
          sock.end();
          return;
        }
        if (opts.relayDomain && up.startsWith("MAIL FROM") && !line.toLowerCase().includes(`@${opts.relayDomain}>`)) {
          say("550 5.7.0 Mail relay denied");
          continue;
        }
        if (opts.relayDomain && (up.startsWith("MAIL FROM") || up.startsWith("AUTH")) && opts.mode === "starttls" && !secured) {
          say("530 5.7.0 Must issue a STARTTLS command first");
          continue;
        }
        if (up.startsWith("EHLO")) {
          const caps = ["250-fake"];
          if (opts.mode === "starttls" && !secured && opts.offerStartTls !== false) caps.push("250-STARTTLS");
          if (!opts.relayDomain && (opts.mode !== "starttls" || secured)) caps.push(`250-${opts.auth ?? "AUTH PLAIN LOGIN"}`);
          caps.push("250 8BITMIME");
          say(caps.join("\r\n"));
        } else if (up === "STARTTLS") {
          say("220 go ahead");
          sock.removeAllListeners("data");
          const s = new tls.TLSSocket(sock, { isServer: true, key: opts.cert!.key, cert: opts.cert!.cert });
          handle(s, true);
          return;
        } else if (up.startsWith("AUTH PLAIN")) say(opts.acceptAuth === false ? "535 bad credentials" : "235 ok");
        else if (up === "AUTH LOGIN") {
          loginStep = 1;
          say("334 VXNlcm5hbWU6");
        } else if (up.startsWith("MAIL FROM") || up.startsWith("RCPT TO")) say("250 ok");
        else if (up === "DATA") {
          inData = true;
          say("354 send");
        } else if (up === "RSET") say("250 reset");
        else if (up === "QUIT") {
          say("221 bye");
          sock.end();
        } else say("500 what");
      }
    });
    sock.on("error", () => {});
  };
  const server =
    opts.mode === "tls"
      ? tls.createServer({ key: opts.cert!.key, cert: opts.cert!.cert }, (s) => {
          if (!opts.silent) s.write("220 fake ESMTP\r\n");
          handle(s, true);
        })
      : net.createServer((s) => handle(s, false));
  return new Promise<{ port: number; transcript: Transcript; close: () => Promise<void> }>((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({
        port: (server.address() as net.AddressInfo).port,
        transcript,
        close: () => new Promise((r) => server.close(() => r())),
      })
    )
  );
}

const decodeBody = (data: string) => {
  const [, body] = data.split("\r\n\r\n");
  return Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8");
};

describe("SMTP mailer: protocol (loopback, no TLS)", () => {
  it("sends with AUTH PLAIN: envelope, headers and a base64 body", async () => {
    const srv = await fakeSmtp({ mode: "plain" });
    try {
      await createSmtpMailer({ host: "127.0.0.1", port: srv.port, security: "none", auth: "password", user: "owner@example.test", pass: "app-pass" }).send(MSG);
      const t = srv.transcript;
      const auth = t.lines.find((l) => l.startsWith("AUTH PLAIN"))!;
      assert.equal(Buffer.from(auth.split(" ")[2], "base64").toString(), "\u0000owner@example.test\u0000app-pass");
      assert.ok(t.lines.includes("MAIL FROM:<owner@example.test>"));
      assert.ok(t.lines.includes("RCPT TO:<owner@example.test>"));
      assert.match(t.data, /^Subject: \[Entrepreneuria Websites\] Test alert\r$/m);
      assert.match(t.data, /^Content-Transfer-Encoding: base64\r$/m);
      assert.match(t.data, /^Auto-Submitted: auto-generated\r$/m);
      assert.equal(decodeBody(t.data), "Line one\r\nLine two");
    } finally {
      await srv.close();
    }
  });

  it("falls back to AUTH LOGIN when that is all the server offers", async () => {
    const srv = await fakeSmtp({ mode: "plain", auth: "AUTH LOGIN XOAUTH2" });
    try {
      await createSmtpMailer({ host: "127.0.0.1", port: srv.port, security: "none", auth: "password", user: "u@example.test", pass: "p" }).send(MSG);
      assert.ok(srv.transcript.lines.includes("AUTH LOGIN"));
      assert.ok(srv.transcript.lines.includes(Buffer.from("u@example.test").toString("base64")));
    } finally {
      await srv.close();
    }
  });

  it("a rejected login fails the send (so the receiver answers 502 and the app retries)", async () => {
    const srv = await fakeSmtp({ mode: "plain", acceptAuth: false });
    try {
      await assert.rejects(
        createSmtpMailer({ host: "127.0.0.1", port: srv.port, security: "none", auth: "password", user: "u", pass: "wrong" }).send(MSG),
        (e: unknown) => e instanceof SmtpError && e.stage === "auth" && e.code === 535
      );
      assert.equal(srv.transcript.data, "", "nothing sent");
    } finally {
      await srv.close();
    }
  });

  it("a silent server times out instead of hanging", async () => {
    const srv = await fakeSmtp({ mode: "plain", silent: true });
    try {
      await assert.rejects(
        createSmtpMailer({ host: "127.0.0.1", port: srv.port, security: "none", auth: "password", user: "u", pass: "p", timeoutMs: 100 }).send(MSG),
        SmtpError
      );
    } finally {
      await srv.close();
    }
  });

  it("refuses header injection", () => {
    assert.throws(() => buildMessage({ ...MSG, subject: "x\r\nBcc: victim@example.test" }), SmtpError);
  });

  it("non-ASCII subjects are RFC 2047 encoded", () => {
    assert.match(buildMessage({ ...MSG, subject: "Café alert" }), /^Subject: =\?UTF-8\?B\?/m);
  });
});

describe("SMTP mailer: configuration", () => {
  it("password mode requires credentials; plain SMTP to a remote host is refused", () => {
    assert.deepEqual(parseSmtpConfig({ ALERT_SMTP_AUTH: "password" }).problems.sort(), ["ALERT_SMTP_HOST", "ALERT_SMTP_PASS", "ALERT_SMTP_PORT", "ALERT_SMTP_USER"]);
    const base = { ALERT_SMTP_HOST: "smtp.example.test", ALERT_SMTP_PORT: "587", ALERT_SMTP_USER: "u", ALERT_SMTP_PASS: "p" };
    assert.equal(parseSmtpConfig(base).config!.auth, "password");
    assert.equal(parseSmtpConfig(base).config!.security, "starttls");
    assert.equal(parseSmtpConfig({ ...base, ALERT_SMTP_PORT: "465" }).config!.security, "tls");
    assert.deepEqual(parseSmtpConfig({ ...base, ALERT_SMTP_SECURITY: "none" }).problems, ["ALERT_SMTP_SECURITY"]);
    assert.throws(() => createSmtpMailer({ host: "smtp.example.test", port: 25, security: "none", auth: "password", user: "u", pass: "p" }));
  });

  it("Google Workspace relay settings parse to IP auth over STARTTLS with IPv4, and hold no secret", () => {
    const r = parseSmtpConfig({ ALERT_SMTP_HOST: "smtp-relay.gmail.com", ALERT_SMTP_PORT: "587", ALERT_SMTP_AUTH: "ip", ALERT_SMTP_FAMILY: "4" });
    assert.deepEqual(r.problems, []);
    assert.deepEqual(r.config, { host: "smtp-relay.gmail.com", port: 587, security: "starttls", auth: "ip", heloName: undefined, family: 4 });
    assert.equal(parseSmtpConfig({ ALERT_SMTP_HOST: "smtp-relay.gmail.com", ALERT_SMTP_PORT: "587" }).config!.auth, "ip", "default without a user");
  });

  it("refuses ambiguous or unsafe settings", () => {
    const relay = { ALERT_SMTP_HOST: "smtp-relay.gmail.com", ALERT_SMTP_PORT: "587" };
    assert.deepEqual(parseSmtpConfig({ ...relay, ALERT_SMTP_AUTH: "ip", ALERT_SMTP_PASS: "x" }).problems, ["ALERT_SMTP_AUTH"]);
    assert.deepEqual(parseSmtpConfig({ ...relay, ALERT_SMTP_HELO: "localhost" }).problems, ["ALERT_SMTP_HELO"]);
    assert.deepEqual(parseSmtpConfig({ ...relay, ALERT_SMTP_HELO: "not a host" }).problems, ["ALERT_SMTP_HELO"]);
    assert.deepEqual(parseSmtpConfig({ ...relay, ALERT_SMTP_FAMILY: "5" }).problems, ["ALERT_SMTP_FAMILY"]);
    assert.deepEqual(parseSmtpConfig({ ...relay, ALERT_SMTP_SECURITY: "none" }).problems, ["ALERT_SMTP_SECURITY"]);
  });

  it("EHLO name: explicit, else the sender's domain, never localhost to a remote server", () => {
    assert.equal(ehloName({ host: "smtp-relay.gmail.com" }, "misti@entrepreneuria.io"), "entrepreneuria.io");
    assert.equal(ehloName({ host: "smtp-relay.gmail.com", heloName: "vps.entrepreneuria.io" }, "misti@entrepreneuria.io"), "vps.entrepreneuria.io");
    assert.throws(() => ehloName({ host: "smtp-relay.gmail.com" }, "misti@localhost"), SmtpError);
  });
});

/* TLS tests need openssl to make a throwaway certificate; skipped where it is missing. */
let cert: { key: Buffer; cert: Buffer } | null = null;
let certDir = "";
const hasOpenssl = (() => {
  try {
    execFileSync("openssl", ["version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("SMTP mailer: TLS (verified certificates)", { skip: !hasOpenssl && "openssl not available" }, () => {
  before(() => {
    certDir = mkdtempSync(path.join(tmpdir(), "smtp-cert-"));
    execFileSync(
      "openssl",
      ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost",
        "-keyout", path.join(certDir, "key.pem"), "-out", path.join(certDir, "cert.pem")],
      { stdio: "ignore" }
    );
    cert = { key: readFileSync(path.join(certDir, "key.pem")), cert: readFileSync(path.join(certDir, "cert.pem")) };
  });
  after(() => rmSync(certDir, { recursive: true, force: true }));

  it("STARTTLS: upgrades before AUTH, then sends", async () => {
    const srv = await fakeSmtp({ mode: "starttls", cert: cert! });
    try {
      await createSmtpMailer({ host: "localhost", port: srv.port, security: "starttls", auth: "password", user: "u", pass: "p", tlsOptions: { ca: cert!.cert } }).send(MSG);
      const i = srv.transcript.lines.indexOf("STARTTLS");
      const j = srv.transcript.lines.findIndex((l) => l.startsWith("AUTH"));
      assert.ok(i >= 0 && j > i, "AUTH only after the upgrade");
      assert.equal(decodeBody(srv.transcript.data), "Line one\r\nLine two");
    } finally {
      await srv.close();
    }
  });

  it("STARTTLS required: a server that doesn't offer it never sees credentials", async () => {
    const srv = await fakeSmtp({ mode: "starttls", offerStartTls: false, cert: cert! });
    try {
      await assert.rejects(
        createSmtpMailer({ host: "localhost", port: srv.port, security: "starttls", auth: "password", user: "u", pass: "p", tlsOptions: { ca: cert!.cert } }).send(MSG),
        (e: unknown) => e instanceof SmtpError && e.stage === "starttls"
      );
      assert.ok(!srv.transcript.lines.some((l) => l.startsWith("AUTH")));
    } finally {
      await srv.close();
    }
  });

  it("implicit TLS (465) sends", async () => {
    const srv = await fakeSmtp({ mode: "tls", cert: cert! });
    try {
      await createSmtpMailer({ host: "localhost", port: srv.port, security: "tls", auth: "password", user: "u", pass: "p", tlsOptions: { ca: cert!.cert } }).send(MSG);
      assert.ok(srv.transcript.lines.some((l) => l.startsWith("AUTH PLAIN")));
    } finally {
      await srv.close();
    }
  });

  it("Google relay emulation (IP auth): STARTTLS first, EHLO with the sender's domain, no AUTH, in-domain sender accepted", async () => {
    const srv = await fakeSmtp({ mode: "starttls", cert: cert!, relayDomain: "entrepreneuria.io" });
    try {
      const m = { ...MSG, from: "misti@entrepreneuria.io", to: "misti@entrepreneuria.io" };
      await createSmtpMailer({ host: "localhost", port: srv.port, security: "starttls", auth: "ip", family: 4, tlsOptions: { ca: cert!.cert } }).send(m);
      const t = srv.transcript.lines;
      assert.deepEqual(t.filter((l) => l.startsWith("EHLO")), ["EHLO entrepreneuria.io", "EHLO entrepreneuria.io"]);
      assert.ok(!t.some((l) => l.startsWith("AUTH")), "IP auth sends no credentials");
      assert.ok(t.indexOf("STARTTLS") < t.indexOf("MAIL FROM:<misti@entrepreneuria.io>"));
      assert.equal(decodeBody(srv.transcript.data), "Line one\r\nLine two");
    } finally {
      await srv.close();
    }
  });

  it("Google relay emulation: an out-of-domain sender is denied and the send fails (receiver answers 502)", async () => {
    const srv = await fakeSmtp({ mode: "starttls", cert: cert!, relayDomain: "entrepreneuria.io" });
    try {
      await assert.rejects(
        createSmtpMailer({ host: "localhost", port: srv.port, security: "starttls", auth: "ip", heloName: "entrepreneuria.io", tlsOptions: { ca: cert!.cert } }).send({ ...MSG, from: "alerts@other.example" }),
        (e: unknown) => e instanceof SmtpError && e.stage === "mail" && e.code === 550
      );
    } finally {
      await srv.close();
    }
  });

  it("Google relay emulation: a client that says EHLO localhost gets 421 (why the EHLO name matters)", async () => {
    const srv = await fakeSmtp({ mode: "starttls", cert: cert!, relayDomain: "entrepreneuria.io" });
    try {
      const sock = net.connect({ host: "127.0.0.1", port: srv.port });
      const reply = await new Promise<string>((resolve) => {
        let buf = "";
        sock.on("data", (c) => {
          buf += c.toString();
          if (buf.includes("220 fake") && !buf.includes("EHLO-sent")) {
            buf += "EHLO-sent";
            sock.write("EHLO localhost\r\n");
          }
          if (/421 4\.7\.0/.test(buf)) resolve(buf);
        });
      });
      sock.destroy();
      assert.match(reply, /421-4\.7\.0 Try again later/);
    } finally {
      await srv.close();
    }
  });

  it("check(): proves the relay accepts sender and recipient, then sends nothing", async () => {
    const srv = await fakeSmtp({ mode: "starttls", cert: cert!, relayDomain: "entrepreneuria.io" });
    try {
      const mailer = createSmtpMailer({ host: "localhost", port: srv.port, security: "starttls", auth: "ip", tlsOptions: { ca: cert!.cert } });
      await mailer.check("misti@entrepreneuria.io", "misti@entrepreneuria.io");
      assert.ok(srv.transcript.lines.includes("RCPT TO:<misti@entrepreneuria.io>"));
      assert.ok(srv.transcript.lines.includes("RSET"));
      assert.ok(!srv.transcript.lines.includes("DATA"), "no message sent");
      await assert.rejects(mailer.check("alerts@other.example", "misti@entrepreneuria.io"), (e: unknown) => e instanceof SmtpError && e.code === 550);
    } finally {
      await srv.close();
    }
  });

  it("an untrusted certificate is refused (verification stays on)", async () => {
    const srv = await fakeSmtp({ mode: "tls", cert: cert! });
    try {
      await assert.rejects(createSmtpMailer({ host: "localhost", port: srv.port, security: "tls", auth: "password", user: "u", pass: "p", timeoutMs: 2000 }).send(MSG));
      assert.ok(!srv.transcript.lines.some((l) => l.startsWith("AUTH")));
    } finally {
      await srv.close();
    }
  });
});
