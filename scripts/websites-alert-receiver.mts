/**
 * Entrypoint: Entrepreneuria Websites alert receiver on the app server.
 * Listens on 127.0.0.1 only and emails the owner through the existing
 * mailbox's SMTP submission. Deployment: docs/websites/ALERT-RECEIVER.md.
 *
 *   pm2 start "node --env-file=/etc/entrepreneuria/websites-alerts.env --import tsx scripts/websites-alert-receiver.mts" \
 *     --name websites-alerts --cwd /var/www/entrepreneuria-current
 *
 * Required env (never committed):
 *   ALERT_WEBHOOK_SECRET   same value as the app's WEBSITES_ALERT_WEBHOOK_SECRET (32+ chars)
 *   ALERT_EMAIL_TO         confirmed, monitored inbox (misti@entrepreneuria.io)
 *   ALERT_SMTP_HOST, ALERT_SMTP_PORT
 * Google Workspace SMTP relay (recommended; docs/websites/ALERT-RECEIVER.md):
 *   ALERT_SMTP_HOST=smtp-relay.gmail.com  ALERT_SMTP_PORT=587  ALERT_SMTP_AUTH=ip
 *   ALERT_SMTP_FAMILY=4 (connect from the allowlisted IPv4)
 * Optional:
 *   ALERT_EMAIL_FROM       default: ALERT_EMAIL_TO (the mailbox sends to itself)
 *   ALERT_SMTP_AUTH        ip | password (password needs ALERT_SMTP_USER/PASS)
 *   ALERT_SMTP_SECURITY    tls | starttls (default from port: 465 → tls, else starttls)
 *   ALERT_SMTP_HELO        EHLO name (FQDN); default: the sender's domain
 *   ALERT_RECEIVER_PORT    default 3105
 *
 * Sender and recipient must be on the same domain (alerts stay inside the
 * Workspace domain; the relay's "allowed senders" rule requires it anyway).
 */
import { createAlertReceiverServer } from "../lib/services/websites/alert-receiver-server";
import { createSmtpMailer, parseSmtpConfig } from "../lib/services/websites/smtp-mailer";

const env = process.env;
const problems: string[] = [];
const secret = env.ALERT_WEBHOOK_SECRET ?? "";
if (secret.length < 32) problems.push("ALERT_WEBHOOK_SECRET");
const to = env.ALERT_EMAIL_TO?.trim() ?? "";
if (!/^[^\s@<>]+@[^\s@<>]+\.[A-Za-z]{2,}$/.test(to)) problems.push("ALERT_EMAIL_TO");
const smtp = parseSmtpConfig(env);
problems.push(...smtp.problems);
const port = Number(env.ALERT_RECEIVER_PORT ?? "3105");
if (!Number.isInteger(port) || port < 1024 || port > 65535) problems.push("ALERT_RECEIVER_PORT");

if (problems.length || !smtp.config) {
  // Names only, never values.
  console.error(`[websites-alerts] refusing to start; missing or invalid: ${problems.join(", ")}`);
  process.exit(1);
}

const from = env.ALERT_EMAIL_FROM?.trim() || to;
const domainOf = (a: string) => a.split("@")[1]?.toLowerCase() ?? "";
if (!/^[^\s@<>]+@[^\s@<>]+\.[A-Za-z]{2,}$/.test(from) || domainOf(from) !== domainOf(to)) {
  console.error("[websites-alerts] refusing to start; ALERT_EMAIL_FROM must be an address on the same domain as ALERT_EMAIL_TO");
  process.exit(1);
}
createAlertReceiverServer({
  port,
  config: { secret, to, from },
  mailer: createSmtpMailer(smtp.config),
  log: (msg, meta) => console.log(`[websites-alerts] ${msg}`, JSON.stringify(meta ?? {})),
}).on("listening", () => console.log(`[websites-alerts] listening on 127.0.0.1:${port}`));
