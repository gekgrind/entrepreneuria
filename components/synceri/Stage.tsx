"use client";

import {
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ComponentType,
  type ElementType,
  type ReactNode,
  type Ref,
} from "react";

/**
 * Stage — the one client primitive this page adds.
 *
 * It reports its subtree's relationship to the viewport as two separate
 * attributes, because the figures need two different things from it and
 * one flag could not express both:
 *
 *   data-seen="true"      latched on first intersection, never removed.
 *                         Entrance choreography inside a figure — the
 *                         day thread's beats, the capacity shortlist,
 *                         the permission rows. An entrance that replays
 *                         every time the reader scrolls back past it is
 *                         the cheap kind of motion this page is supposed
 *                         to avoid, and the rest of the site's reveals
 *                         are strictly once.
 *
 *   data-visible          toggles with visibility. Ambient motion — the
 *                         context field's breath, the relay's travelling
 *                         light — so a page this long is never paying
 *                         for animation the reader cannot see.
 *
 * The relay needs both at once: its stops arrive once, its rail light
 * runs only while on screen.
 *
 * `threshold: 0` is deliberate. IntersectionObserver's ratio is
 * intersection area over TARGET area, so any non-zero threshold is a
 * height dependency in disguise: a figure taller than 1/threshold
 * viewports can never reach it and would stay hidden forever. None of
 * these figures is near that today, but the entrance has no reason to
 * care how tall its figure is.
 *
 * Reduced motion is handled entirely in CSS: every rule that reads these
 * attributes sits inside `prefers-reduced-motion: no-preference`, so
 * without JS — or with motion off — the figure is simply at rest in its
 * finished state.
 */

/** Same erasure the flow `Reveal` uses: keeping the generic through JSX
 *  resolves every prop to `never` for an unresolved ElementType. */
type PolymorphicTag = ComponentType<
  {
    ref?: Ref<HTMLElement>;
    className?: string;
    children?: ReactNode;
  } & Record<string, unknown>
>;

type StageProps<T extends ElementType> = {
  as?: T;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export function Stage<T extends ElementType = "div">({
  as,
  className = "",
  children,
  ...rest
}: StageProps<T>) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          target.dataset.visible = String(entry.isIntersecting);
          if (entry.isIntersecting) target.dataset.seen = "true";
        }
      },
      { threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Tag = (as ?? "div") as unknown as PolymorphicTag;

  return (
    <Tag ref={ref} data-visible="false" className={className} {...rest}>
      {children}
    </Tag>
  );
}
