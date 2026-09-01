import Image from "next/image";
import { ConstellationStatic } from "@/components/home/ConstellationStatic";
import { Kicker } from "./shared";

/**
 * SCENE 6 — "The Heartbeat"
 * Full temperature shift to the warm paper world. The spectacle stops;
 * a real person explains why this company exists. Motion here is slow
 * and respectful by design (Stage 5/8).
 */
export function SceneFounder() {
  return (
    <section
      aria-labelledby="founder-heading"
      className="relative bg-paper px-6 py-32 text-ink sm:px-10 sm:py-44 lg:px-16"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
        <figure data-founder-portrait className="relative overflow-hidden rounded-2xl shadow-[0_32px_80px_-32px_rgba(26,41,66,0.35)]">
          <Image
            src="/images/founder/misti-portrait-1200.webp"
            alt="Misti, founder of Entrepreneuria, standing in a city street."
            width={1200}
            height={1200}
            className="h-auto w-full object-cover"
            priority={false}
          />
          {/* warm rim light — the founder's light, rhyming with the hero */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 [background:linear-gradient(315deg,rgba(210,122,44,0.18)_0%,transparent_45%)]"
          />
        </figure>

        <div data-ignite>
          <Kicker tone="light">Why this exists</Kicker>
          <h2
            id="founder-heading"
            className="type-display-md"
          >
            Built by a founder who needed it first.
          </h2>
          <div className="type-lede mt-8 space-y-5 text-ink/80">
            <p>
              For years, I chased ideas I never finished. I&apos;d get
              excited, hit a wall, doubt myself, and quietly give up.
            </p>
            <p>
              Then I noticed something: nearly every founder who made it had
              someone to call. A mentor. An advisor. A board. I didn&apos;t.
              Most of us don&apos;t.
            </p>
            <p>
              AI finally made a different answer possible — guidance that
              isn&apos;t reserved for the well-connected. So I built Prospra,
              the mentor I always needed. This time, I didn&apos;t quit.
            </p>
          </div>
          <div className="mt-10">
            <div className="flex items-end gap-6">
              <span data-signature className="inline-block">
                <Image
                  src="/logos/entrepreneuria-logo-signature.png"
                  alt="Misti's signature"
                  width={420}
                  height={140}
                  className="h-auto w-56 opacity-80"
                />
              </span>
              {/* foil-stamp constellation — the motif, once, small */}
              <ConstellationStatic className="mb-1 w-14 opacity-35" />
            </div>
            <p className="mt-3 text-sm text-ink/70">
              Misti — Founder, Entrepreneuria
            </p>
            <p className="mt-6">
              <a
                href="/about"
                className="text-sm font-medium text-ink underline decoration-human/50 underline-offset-4 transition hover:text-human"
              >
                The full story
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
