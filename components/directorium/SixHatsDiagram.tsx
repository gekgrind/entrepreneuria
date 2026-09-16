import { CouncilChamber } from "./chamber/CouncilChamber";
import { EchoDiagram } from "./chamber/EchoDiagram";

/**
 * Six Hats — the architectural argument as a side-by-side comparison.
 * Both panels share the chamber's geometry so the only difference the
 * eye can find is the one that matters: one source broadcasting six
 * identical personas vs. six distinct minds converging on one decision
 * and disagreeing across the table.
 *
 * Captions reuse the section's own language; the figures are described
 * for assistive tech by their figcaptions.
 *
 * Motion (DirectoriumMotion, once on entry): the echo moves in unison;
 * the board's seats arrive independently, then the debate appears.
 */
export function SixHatsDiagram() {
  return (
    <div data-dm="six-hats" className="grid gap-14 md:grid-cols-2 md:gap-10 lg:gap-16">
      <figure data-dm-figure="echo" className="relative">
        <div className="relative mx-auto w-full max-w-[380px] opacity-80">
          <EchoDiagram />
        </div>
        <figcaption className="mx-auto mt-8 max-w-sm text-center">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/55 [font-family:var(--font-label)]">
            One model · six prompts
          </p>
          <p className="mt-3 leading-7 text-white/55">
            One worldview, one set of training data, one perspective filtered
            through one architecture.
          </p>
        </figcaption>
      </figure>

      <figure data-dm-figure="board" className="relative">
        <div className="relative mx-auto w-full max-w-[380px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[-12%] rounded-full bg-[radial-gradient(circle,rgba(79,124,167,0.2),transparent_65%)]"
          />
          <CouncilChamber id="six-hats" state="debate" labels={false} />
        </div>
        <figcaption className="mx-auto mt-8 max-w-sm text-center">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#00d4ff] [font-family:var(--font-label)]">
            Six models · six perspectives
          </p>
          <p className="mt-3 leading-7 text-white/75">
            Genuinely different reasoning, different strengths, different
            blind spots — and real disagreement by design.
          </p>
        </figcaption>
      </figure>
    </div>
  );
}
