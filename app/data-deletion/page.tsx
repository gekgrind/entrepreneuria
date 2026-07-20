import { Metadata } from "next";
import { LegalShell } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "Data Deletion | Entrepreneuria",
  description:
    "Request deletion of your account and personal data from Entrepreneuria.",
};

export default function DataDeletionPage() {
  return (
    <LegalShell title="Data Deletion Request" date="Effective June 24, 2026">

        <p className="mb-10 leading-8">
          Entrepreneuria Global, Inc. ("Entrepreneuria", "we", "our", or "us")
          respects your privacy and your right to control your personal
          information. This page explains how you may request deletion of your
          account and associated data from our Services, including Architecta,
          Prospra, Synceri, Directorium, and future Entrepreneuria products.
        </p>

        <section className="space-y-10">

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Requesting Account Deletion
            </h2>

            <p className="leading-8">
              You may request deletion of your Entrepreneuria account and
              associated personal information at any time. Once your identity
              has been verified, we will begin processing your request in
              accordance with applicable laws and our data retention policies.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              What Will Be Deleted
            </h2>

            <ul className="list-disc space-y-2 pl-6 leading-8">
              <li>Your Entrepreneuria account.</li>
              <li>Your profile information.</li>
              <li>Business information you have provided.</li>
              <li>Uploaded documents and files.</li>
              <li>AI conversations and generated content, where applicable.</li>
              <li>Connected third-party account authorizations.</li>
              <li>User preferences and saved settings.</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Information We May Retain
            </h2>

            <p className="leading-8">
              Certain information may be retained when required to comply with
              legal obligations, resolve disputes, enforce our agreements,
              prevent fraud, protect the security of our Services, or satisfy
              financial or tax reporting requirements.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Connected Third-Party Accounts
            </h2>

            <p className="leading-8">
              If you have connected services such as LinkedIn, Google,
              Facebook, Instagram, X, TikTok, YouTube, Notion, Stripe, or
              other third-party platforms, deleting your Entrepreneuria account
              does not automatically delete your accounts with those providers.
              You should review the privacy settings of each provider if you
              wish to remove your data from those services.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Revoking Connected Accounts
            </h2>

            <p className="leading-8">
              You may disconnect third-party integrations at any time from your
              account settings. Disconnecting an integration revokes future
              access but does not automatically remove information that has
              already been processed or generated with your authorization.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Processing Time
            </h2>

            <p className="leading-8">
              We aim to process verified deletion requests within thirty (30)
              days, although certain requests may require additional time if
              permitted or required by applicable law.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              How to Submit a Request
            </h2>

            <p className="leading-8">
              To request deletion of your account and personal data, please
              contact us using the information below. Please include the email
              address associated with your Entrepreneuria account to help us
              verify your request.
            </p>

            <div className="mt-6 rounded-lg border border-border bg-muted/30 p-6">
              <p className="font-semibold">
                Entrepreneuria Global, Inc.
              </p>

              <p className="mt-3">
                Website:
                <br />
                https://entrepreneuria.io
              </p>

              <p className="mt-3">
                Email:
                <br />
                privacy@entrepreneuria.io
              </p>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Future Self-Service Deletion
            </h2>

            <p className="leading-8">
              Entrepreneuria plans to provide an in-app self-service account
              deletion feature, allowing users to permanently delete their
              accounts without contacting support.
            </p>
          </div>

        </section>
    </LegalShell>
  );
}
