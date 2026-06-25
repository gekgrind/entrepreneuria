import { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  Lock,
  FileText,
  Cookie,
  Trash2,
  BrainCircuit,
  Globe,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Trust Center | Entrepreneuria",
  description:
    "Learn how Entrepreneuria protects your privacy, secures your data, and builds trustworthy AI-powered software.",
};

const resources = [
  {
    title: "Privacy Policy",
    description:
      "Learn what information we collect, how we use it, and how we protect your privacy.",
    href: "/privacy",
    icon: Shield,
  },
  {
    title: "Terms of Service",
    description:
      "Review the terms governing the use of Entrepreneuria and its AI-powered applications.",
    href: "/terms",
    icon: FileText,
  },
  {
    title: "Cookie Policy",
    description:
      "Understand how cookies and similar technologies improve your experience.",
    href: "/cookies",
    icon: Cookie,
  },
  {
    title: "Security",
    description:
      "Discover the security measures we use to protect your data and connected accounts.",
    href: "/security",
    icon: Lock,
  },
  {
    title: "Data Deletion",
    description:
      "Request deletion of your account and learn how we process deletion requests.",
    href: "/data-deletion",
    icon: Trash2,
  },
];

export default function TrustCenterPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center rounded-full border border-border bg-muted/30 px-4 py-2 text-sm">
            <Shield className="mr-2 h-4 w-4" />
            Trust Center
          </div>

          <h1 className="mb-6 text-5xl font-bold tracking-tight">
            Trust is the foundation of everything we build.
          </h1>

          <p className="text-lg leading-8 text-muted-foreground">
            Entrepreneuria is committed to protecting your privacy,
            securing your information, and building AI-powered tools
            responsibly. This Trust Center provides access to our
            policies, security practices, and transparency resources.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {resources.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary hover:shadow-lg"
              >
                <Icon className="mb-5 h-8 w-8 text-primary" />

                <h2 className="mb-3 text-2xl font-semibold">
                  {item.title}
                </h2>

                <p className="mb-6 leading-7 text-muted-foreground">
                  {item.description}
                </p>

                <div className="inline-flex items-center font-medium text-primary">
                  Learn More
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>

        <section className="mt-20 rounded-2xl border border-border bg-muted/30 p-10">
          <div className="flex items-center gap-3">
            <BrainCircuit className="h-8 w-8 text-primary" />
            <h2 className="text-3xl font-bold">
              Responsible AI
            </h2>
          </div>

          <p className="mt-6 leading-8 text-muted-foreground">
            Entrepreneuria combines advanced AI models from providers
            such as OpenAI, Anthropic, and other trusted partners.
            AI-generated responses should always be reviewed before
            being relied upon or published. Our goal is to augment
            human decision-making, not replace it.
          </p>
        </section>

        <section className="mt-10 rounded-2xl border border-border bg-muted/30 p-10">
          <div className="flex items-center gap-3">
            <Globe className="h-8 w-8 text-primary" />
            <h2 className="text-3xl font-bold">
              Our Commitment
            </h2>
          </div>

          <ul className="mt-6 list-disc space-y-3 pl-6 leading-8 text-muted-foreground">
            <li>We do not sell your personal information.</li>
            <li>We request only the permissions necessary to provide requested features.</li>
            <li>You remain in control of your connected accounts.</li>
            <li>You can request deletion of your account and personal data.</li>
            <li>We continuously improve our security practices and platform safeguards.</li>
          </ul>
        </section>

        <section className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-10">
          <h2 className="text-3xl font-bold">
            Questions?
          </h2>

          <p className="mt-4 max-w-2xl leading-8 text-muted-foreground">
            If you have questions about security, privacy,
            compliance, or your data, we're here to help.
          </p>

          <div className="mt-8 space-y-2">
            <p>
              <strong>General:</strong> support@entrepreneuria.io
            </p>
            <p>
              <strong>Privacy:</strong> privacy@entrepreneuria.io
            </p>
            <p>
              <strong>Security:</strong> security@entrepreneuria.io
            </p>
            <p>
              <strong>Legal:</strong> legal@entrepreneuria.io
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}