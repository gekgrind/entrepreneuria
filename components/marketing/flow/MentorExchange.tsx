import Image from "next/image";

/**
 * MentorExchange — a single real exchange between a founder and the
 * mentor, shown rather than described.
 *
 * This is the page's one piece of non-scroll-triggered motion: the
 * question lands, the mentor thinks, the answer arrives. It earns that
 * because it is the only element on the page that has to demonstrate a
 * behaviour instead of stating a claim, and because a still frame of a
 * conversation says nothing about what using Prospra is like.
 *
 * The accent grammar is the site's, not decoration: orange is the
 * founder's light, cyan is the product's. The old page had them
 * reversed.
 *
 * Every turn is in the DOM from first paint with its space reserved, so
 * the sequence costs no layout shift, and reduced motion simply arrives
 * at the finished conversation.
 */
export function MentorExchange({
  question,
  answer,
  logo,
  name,
}: {
  question: string;
  answer: string;
  logo: string | null;
  /** Product name, from the ecosystem registry. */
  name: string;
}) {
  return (
    <div className="relative">
      {/* the product's own light, behind its own surface */}
      <div
        aria-hidden="true"
        className="glow-intelligence-radial pointer-events-none absolute -inset-x-8 -bottom-10 -top-6 rounded-[2.5rem] opacity-80 blur-2xl"
      />

      <div className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0a1930]/80 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)] backdrop-blur-sm">
        {/* top-edge catchlight — the homepage's product-frame tell */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
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
          <span className="ml-auto inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-intelligence shadow-[0_0_8px_rgba(0,212,255,0.8)]"
            />
            <span className="type-label text-white/45">Mentor session</span>
          </span>
        </div>

        <div className="exchange-seq flex flex-col gap-6 px-5 py-7 sm:px-7">
          {/* the founder — warm side */}
          <div data-turn="1" className="flex flex-col items-end">
            <p className="type-label mb-2 text-human/80">You</p>
            <p className="max-w-[92%] rounded-2xl rounded-tr-md border border-human/25 bg-human/[0.09] px-4 py-3 text-[15px] leading-7 text-white/90">
              {question}
            </p>
          </div>

          {/* the mentor — the product's side */}
          <div className="relative">
            <p
              className="exchange-thinking absolute left-0 top-0 flex items-center gap-1.5"
              aria-hidden="true"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-intelligence/70" />
              <span className="h-1.5 w-1.5 rounded-full bg-intelligence/70" />
              <span className="h-1.5 w-1.5 rounded-full bg-intelligence/70" />
            </p>
            <div data-turn="2">
              <p className="type-label mb-2 text-intelligence/80">{name}</p>
              <p className="max-w-[94%] rounded-2xl rounded-tl-md border border-white/[0.09] bg-white/[0.04] px-4 py-3 text-[15px] leading-7 text-white/90">
                {answer}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
