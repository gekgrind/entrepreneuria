/**
 * The Armature — /architecta's one page-specific motif.
 *
 * Architecta's claim is that content is a structure, not a pile of
 * posts: one idea, held against a voice and an audience, resolving into
 * the version each channel actually needs. A paragraph can assert that.
 * A drawing shows it.
 *
 * So this is deliberately NOT a panel and NOT app chrome — Prospra's
 * hero object is a framed surface, and a second framed surface here
 * would make the two pages read as one template with the copy swapped.
 * This is architectural line work sitting directly on the page field:
 * a source, a spine, a junction, and four branches, drawn with
 * hairlines and instrument labels.
 *
 * Accent grammar, used narratively rather than decoratively: the input
 * arrives in the founder's orange, passes through the junction where
 * Architecta's cyan takes over, and leaves as the product's output.
 *
 * The assembly plays once on load, in CSS, with every element in the
 * DOM and its space reserved from first paint — so it costs no layout
 * shift, ships no client JS, and resolves to the finished drawing under
 * prefers-reduced-motion. It earns on-load motion for the same reason
 * Prospra's exchange does: assembly is the behaviour being sold, and a
 * still frame of a finished diagram doesn't show assembly.
 *
 * Server component.
 */

export type ArmatureChannel = {
  /** Channel name — instrument label, mono. */
  channel: string;
  /** What that channel actually asks for (Subject line, Caption, …). */
  form: string;
  /** The same idea, as that channel would carry it. */
  output: string;
};

export function Armature({
  source,
  junction,
  channels,
}: {
  source: string;
  /** The layer the idea is held against on its way through. */
  junction: readonly string[];
  channels: readonly ArmatureChannel[];
}) {
  return (
    <figure
      className="armature relative w-full max-w-xl xl:max-w-none"
      aria-label="How Architecta works: one idea, held against your brand voice, audience and strategy, and adapted into the version each channel needs."
    >
      {/* The drawing sheet. A faint drafting grid, fading out well
          before the edges so it never resolves into a boxed panel —
          the page field still shows through it. First child, so it
          paints under everything else without needing a negative
          z-index (which would drop it behind the page field itself). */}
      <span
        aria-hidden="true"
        className="architecta-sheet pointer-events-none absolute -inset-x-8 -inset-y-10"
      />

      {/* ── The source: the founder's raw input ──────────────────── */}
      <div data-arm="1" className="relative">
        <p className="type-label mb-3 text-human/90">Your idea</p>
        <p className="border-l border-human/40 pl-5 text-[15px] leading-7 text-white/90">
          {source}
        </p>
      </div>

      {/* ── The spine down to the junction ───────────────────────── */}
      <div aria-hidden="true" className="relative ml-[3px] h-10">
        <span
          data-arm="2"
          className="armature-draw-y absolute inset-y-0 left-0 w-px bg-gradient-to-b from-human/40 to-white/20"
        />
      </div>

      {/* ── The junction: where Architecta takes the idea over ───── */}
      <div data-arm="3" className="relative flex items-center gap-4">
        <span
          aria-hidden="true"
          className="armature-node relative -ml-[3px] block h-[9px] w-[9px] shrink-0 rotate-45 border border-intelligence/70 bg-void-900"
        />
        <p className="type-label text-intelligence/85">
          {junction.join(" · ")}
        </p>
      </div>

      {/* ── The branches: one idea, four channels ────────────────── */}
      <div className="relative pt-2">
        {/* The spine the branches hang off. It fades out rather than
            stopping, so it never has to know how tall the last branch
            ended up being. */}
        <span
          aria-hidden="true"
          data-arm="4"
          className="armature-draw-y absolute inset-y-0 left-[3px] w-px bg-gradient-to-b from-white/18 from-70% to-transparent"
        />

        <ul className="flex flex-col">
          {channels.map((item, i) => (
            <li
              key={item.channel}
              data-arm={5 + i}
              className="relative py-[13px] pl-11 sm:pl-12"
            >
              {/* the branch drawn out of the spine, ending in a lit node */}
              <span
                aria-hidden="true"
                className="armature-draw-x absolute left-[3px] top-[27px] h-px w-[22px] bg-white/20 sm:w-[26px]"
              />
              <span
                aria-hidden="true"
                className="absolute left-[23px] top-[25px] h-[5px] w-[5px] rounded-full bg-intelligence/80 shadow-[0_0_8px_rgba(0,212,255,0.55)] sm:left-[27px]"
              />
              <p className="type-label flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-white/45">
                <span className="text-white/70">{item.channel}</span>
                <span aria-hidden="true" className="text-white/20">
                  /
                </span>
                <span>{item.form}</span>
              </p>
              <p className="mt-2 text-[15px] leading-7 text-white/80">
                {item.output}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
