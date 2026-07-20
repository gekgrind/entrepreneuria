import { Metadata } from "next";
import { LegalShell } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "Security | Entrepreneuria",
  description: "Security practices for Entrepreneuria Global, Inc.",
};

export default function SecurityPage() {
  return (
    <LegalShell title="Security" date="Effective June 24, 2026">

        <p className="mb-10 leading-8">
          Entrepreneuria Global, Inc. (&quot;Entrepreneuria&quot;,
          &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) takes security
          seriously. This page describes the safeguards we use to protect our
          websites, applications, AI-powered tools, user accounts, connected
          integrations, and business data.
        </p>

        <section className="space-y-10">
          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Account Protection
            </h2>
            <p className="leading-8">
              We use authentication controls designed to help protect user
              accounts from unauthorized access. Users are responsible for
              maintaining the confidentiality of their login credentials and for
              promptly notifying us of any suspected unauthorized activity.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Data Protection
            </h2>
            <p className="leading-8">
              We use reasonable administrative, technical, and organizational
              safeguards to help protect personal information, business data,
              uploaded files, AI conversations, generated content, and connected
              account information from unauthorized access, loss, misuse, or
              disclosure.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Encryption
            </h2>
            <p className="leading-8">
              Where supported, we use secure transmission methods such as HTTPS
              to help protect information exchanged between your browser and our
              Services. Sensitive credentials, tokens, and secrets should be
              stored using secure server-side practices and should not be
              exposed in client-side code.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Connected Integrations
            </h2>
            <p className="leading-8">
              When users connect third-party services such as LinkedIn, Google,
              Meta, X, Stripe, Supabase, OpenAI, Anthropic, Notion, or other
              platforms, we request only the permissions needed to provide the
              requested features. Users may disconnect third-party integrations
              when they no longer wish to use them with our Services.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              AI Provider Security
            </h2>
            <p className="leading-8">
              Certain features may use third-party AI providers to process
              prompts, files, business information, and generated outputs. We
              aim to limit data shared with AI providers to what is reasonably
              necessary to provide the requested functionality.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Access Controls
            </h2>
            <p className="leading-8">
              We limit internal access to systems and information based on
              business need. Administrative access should be protected using
              strong credentials, secure authentication methods, and least-
              privilege principles wherever possible.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Infrastructure and Monitoring
            </h2>
            <p className="leading-8">
              We use hosting, database, authentication, storage, and monitoring
              providers to operate and protect the Services. We may monitor
              systems for errors, abuse, suspicious activity, availability
              issues, and performance concerns.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Payments
            </h2>
            <p className="leading-8">
              Payment information is processed by third-party payment providers.
              Entrepreneuria does not intend to store full credit card numbers
              on its own servers. Payment providers are responsible for handling
              payment information according to their own security standards and
              policies.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              User Responsibilities
            </h2>
            <ul className="list-disc space-y-2 pl-6 leading-8">
              <li>Use strong, unique passwords.</li>
              <li>Keep account recovery information current.</li>
              <li>Do not share login credentials or API keys.</li>
              <li>Review AI-generated content before publishing or relying on it.</li>
              <li>Disconnect third-party accounts you no longer use.</li>
              <li>Report suspected unauthorized access promptly.</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Security Limitations
            </h2>
            <p className="leading-8">
              No online service can guarantee absolute security. While we use
              reasonable safeguards, we cannot promise that unauthorized access,
              data loss, service interruptions, or security incidents will never
              occur.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Reporting Security Concerns
            </h2>
            <p className="leading-8">
              If you believe you have found a security issue, please contact us
              promptly so we can review and address it.
            </p>

            <p className="mt-4 leading-8">
              Entrepreneuria Global, Inc.
              <br />
              Website: https://entrepreneuria.io
              <br />
              Email: security@entrepreneuria.io
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Updates to This Page
            </h2>
            <p className="leading-8">
              We may update this Security page periodically to reflect changes
              in our practices, tools, infrastructure, or legal requirements.
            </p>
          </div>
        </section>
    </LegalShell>
  );
}
