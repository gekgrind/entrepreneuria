/**
 * Sends one signed synthetic `test` alert to the configured receiver, exactly
 * as the app would. Use it to verify delivery end to end (gate
 * leads-failure-alerts). Contains no lead data.
 *
 *   WEBSITES_ALERT_WEBHOOK_URL=http://127.0.0.1:3105/alerts \
 *   WEBSITES_ALERT_WEBHOOK_SECRET=... \
 *   npx tsx scripts/websites-alert-test.mts [environment]
 *
 * Exit 0 when the receiver answered 2xx. The email should arrive within a minute.
 */
import { createAlerter } from "../lib/services/websites/alerts";
import { parseAlertWebhookUrl } from "../lib/services/websites/leads-config";

const url = process.env.WEBSITES_ALERT_WEBHOOK_URL ?? "";
const secret = process.env.WEBSITES_ALERT_WEBHOOK_SECRET ?? "";
if (!parseAlertWebhookUrl(url) || secret.length < 32) {
  console.error("Set WEBSITES_ALERT_WEBHOOK_URL (https, or http://127.0.0.1) and WEBSITES_ALERT_WEBHOOK_SECRET (32+ characters).");
  process.exit(2);
}

let status: number | string = "none";
const alerter = createAlerter({
  url,
  secret,
  environment: process.argv[2] ?? "staging",
  fetch: async (input, init) => {
    const res = await fetch(input, init);
    status = res.status;
    return res;
  },
  log: (msg, meta) => console.error(msg, meta),
});
alerter.raise({ event: "test", step: "manual", status: "check" });
await alerter.settled();
console.log(`receiver answered: ${status}`);
process.exit(typeof status === "number" && status >= 200 && status < 300 ? 0 : 1);
