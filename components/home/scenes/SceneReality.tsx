/**
 * SCENE 1 — "The Reality"
 * The empathy beat: pure kinetic typography. Lines are real text in
 * reading order (screen-reader coherent); the scroll cadence arrives
 * with the motion layer in Stage 5.
 *
 * Composition: statements breathe wide; the interior-voice questions
 * huddle closer together — rhythm mirrors how these thoughts actually
 * arrive (fast, stacked, at 2 a.m.).
 */

type Segment =
  | { kind: "statement"; lines: string[] }
  | { kind: "interior"; lines: string[] };

const SEGMENTS: readonly Segment[] = [
  {
    kind: "statement",
    lines: [
      "The idea was the easy part.",
      "Then come the questions nobody warns you about.",
    ],
  },
  {
    kind: "interior",
    lines: [
      "Is this even worth building?",
      "Am I pricing this right?",
      "What do I actually do next?",
    ],
  },
  {
    kind: "statement",
    lines: [
      "No cofounder. No board. No mentor on speed dial.",
      "Just you, seventeen tabs, and a deadline you set yourself.",
    ],
  },
];

export function SceneReality() {
  return (
    <section
      aria-labelledby="reality-heading"
      className="relative px-6 py-32 sm:px-10 sm:py-44 lg:px-16"
    >
      <h2 id="reality-heading" className="sr-only">
        The reality of building alone
      </h2>
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-16 text-center sm:gap-20">
        {SEGMENTS.map((segment, i) =>
          segment.kind === "interior" ? (
            <div key={i} className="flex flex-col items-center gap-5">
              {segment.lines.map((line) => (
                <p
                  key={line}
                  data-kinetic-line
                  data-kinetic-interior
                  className="type-kinetic-interior text-white/55"
                >
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <div key={i} className="flex flex-col items-center gap-8">
              {segment.lines.map((line) => (
                <p key={line} data-kinetic-line className="type-kinetic">
                  {line}
                </p>
              ))}
            </div>
          ),
        )}
      </div>
    </section>
  );
}
