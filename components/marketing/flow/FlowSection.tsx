import type { ReactNode } from "react";

import { SplitReveal } from "@/components/home/motion/SplitReveal";

import { Reveal } from "./Reveal";

/**
 * A section on a flow page.
 *
 * Everything the old marketing `Section` did to mark a boundary — the
 * hairline top rule, the section-owned background — is gone. What marks
 * a section here is rhythm: a long silence above it, a kicker, a
 * heading that rises out of a line mask, and the reading measure.
 *
 * Server component. The two children that need the browser (the masked
 * heading and the kicker's entrance) are client islands.
 */
export function FlowSection({
  id,
  eyebrow,
  title,
  lede,
  children,
  /** `lg` for the hero-adjacent beats, `md` for everything else. */
  size = "md",
  width = "6xl",
  align = "left",
  layout = "stacked",
  headingLevel = 2,
  className = "",
  labelledBy,
}: {
  id?: string;
  eyebrow?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  size?: "md" | "lg";
  width?: "5xl" | "6xl" | "7xl";
  align?: "left" | "center";
  /**
   * `split` puts the heading block in a sticky left column beside the
   * content — the editorial layout for sequences and long lists, where
   * a full-width heading followed by a grid reads as another box stack.
   */
  layout?: "stacked" | "split";
  headingLevel?: 2 | 3;
  className?: string;
  labelledBy?: string;
}) {
  const Heading = (headingLevel === 3 ? "h3" : "h2") as "h2" | "h3";
  const headingId = id ? `${id}-heading` : labelledBy;
  const centered = align === "center";
  const maxWidth =
    width === "7xl" ? "max-w-7xl" : width === "5xl" ? "max-w-5xl" : "max-w-6xl";

  const split = layout === "split";

  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={`relative px-6 py-20 sm:px-10 sm:py-28 lg:px-16 lg:py-36 ${className}`}
    >
      <div
        className={`relative mx-auto w-full ${maxWidth} ${
          split
            ? "grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 xl:gap-20"
            : ""
        }`}
      >
        {eyebrow || title || lede ? (
          <div
            className={
              split
                ? "lg:sticky lg:top-[calc(var(--header-height)+72px)] lg:self-start"
                : centered
                  ? "mx-auto max-w-3xl text-center"
                  : ""
            }
          >
            {eyebrow ? (
              <Reveal distance={14}>
                <p className="type-kicker mb-5 text-white/50">{eyebrow}</p>
              </Reveal>
            ) : null}

            {title ? (
              <SplitReveal>
                <Heading
                  id={headingId}
                  className={`${
                    size === "lg" ? "type-display-lg" : "type-display-md"
                  } text-balance ${
                    centered ? "mx-auto" : split ? "" : "max-w-[18ch]"
                  }`}
                >
                  {title}
                </Heading>
              </SplitReveal>
            ) : null}

            {lede ? (
              <Reveal>
                <p
                  className={`type-lede mt-7 text-white/70 ${
                    centered ? "mx-auto max-w-2xl" : "max-w-2xl"
                  }`}
                >
                  {lede}
                </p>
              </Reveal>
            ) : null}
          </div>
        ) : null}

        {children ? (
          <div
            className={
              split
                ? ""
                : eyebrow || title || lede
                  ? "mt-16 lg:mt-20"
                  : ""
            }
          >
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The flow-page surface. Quieter than the old glass panel — a single
 * hairline and almost no fill, so the type carries the hierarchy rather
 * than nine identical boxes competing for it.
 *
 * `lift` adds the hover response; use it only where the panel is
 * genuinely a thing you can act on or read into, never as decoration.
 */
export function Panel({
  as: Tag = "div",
  lift = false,
  className = "",
  children,
}: {
  as?: "div" | "li" | "article" | "figure";
  lift?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={`flow-panel rounded-2xl border border-white/[0.09] bg-white/[0.02] ${
        lift
          ? "flow-panel-lift hover:border-white/20 hover:bg-white/[0.04]"
          : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
