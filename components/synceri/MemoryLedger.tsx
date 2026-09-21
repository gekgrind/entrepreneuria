/**
 * MemoryLedger — the four questions a person is entitled to ask
 * something that knows this much about their life.
 *
 * This sits in the page's one light interlude, which is the site's
 * established treatment for trust-heavy content. That is not
 * decoration: the whole point of the section is that Synceri's memory
 * is meant to be looked at, so it gets the one part of the page you can
 * actually see into.
 *
 * Written as question and answer because that is how the product should
 * work — you ask, it explains. No claims about encryption,
 * certification or infrastructure are made anywhere here; those are
 * promises this page has no business making yet.
 */

const EXCHANGES = [
  {
    ask: "What do you know about me?",
    answer:
      "A list you can read, sorted by where it came from and when. Your context is not a black box — if Synceri knows it, you can see it.",
  },
  {
    ask: "Why did you remind me about this?",
    answer:
      "The reason, in plain language: what Synceri connected, and what made it think this mattered now. An assistant that can't explain itself is asking for trust it hasn't earned.",
  },
  {
    ask: "Forget this.",
    answer:
      "It goes, along with anything Synceri worked out from it. Not archived, not hidden from the list — removed.",
  },
  {
    ask: "Don't use this source.",
    answer:
      "Every connection Synceri draws on is one you granted and can revoke. Turn one off and it stops being part of the picture.",
  },
];

export function MemoryLedger() {
  return (
    <dl className="divide-y divide-ink/[0.12] border-y border-ink/[0.12]">
      {EXCHANGES.map((item) => (
        <div
          key={item.ask}
          className="grid gap-3 py-7 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14"
        >
          <dt className="type-display-xs text-balance text-ink">
            &ldquo;{item.ask}&rdquo;
          </dt>
          <dd className="leading-8 text-ink/70">{item.answer}</dd>
        </div>
      ))}
    </dl>
  );
}
