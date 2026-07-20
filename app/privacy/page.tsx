import { Metadata } from "next";
import { LegalShell } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy | Entrepreneuria",
  description: "Privacy Policy for Entrepreneuria Global, Inc.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" date="Effective June 24, 2026">

        <p className="mb-10 leading-8">
          Entrepreneuria Global, Inc. ("Entrepreneuria", "we", "our", or "us")
          values your privacy. This Privacy Policy explains how we collect,
          use, protect, and disclose information when you use our websites,
          applications, and AI-powered services, including Architecta,
          Prospra, Synceri, Directorium, and any future Entrepreneuria
          products (collectively, the "Services").
        </p>

        <section className="space-y-10">

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Information We Collect
            </h2>

            <ul className="list-disc space-y-2 pl-6 leading-8">
              <li>Name and account information</li>
              <li>Email address</li>
              <li>Authentication information</li>
              <li>Business profile information</li>
              <li>Uploaded documents and files</li>
              <li>AI conversations and prompts</li>
              <li>Generated content</li>
              <li>Subscription and billing information</li>
              <li>Usage analytics</li>
              <li>Device and browser information</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              How We Use Information
            </h2>

            <p className="leading-8">
              We use your information to provide our Services, improve AI
              responses, personalize your experience, create content,
              authenticate users, process subscriptions, provide customer
              support, enhance security, and comply with legal obligations.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              AI Processing
            </h2>

            <p className="leading-8">
              Certain requests may be processed using third-party AI providers
              including OpenAI, Anthropic, Google, and other providers selected
              by the user. Information sent to these providers is limited to
              what is necessary to generate responses or perform requested
              actions.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Connected Accounts
            </h2>

            <p className="leading-8">
              If you connect social media accounts such as LinkedIn, Facebook,
              Instagram, X, YouTube, TikTok, or other supported platforms,
              Entrepreneuria only accesses the permissions that you explicitly
              authorize. Connected accounts may be used to publish content,
              retrieve information, or automate workflows that you request.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Data Sharing
            </h2>

            <p className="leading-8">
              We do not sell your personal information. Information may be
              shared only with trusted service providers necessary to operate
              our Services, including cloud hosting, payment processors,
              authentication providers, AI providers, and analytics platforms.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Data Security
            </h2>

            <p className="leading-8">
              We employ commercially reasonable administrative, technical, and
              physical safeguards designed to protect your information from
              unauthorized access, disclosure, alteration, or destruction.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Your Rights
            </h2>

            <p className="leading-8">
              Depending on your jurisdiction, you may have the right to access,
              correct, delete, export, or restrict the processing of your
              personal information. You may also withdraw consent for connected
              third-party accounts at any time.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Cookies
            </h2>

            <p className="leading-8">
              We use cookies and similar technologies to improve functionality,
              remember preferences, analyze usage, and enhance the overall user
              experience.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Children's Privacy
            </h2>

            <p className="leading-8">
              Our Services are not directed toward children under the age of 13,
              and we do not knowingly collect personal information from
              children.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Changes to This Policy
            </h2>

            <p className="leading-8">
              We may update this Privacy Policy periodically. Material changes
              will be posted on this page with an updated effective date.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Contact Us
            </h2>

            <p className="leading-8">
              Entrepreneuria Global, Inc.
              <br />
              Website: https://entrepreneuria.io
              <br />
              Email: privacy@entrepreneuria.io
            </p>
          </div>

        </section>
    </LegalShell>
  );
}
