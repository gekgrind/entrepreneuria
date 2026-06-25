import { Metadata } from "next";
import { CheckCircle2, Clock, Database, Globe, Server, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "System Status | Entrepreneuria",
  description: "Current system status for Entrepreneuria products and services.",
};

const services = [
  {
    name: "Entrepreneuria Website",
    description: "Main website and public pages",
    icon: Globe,
    status: "Operational",
  },
  {
    name: "Architecta",
    description: "AI content planning and publishing tools",
    icon: Sparkles,
    status: "Operational",
  },
  {
    name: "Prospra",
    description: "AI business mentor and entrepreneurial guidance",
    icon: Sparkles,
    status: "Operational",
  },
  {
    name: "Synceri",
    description: "AI life admin and workflow automation",
    icon: Sparkles,
    status: "Planned",
  },
  {
    name: "Authentication",
    description: "Login, signup, and account access",
    icon: Server,
    status: "Operational",
  },
  {
    name: "Database",
    description: "Application data, storage, and user records",
    icon: Database,
    status: "Operational",
  },
];

export default function StatusPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 max-w-3xl">
          <div className="mb-6 inline-flex items-center rounded-full border border-border bg-muted/30 px-4 py-2 text-sm">
            <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
            System Status
          </div>

          <h1 className="mb-6 text-5xl font-bold tracking-tight">
            All systems are operational.
          </h1>

          <p className="text-lg leading-8 text-muted-foreground">
            This page provides a high-level overview of Entrepreneuria services,
            products, and infrastructure status.
          </p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-8">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold">Current Status</h2>
              <p className="mt-2 text-muted-foreground">
                Last updated manually. Automated status monitoring may be added
                in the future.
              </p>
            </div>

            <div className="hidden rounded-full border border-border bg-muted/30 px-4 py-2 text-sm md:inline-flex">
              <Clock className="mr-2 h-4 w-4" />
              Manual status page
            </div>
          </div>

          <div className="divide-y divide-border">
            {services.map((service) => {
              const Icon = service.icon;
              const isOperational = service.status === "Operational";

              return (
                <div
                  key={service.name}
                  className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold">{service.name}</h3>
                      <p className="mt-1 text-muted-foreground">
                        {service.description}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`inline-flex w-fit items-center rounded-full px-4 py-2 text-sm font-medium ${
                      isOperational
                        ? "bg-green-500/10 text-green-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`mr-2 h-2 w-2 rounded-full ${
                        isOperational ? "bg-green-500" : "bg-muted-foreground"
                      }`}
                    />
                    {service.status}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-border bg-muted/30 p-8">
          <h2 className="text-2xl font-bold">Incident History</h2>

          <p className="mt-4 leading-8 text-muted-foreground">
            No active incidents are currently reported. Historical incident
            tracking may be added as Entrepreneuria expands.
          </p>
        </section>

        <section className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-8">
          <h2 className="text-2xl font-bold">Need Help?</h2>

          <p className="mt-4 leading-8 text-muted-foreground">
            If you are experiencing an issue with any Entrepreneuria service,
            please contact support.
          </p>

          <p className="mt-6">
            <strong>Email:</strong> support@entrepreneuria.io
          </p>
        </section>
      </div>
    </main>
  );
}