import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subprocessors | Entrepreneuria",
  description:
    "Third-party service providers used by Entrepreneuria Global, Inc.",
};

const subprocessors = [
  {
    name: "Supabase",
    purpose: "Authentication, database, file storage, and backend services",
    location: "United States / Global",
  },
  {
    name: "OpenAI",
    purpose: "AI model processing, content generation, image generation, and assistant features",
    location: "United States / Global",
  },
  {
    name: "Anthropic",
    purpose: "AI model processing, content generation, and assistant features",
    location: "United States / Global",
  },
  {
    name: "Google",
    purpose: "Authentication, calendar, email, workspace integrations, analytics, and AI services where enabled",
    location: "United States / Global",
  },
  {
    name: "Stripe",
    purpose: "Payment processing, subscriptions, invoices, and billing records",
    location: "United States / Global",
  },
  {
    name: "LinkedIn",
    purpose: "Connected social account authorization and user-approved publishing",
    location: "United States / Global",
  },
  {
    name: "Meta",
    purpose: "Connected Facebook and Instagram account authorization and publishing where enabled",
    location: "United States / Global",
  },
  {
    name: "X",
    purpose: "Connected X account authorization and publishing where enabled",
    location: "United States / Global",
  },
  {
    name: "Notion",
    purpose: "Workspace integrations, database syncing, and user-authorized productivity workflows",
    location: "United States / Global",
  },
  {
    name: "Hostinger",
    purpose: "Website and application hosting infrastructure",
    location: "Global",
  },
];

export default function SubprocessorsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl px-6 py-20">
        <h1 className="mb-8 text-5xl font-bold">Subprocessors</h1>

        <p className="mb-8 text-muted-foreground">
          <strong>Effective Date:</strong> June 24, 2026
        </p>

        <p className="mb-10 leading-8">
          Entrepreneuria Global, Inc. (&quot;Entrepreneuria&quot;,
          &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) uses certain
          third-party service providers, also known as subprocessors, to help
          provide, secure, support, and improve our websites, applications,
          AI-powered tools, integrations, and related services.
        </p>

        <section className="space-y-10">
          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              What Is a Subprocessor?
            </h2>

            <p className="leading-8">
              A subprocessor is a third-party provider that may process personal
              information, business data, uploaded content, account information,
              billing information, or usage data on behalf of Entrepreneuria in
              order to deliver the Services.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Current Subprocessors
            </h2>

            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full border-collapse text-left">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="border-b border-border px-5 py-4 font-semibold">
                      Provider
                    </th>
                    <th className="border-b border-border px-5 py-4 font-semibold">
                      Purpose
                    </th>
                    <th className="border-b border-border px-5 py-4 font-semibold">
                      Location
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {subprocessors.map((item) => (
                    <tr key={item.name} className="border-b border-border last:border-b-0">
                      <td className="px-5 py-4 font-medium">
                        {item.name}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {item.purpose}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {item.location}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              AI and Model Providers
            </h2>

            <p className="leading-8">
              Some Entrepreneuria features may send prompts, uploaded files,
              business information, generated drafts, or related context to AI
              providers as necessary to generate responses or complete
              requested actions. The specific provider used may depend on the
              product, feature, user settings, availability, or model selected
              by the user.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Connected Integrations
            </h2>

            <p className="leading-8">
              Users may choose to connect third-party platforms such as
              LinkedIn, Google, Meta, X, Notion, Stripe, or other supported
              services. These providers may process data according to their own
              terms, privacy policies, and security practices when users
              authorize those integrations.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Changes to Subprocessors
            </h2>

            <p className="leading-8">
              We may update this list as our Services evolve, as we add new
              integrations, or as we replace service providers. Material updates
              will be reflected on this page.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Questions
            </h2>

            <p className="leading-8">
              If you have questions about our subprocessors or how data is
              processed, please contact us.
            </p>

            <p className="mt-4 leading-8">
              Entrepreneuria Global, Inc.
              <br />
              Website: https://entrepreneuria.io
              <br />
              Email: privacy@entrepreneuria.io
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}