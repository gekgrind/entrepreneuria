import { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  BrainCircuit,
  FileText,
  Cookie,
  Trash2,
  Scale,
  CheckCircle2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Compliance | Entrepreneuria",
  description:
    "Learn about Entrepreneuria's privacy, security, AI governance, and compliance practices.",
};

const resources = [
  {
    title: "Privacy Policy",
    href: "/privacy",
    icon: Lock,
  },
  {
    title: "Terms of Service",
    href: "/terms",
    icon: FileText,
  },
  {
    title: "Cookie Policy",
    href: "/cookies",
    icon: Cookie,
  },
  {
    title: "Security",
    href: "/security",
    icon: ShieldCheck,
  },
  {
    title: "AI Transparency",
    href: "/ai-transparency",
    icon: BrainCircuit,
  },
  {
    title: "Data Deletion",
    href: "/data-deletion",
    icon: Trash2,
  },
];

export default function CompliancePage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-4xl">
          <div className="mb-6 inline-flex items-center rounded-full border border-border bg-muted/30 px-4 py-2 text-sm">
            <Scale className="mr-2 h-4 w-4" />
            Compliance
          </div>

          <h1 className="mb-6 text-5xl font-bold">
            Compliance & Governance
          </h1>

          <p className="text-lg leading-8 text-muted-foreground">
            Entrepreneuria Global, Inc. is committed to protecting customer
            data, building trustworthy AI-powered software, and operating our
            platform responsibly. This page summarizes our privacy, security,
            and compliance commitments.
          </p>
        </div>

        <section className="mt-16">
          <h2 className="mb-8 text-3xl font-bold">
            Our Commitments
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border p-6">
              <CheckCircle2 className="mb-4 h-8 w-8 text-primary" />
              <h3 className="mb-3 text-xl font-semibold">
                Privacy First
              </h3>
              <p className="leading-7 text-muted-foreground">
                We collect only the information reasonably necessary to provide
                our Services and do not sell personal information.
              </p>
            </div>

            <div className="rounded-xl border border-border p-6">
              <CheckCircle2 className="mb-4 h-8 w-8 text-primary" />
              <h3 className="mb-3 text-xl font-semibold">
                Responsible AI
              </h3>
              <p className="leading-7 text-muted-foreground">
                AI is designed to assist users, not replace human judgment.
                Users remain responsible for reviewing AI-generated content
                before relying on or publishing it.
              </p>
            </div>

            <div className="rounded-xl border border-border p-6">
              <CheckCircle2 className="mb-4 h-8 w-8 text-primary" />
              <h3 className="mb-3 text-xl font-semibold">
                Secure by Design
              </h3>
              <p className="leading-7 text-muted-foreground">
                We use modern authentication, encryption, infrastructure
                security, and access controls designed to protect customer data.
              </p>
            </div>

            <div className="rounded-xl border border-border p-6">
              <CheckCircle2 className="mb-4 h-8 w-8 text-primary" />
              <h3 className="mb-3 text-xl font-semibold">
                Customer Control
              </h3>
              <p className="leading-7 text-muted-foreground">
                Users control their connected accounts, AI preferences, and may
                request deletion of their account and personal information.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="mb-6 text-3xl font-bold">
            Regulations & Standards
          </h2>

          <div className="rounded-xl border border-border p-8">
            <ul className="space-y-4 leading-8 text-muted-foreground">
              <li>
                <strong>GDPR:</strong> We strive to support user privacy rights,
                including access, correction, and deletion requests where
                applicable.
              </li>

              <li>
                <strong>CCPA/CPRA:</strong> We are committed to transparency
                regarding the collection and use of personal information.
              </li>

              <li>
                <strong>AI Governance:</strong> We promote responsible,
                transparent, and human-supervised use of AI technologies.
              </li>

              <li>
                <strong>Security Best Practices:</strong> We continually improve
                our security controls, monitoring, and infrastructure as our
                platform evolves.
              </li>
            </ul>

            <p className="mt-6 text-sm text-muted-foreground">
              Compliance obligations may evolve as our products, customer base,
              and applicable laws change.
            </p>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="mb-8 text-3xl font-bold">
            Related Resources
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {resources.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-xl border border-border p-5 transition hover:border-primary hover:bg-muted/30"
                >
                  <div className="flex items-center gap-4">
                    <Icon className="h-6 w-6 text-primary" />
                    <span className="font-medium">
                      {item.title}
                    </span>
                  </div>

                  <span className="text-muted-foreground">
                    →
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-20 rounded-2xl border border-primary/20 bg-primary/5 p-10">
          <h2 className="text-3xl font-bold">
            Questions About Compliance?
          </h2>

          <p className="mt-4 max-w-2xl leading-8 text-muted-foreground">
            If your organization has questions about privacy, security,
            compliance, AI governance, or vendor reviews, we're happy to help.
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