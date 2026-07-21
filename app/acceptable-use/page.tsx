import { Metadata } from "next";
import { LegalShell } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "Acceptable Use Policy | Entrepreneuria",
  description:
    "Acceptable Use Policy for Entrepreneuria Global, Inc. and its AI-powered products.",
};

export default function AcceptableUsePage() {
  return (
    <LegalShell title="Acceptable Use Policy" date="Effective June 24, 2026">

        <p className="mb-10 leading-8">
          This Acceptable Use Policy ("Policy") describes the rules governing
          your use of the websites, applications, APIs, AI agents, automation
          tools, and services provided by Entrepreneuria Global, Inc.
          ("Entrepreneuria", "we", "our", or "us"), including Architecta,
          Prospra, Synceri, Directorium, and future Entrepreneuria products.
        </p>

        <section className="space-y-10">
          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Our Goal
            </h2>

            <p className="leading-8">
              Entrepreneuria exists to help entrepreneurs build successful
              businesses using AI responsibly. We expect every user to use our
              Services lawfully, ethically, and respectfully.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Prohibited Activities
            </h2>

            <p className="leading-8 mb-4">
              You may not use the Services to:
            </p>

            <ul className="list-disc space-y-2 pl-6 leading-8">
              <li>Violate any applicable law or regulation.</li>
              <li>Commit fraud or deceptive business practices.</li>
              <li>Generate phishing campaigns or impersonate individuals or organizations.</li>
              <li>Create or distribute malware, ransomware, spyware, or malicious code.</li>
              <li>Attempt unauthorized access to systems, networks, or accounts.</li>
              <li>Conduct hacking or cyberattacks.</li>
              <li>Promote violence, terrorism, or criminal activity.</li>
              <li>Generate unlawful or harmful content.</li>
              <li>Harass, threaten, intimidate, or abuse others.</li>
              <li>Violate another person's privacy or intellectual property rights.</li>
              <li>Generate or distribute spam or unsolicited communications.</li>
              <li>Circumvent platform safeguards or abuse rate limits.</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              AI Usage
            </h2>

            <p className="leading-8">
              AI-generated content should always be reviewed before publication
              or use. Users are solely responsible for verifying the accuracy,
              legality, originality, and appropriateness of AI-generated
              responses and ensuring they comply with applicable laws and
              third-party platform policies.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Social Media Automation
            </h2>

            <p className="leading-8">
              Services such as Architecta may assist with creating, scheduling,
              and publishing content to connected social media platforms.
              Users must comply with the terms, policies, and developer rules
              of each connected platform, including LinkedIn, Meta, X,
              YouTube, TikTok, and others.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Intellectual Property
            </h2>

            <p className="leading-8">
              Users may not upload, generate, distribute, or publish content
              that infringes copyrights, trademarks, patents, trade secrets,
              publicity rights, or other intellectual property rights without
              proper authorization.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Automated Abuse
            </h2>

            <p className="leading-8">
              You may not use bots, scripts, scraping tools, or automated
              systems to overload, interfere with, reverse engineer, or abuse
              the Services or attempt to gain unauthorized access to our
              infrastructure.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Account Security
            </h2>

            <ul className="list-disc space-y-2 pl-6 leading-8">
              <li>Protect your login credentials.</li>
              <li>Do not share your account.</li>
              <li>Do not share API keys or access tokens.</li>
              <li>Notify us promptly of suspected unauthorized access.</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Enforcement
            </h2>

            <p className="leading-8">
              We reserve the right to investigate suspected violations of this
              Policy and may suspend or terminate accounts, revoke access,
              remove content, or report unlawful activity to appropriate
              authorities where permitted or required by law.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Reporting Violations
            </h2>

            <p className="leading-8">
              If you believe someone is violating this Policy, please contact
              us with as much information as possible so we can investigate.
            </p>

            <div className="mt-6 rounded-lg border border-border bg-muted/30 p-6">
              <p className="font-semibold">
                Entrepreneuria Global, Inc.
              </p>

              <p className="mt-3">
                Website
                <br />
                https://entrepreneuria.io
              </p>

              <p className="mt-3">
                Email
                <br />
                abuse@entrepreneuria.io
              </p>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Changes to This Policy
            </h2>

            <p className="leading-8">
              We may update this Acceptable Use Policy periodically to reflect
              changes in our Services, legal requirements, security practices,
              or industry standards. Updated versions will be posted on this
              page with a revised effective date.
            </p>
          </div>
        </section>
    </LegalShell>
  );
}
