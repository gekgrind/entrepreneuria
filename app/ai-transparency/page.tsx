import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Transparency | Entrepreneuria",
  description:
    "How Entrepreneuria uses artificial intelligence across its products and services.",
};

export default function AITransparencyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-5xl px-6 py-20">
        <h1 className="mb-8 text-5xl font-bold">AI Transparency</h1>

        <p className="mb-8 text-muted-foreground">
          <strong>Effective Date:</strong> June 24, 2026
        </p>

        <p className="mb-10 leading-8">
          Entrepreneuria Global, Inc. (&quot;Entrepreneuria&quot;,
          &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) builds
          AI-powered tools designed to help entrepreneurs plan, create,
          automate, organize, and grow their businesses. This page explains how
          we use artificial intelligence across our Services, including
          Architecta, Prospra, Synceri, Directorium, and future Entrepreneuria
          products.
        </p>

        <section className="space-y-10">
          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              How We Use AI
            </h2>

            <p className="leading-8">
              Entrepreneuria uses AI to assist with tasks such as business
              planning, content generation, marketing strategy, workflow
              automation, document analysis, creative development, decision
              support, productivity assistance, and personalized guidance.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              AI Providers
            </h2>

            <p className="leading-8">
              Certain features may use third-party AI providers, including
              OpenAI, Anthropic, Google, and other model providers. The specific
              provider used may depend on the product, feature, user settings,
              availability, performance, cost, or requested task.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              User Choice of Models
            </h2>

            <p className="leading-8">
              Some Entrepreneuria products may allow users to choose between
              supported AI models or providers. Where model selection is
              available, users are responsible for selecting the provider that
              best fits their preferences, business needs, and risk tolerance.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Information Sent to AI Providers
            </h2>

            <p className="leading-8">
              When you use AI-powered features, information such as prompts,
              uploaded files, business details, generated drafts, workflow
              instructions, social media content, or other materials may be sent
              to AI providers as necessary to generate responses or perform
              requested actions.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Human Review
            </h2>

            <p className="leading-8">
              AI-generated content should be reviewed by a human before being
              published, submitted, relied upon, or used for important business
              decisions. This is especially important for legal, financial, tax,
              employment, healthcare, regulatory, or safety-related matters.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Accuracy and Limitations
            </h2>

            <p className="leading-8">
              AI systems can produce inaccurate, outdated, incomplete, biased,
              or unexpected results. Entrepreneuria does not guarantee that
              AI-generated outputs will be correct, complete, lawful,
              appropriate, or suitable for every use case.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              User Responsibility
            </h2>

            <p className="leading-8">
              Users are responsible for reviewing AI-generated outputs,
              verifying factual claims, confirming compliance with applicable
              laws and platform policies, and making final decisions about how
              generated content or recommendations are used.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Social Media and Publishing
            </h2>

            <p className="leading-8">
              Products such as Architecta may help users create, schedule, or
              publish content to connected platforms such as LinkedIn, Facebook,
              Instagram, X, TikTok, YouTube, or other supported services. Users
              should review and approve content before publishing and are
              responsible for complying with each platform&apos;s rules.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Images, Video, and Creative Assets
            </h2>

            <p className="leading-8">
              Some features may generate images, video concepts, captions,
              scripts, brand assets, or other creative materials. Users are
              responsible for confirming that generated materials are
              appropriate for their brand, do not infringe third-party rights,
              and comply with applicable platform or advertising rules.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Memory and Personalization
            </h2>

            <p className="leading-8">
              Certain features may use saved preferences, profile information,
              prior conversations, business details, or workspace context to
              personalize AI responses. Users may be able to update, remove, or
              limit stored information through account settings or support
              requests.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Automated Actions
            </h2>

            <p className="leading-8">
              Entrepreneuria may offer features that draft, schedule, organize,
              summarize, or automate tasks. Where supported, users remain in
              control of authorization, connected accounts, and final approval
              for actions taken through the Services.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Continuous Improvement
            </h2>

            <p className="leading-8">
              We may improve our AI-powered features over time by refining
              prompts, workflows, model choices, safety checks, evaluation
              methods, user controls, and product design. Updates may change how
              AI features behave or which providers are available.
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
      </div>
    </main>
  );
}