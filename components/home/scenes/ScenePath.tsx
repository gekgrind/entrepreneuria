import { RESOURCE_LAYER } from "@/lib/ecosystem/products";
import { Kicker } from "./shared";

/**
 * SCENE 5 — "The Path"
 * The mental model made visual: Start → Build → Supply.
 * Calm editorial contrast after the intensity of Scenes 3–4.
 */
export function ScenePath() {
  return (
    <section
      aria-labelledby="path-heading"
      className="relative px-6 py-32 sm:px-10 sm:py-44 lg:px-16"
    >
      <div className="mx-auto max-w-6xl">
        <div data-ignite className="max-w-2xl">
          <Kicker>Products + resources + marketplace</Kicker>
          <h2
            id="path-heading"
            className="type-display-md"
          >
            Start where you are.
          </h2>
        </div>

        <ol className="mt-16 grid gap-6 md:grid-cols-3">
          {RESOURCE_LAYER.map((entry) => (
            <li
              key={entry.slug}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-8"
            >
              {/* journey rail: node + hairline, the constellation thread in miniature */}
              <div aria-hidden="true" data-rail className="mb-6 flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-human shadow-[0_0_8px_rgba(210,122,44,0.6)]" />
                <span className="h-px flex-1 bg-white/10" />
              </div>
              <span className="type-label text-human">
                {entry.stage}
              </span>
              <h3 className="type-display-sm mt-3">
                {entry.name}
              </h3>
              <p className="mt-3 flex-1 leading-7 text-white/70">
                {entry.description}
              </p>
              <p className="mt-6">
                <a
                  href={entry.link.href}
                  className="text-sm font-medium text-white/85 underline decoration-intelligence/40 underline-offset-4 transition hover:text-intelligence"
                >
                  {entry.stage === "START"
                    ? "Visit the Launch Pad"
                    : entry.stage === "BUILD"
                      ? "Explore the ecosystem"
                      : "Browse the Exchange"}
                </a>
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
