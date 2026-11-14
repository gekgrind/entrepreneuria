/**
 * The capability motif — the one page-specific mark on /pricing.
 *
 * A hairline rule across the top of the card, divided into one segment
 * per rung of the ladder. Segments up to and including this plan's own
 * rung are lit with the intelligence accent; the rest stay dim. Read
 * across the three cards it is a rule filling in from left to right,
 * which is the argument the page is making anyway: the same system,
 * progressively more of it switched on.
 *
 * Deliberately NOT a bar chart or an icon — it spans the full card, so
 * it reads as architecture rather than a glyph, and it encodes position
 * on the ladder rather than any quantity. Purely decorative: it is
 * hidden from assistive tech, and every distinction it draws is also
 * stated in words on the card.
 *
 * Server component — CSS and nothing else.
 */
export function Rungs({ step, of }: { step: number; of: number }) {
  return (
    <span aria-hidden="true" className="flex w-full gap-1.5">
      {Array.from({ length: of }, (_, i) => (
        <span
          key={i}
          className={`h-px flex-1 rounded-full ${
            i < step
              ? "bg-intelligence/70 shadow-[0_0_6px_rgba(0,212,255,0.35)]"
              : "bg-white/10"
          }`}
        />
      ))}
    </span>
  );
}
