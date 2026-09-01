/**
 * belief-cards — the Scene 8 value-proof content.
 *
 * Copy is CANONICAL: these are the published Prospra benefit statements
 * (app/prospra/page.tsx), reused verbatim. No invented statistics, no
 * fabricated testimonials — the cards argue value, not traction.
 */
export interface BeliefCard {
  index: string;
  title: string;
  body: string;
}

export const BELIEF_CARDS: readonly BeliefCard[] = [
  {
    index: "01",
    title: "Expert-level guidance",
    body: "Access strategies and insights usually locked behind high-ticket consultants and accelerators.",
  },
  {
    index: "02",
    title: "Personalized direction",
    body: "Prospra learns your business model, industry, and goals so guidance stays specific and useful.",
  },
  {
    index: "03",
    title: "Always available",
    body: "Get support whenever you need it without waiting on calendars, introductions, or office hours.",
  },
];
