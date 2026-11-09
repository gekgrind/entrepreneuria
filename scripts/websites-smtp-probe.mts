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
 * SMTP stage and code only, never credentials.
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

const mailer = createSmtpMailer(cfg);
try {
  if (checkOnly) {
    await mailer.check(from, to);
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
    if (err.code === 550) console.error("Hint: the relay denied this sender or IP. Check the SMTP relay rule's IP list and allowed senders.");
    if (err.code === 421) console.error("Hint: 421 at EHLO usually means the EHLO name was rejected or the IP is rate limited.");
  } else console.error(`FAILED: ${(err as Error).message}`);
  process.exit(1);
}
