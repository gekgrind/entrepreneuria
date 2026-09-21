import Image from "next/image";

import styles from "./synceri.module.css";

/**
 * SyncMoment — the hero figure, and the page's one claim that is shown
 * instead of stated.
 *
 * Three fragments arrive from three unrelated places: a calendar, a
 * text message, a school email. They have nothing to do with each other
 * as far as any of those apps is concerned. A thread runs down through
 * them — warm where the person's life is, cool where Synceri answers —
 * and at the bottom they come out as the one thing that was actually
 * worth knowing.
 *
 * Deliberately NOT an app screenshot. Synceri is in development, and a
 * fabricated dashboard would be claiming a product that does not ship
 * yet. What this frame shows is the shape of an interaction — the way
 * Synceri arrives — which is true today and stays true across every
 * surface the product eventually lives on.
 *
 * Every beat is in the DOM in its final position from first paint, so
 * the load sequence costs no layout shift and reduced motion simply
 * arrives at the finished moment.
 */

const FRAGMENTS = [
  { source: "Calendar", detail: "Dentist — tomorrow, 9:30 AM" },
  { source: "Text from Mum", detail: "“Ellie's recital is Thursday at 6.”" },
  { source: "Email · school", detail: "Permission slip due Friday" },
];

const REPLIES = [
  "Your dentist appointment is tomorrow at 9:30. That drive is usually about 35 minutes at that hour, so leaving by 8:50 should keep you on time.",
  "The permission slip is the only thing due before Friday. I'll remind you about Ellie's recital on Thursday morning.",
];

export function SyncMoment({
  logo,
  name,
}: {
  logo: string | null;
  /** From the ecosystem registry — never hardcoded here. */
  name: string;
}) {
  return (
    <figure className="relative">
      {/* the product's own light, behind its own surface */}
      <div
        aria-hidden="true"
        className="glow-intelligence-radial pointer-events-none absolute -inset-x-8 -bottom-10 -top-6 rounded-[2.5rem] opacity-80 blur-2xl"
      />

      <div
        className={`${styles.moment} ${styles.surface} relative overflow-hidden rounded-2xl border border-white/[0.09] shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)] backdrop-blur-sm`}
      >
        <div
          aria-hidden="true"
          className={`${styles.catchlight} absolute inset-x-0 top-0 h-px`}
        />

        <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-3.5">
          {logo ? (
            <Image
              src={logo}
              alt=""
              width={22}
              height={22}
              className="h-[22px] w-[22px] rounded-md object-cover"
            />
          ) : null}
          <span className="type-label text-white/70">{name}</span>
          <span className="type-label ml-auto text-white/40">
            Tuesday · 4:12 PM
          </span>
        </div>

        <div className="px-5 py-7 sm:px-7">
          <p className="type-label mb-4 text-white/40">Picked up today</p>

          {/* The fragments and the answer share one bullet column, and
              the thread runs down it. */}
          <div className="relative">
            <span
              aria-hidden="true"
              className={`${styles.momentThread} ${styles.bridge} pointer-events-none absolute left-[2px] top-2 h-[calc(100%-2.5rem)] w-px`}
            />

            <ul className="flex flex-col gap-2.5">
              {FRAGMENTS.map((fragment, i) => (
                <li
                  key={fragment.source}
                  data-beat={i + 1}
                  className="flex items-baseline gap-3.5"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-1.5 w-1.5 shrink-0 self-start rounded-full bg-human/70"
                  />
                  <span className="min-w-0">
                    <span className="type-label text-human/75">
                      {fragment.source}
                    </span>
                    <span className="mt-1 block text-[15px] leading-6 text-white/65">
                      {fragment.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="relative mt-7 pl-[22px]">
              <p
                className={`${styles.momentThinking} absolute left-[22px] top-0 flex items-center gap-1.5`}
                aria-hidden="true"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-intelligence/70" />
                <span className="h-1.5 w-1.5 rounded-full bg-intelligence/70" />
                <span className="h-1.5 w-1.5 rounded-full bg-intelligence/70" />
              </p>

              <p
                data-beat="4"
                className="type-label relative mb-2.5 text-intelligence/80"
              >
                <span
                  aria-hidden="true"
                  className="absolute -left-[22px] top-[3px] h-1.5 w-1.5 rounded-full bg-intelligence/80 shadow-[0_0_8px_rgba(0,212,255,0.7)]"
                />
                {name}
              </p>

              {REPLIES.map((reply, i) => (
                <p
                  key={reply}
                  data-beat={i + 4}
                  className={`rounded-2xl rounded-tl-md border border-white/[0.09] bg-white/[0.04] px-4 py-3 text-[15px] leading-7 text-white/90 ${
                    i > 0 ? "mt-2.5" : ""
                  }`}
                >
                  {reply}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      <figcaption className="type-caption mt-4 text-white/45">
        An example of how Synceri shows up — three unrelated things, one
        answer.
      </figcaption>
    </figure>
  );
}
