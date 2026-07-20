import { Metadata } from "next";
import { LegalShell } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "Cookie Policy | Entrepreneuria",
  description: "Cookie Policy for Entrepreneuria Global, Inc.",
};

export default function CookiePolicyPage() {
  return (
    <LegalShell title="Cookie Policy" date="Effective June 24, 2026">

        <p className="mb-10 leading-8">
          This Cookie Policy explains how Entrepreneuria Global, Inc.
          (&quot;Entrepreneuria&quot;, &quot;we&quot;, &quot;our&quot;, or
          &quot;us&quot;) uses cookies and similar technologies across our
          websites, applications, and AI-powered services, including Architecta,
          Prospra, Synceri, Directorium, and future Entrepreneuria products
          collectively referred to as the &quot;Services&quot;.
        </p>

        <section className="space-y-10">
          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              What Are Cookies?
            </h2>

            <p className="leading-8">
              Cookies are small text files stored on your device when you visit
              a website or use an online service. They help websites remember
              preferences, keep users signed in, improve functionality, and
              understand how people use the Services.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              How We Use Cookies
            </h2>

            <p className="leading-8">
              We use cookies and similar technologies to operate the Services,
              authenticate users, remember preferences, improve performance,
              analyze usage, protect against fraud or abuse, and support
              marketing or product improvements.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Types of Cookies We May Use
            </h2>

            <ul className="list-disc space-y-2 pl-6 leading-8">
              <li>
                <strong>Essential cookies:</strong> Required for core features
                such as login, authentication, account security, and service
                navigation.
              </li>
              <li>
                <strong>Preference cookies:</strong> Remember choices such as
                display settings, saved preferences, and user experience
                customizations.
              </li>
              <li>
                <strong>Analytics cookies:</strong> Help us understand usage,
                improve performance, identify errors, and make the Services
                better.
              </li>
              <li>
                <strong>Security cookies:</strong> Help detect fraud, abuse,
                suspicious activity, and unauthorized access attempts.
              </li>
              <li>
                <strong>Marketing cookies:</strong> May be used to measure
                campaigns, understand engagement, or show relevant information
                about Entrepreneuria products and services.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Similar Technologies
            </h2>

            <p className="leading-8">
              We may also use local storage, session storage, pixels, tags,
              device identifiers, log files, and other similar technologies to
              provide functionality, remember settings, measure performance, and
              improve the Services.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Third-Party Cookies
            </h2>

            <p className="leading-8">
              Some cookies or similar technologies may be placed by third-party
              providers that help us operate the Services. These may include
              authentication providers, payment processors, analytics tools,
              hosting providers, customer support tools, advertising platforms,
              and connected integrations such as LinkedIn, Google, Meta, X,
              Stripe, Supabase, OpenAI, Anthropic, or other service providers.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Managing Cookies
            </h2>

            <p className="leading-8">
              You can usually control or disable cookies through your browser
              settings. Some browsers also allow you to delete existing cookies,
              block third-party cookies, or receive alerts before cookies are
              stored. Disabling certain cookies may affect how the Services
              function.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Browser Controls
            </h2>

            <p className="leading-8">
              Most browsers provide cookie controls in their privacy or security
              settings. Because each browser is different, review your
              browser&apos;s help menu or settings area for instructions on how
              to manage cookies on your device.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Do Not Track
            </h2>

            <p className="leading-8">
              Some browsers offer a &quot;Do Not Track&quot; signal. Because
              there is no consistent industry standard for responding to these
              signals, our Services may not respond to Do Not Track requests in
              a uniform way.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Updates to This Cookie Policy
            </h2>

            <p className="leading-8">
              We may update this Cookie Policy from time to time to reflect
              changes in technology, legal requirements, or our Services. Any
              updates will be posted on this page with a revised effective date.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">Contact Us</h2>

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
