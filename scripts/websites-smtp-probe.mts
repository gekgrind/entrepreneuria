/**
 * Synthetic email delivery test for the alert receiver's SMTP settings.
 * Run ON THE APP SERVER with the receiver's env file, so the connection comes
 * from the IP that Google Workspace allowlists. Contains no lead data.
 *
 *   node --env-file=/etc/entrepreneuria/websites-alerts.env --import tsx scripts/websites-smtp-probe.mts --check
 *     Stage 1: TLS, EHLO, IP authorization, sender and recipient accepted.
 *     Sends NOTHING (RSET before DATA).
 *   node --env-file=/etc/entrepreneuria/websites-alerts.env --import tsx scripts/websites-smtp-probe.mts
 *     Stage 2: sends one email "[Entrepreneuria Websites] [probe] SMTP delivery test <time>".
 *
 * Then stage 3, the full chain (app signer → receiver → SMTP), with
 * scripts/websites-alert-test.mts. Exit code 0 = success. Errors print the
 * SMTP stage, code and the server's reply line, never credentials.
 * Optional ALERT_SMTP_EXPECT_IP: the public IPv4 allowlisted in Google (probe only;
 * prints a note when the local address differs, e.g. behind NAT).
 */
import { createSmtpMailer, ehloName, parseSmtpConfig, SmtpError } from "../lib/services/websites/smtp-mailer";

const env = process.env;
const to = env.ALERT_EMAIL_TO?.trim() ?? "";
const from = env.ALERT_EMAIL_FROM?.trim() || to;
const smtp = parseSmtpConfig(env);
if (!smtp.config || !to) {
  console.error(`missing or invalid: ${[...smtp.problems, ...(to ? [] : ["ALERT_EMAIL_TO"])].join(", ")}`);
  process.exit(2);
}
const checkOnly = process.argv.includes("--check");
const cfg = smtp.config;
console.log(
  `host=${cfg.host}:${cfg.port} security=${cfg.security} auth=${cfg.auth} family=${cfg.family ?? "auto"} ehlo=${ehloName(cfg, from)} from=${from} to=${to}`
);

const expectIp = env.ALERT_SMTP_EXPECT_IP?.trim() ?? "";
const mailer = createSmtpMailer(cfg);
try {
  if (checkOnly) {
    const info = await mailer.check(from, to);
    console.log(`connected: ${info.family} ${info.localAddress} -> ${info.remoteAddress}`);
    if (info.tlsProtocol) console.log(`tls: ${info.tlsProtocol}, certificate verified, subject=${info.certSubject} issuer=${info.certIssuer}`);
    if (expectIp && info.localAddress !== expectIp) {
      console.log(`NOTE: local address ${info.localAddress} differs from ALERT_SMTP_EXPECT_IP=${expectIp} (normal behind NAT; Google sees the public address).`);
    }
    console.log(`OK: ${cfg.security === "none" ? "connected (loopback test, no TLS)" : "TLS established"}, server accepted the sender and recipient. Nothing was sent.`);
  } else {
    const at = new Date().toISOString();
    await mailer.send({
      from,
      to,
      subject: `[Entrepreneuria Websites] [probe] SMTP delivery test ${at}`,
      text: `Synthetic delivery test from the alert receiver's server at ${at}.\nIf this arrived in the inbox (not spam), SMTP delivery works. No visitor data.`,
    });
    console.log(`OK: sent at ${at}. Confirm it arrived in ${to}'s inbox (check spam too) and record the arrival time.`);
  }
} catch (err) {
  if (err instanceof SmtpError) {
    console.error(`FAILED at ${err.stage}${err.code ? ` (${err.code})` : ""}: ${err.message}`);
    if (err.reply) console.error(`server said: ${err.reply}`);
    if (err.stage === "connect") console.error("Hint: the connection used the wrong address family. Keep ALERT_SMTP_FAMILY=4 for an IPv4 relay rule.");
    if (err.stage === "starttls" || err.stage === "tls") console.error("Hint: TLS failed or the certificate did not verify. Check the system CA store (ca-certificates) and the clock.");
    if (err.code === 550 || err.code === 553 || err.code === 554)
      console.error("Hint: the relay denied this IP or sender. Check the relay rule's IP (must be the VPS's public IPv4), 'Only registered Apps users', and that ALERT_EMAIL_FROM is a real mailbox in the domain.");
    if (err.code === 530) console.error("Hint: the relay wants TLS or SMTP AUTH. Keep STARTTLS; leave 'Require SMTP Authentication' unchecked for IP auth.");
    if (err.code === 421) console.error("Hint: 421 means the EHLO name was rejected or the IP is rate limited; wait and retry once.");
  } else console.error(`FAILED: ${(err as Error).message}`);
  process.exit(1);
}
