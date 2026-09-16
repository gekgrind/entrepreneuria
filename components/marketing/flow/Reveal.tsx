"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ComponentType,
  type ElementType,
  type ReactNode,
  type Ref,
} from "react";

/**
 * Scroll entrance primitives for flow pages.
 *
 * One IntersectionObserver per scope, `once`, toggling a data attribute
 * that CSS reacts to (`app/globals.css` → FLOW PAGES → Reveal). No
 * per-frame work, no layout reads, nothing to jank on a phone.
 *
 * Deliberately not the global `[data-reveal]` observer in
 * RootClientLayout: that one indexes every revealed node on the page and
 * multiplies the delay by its position, so the last section of a long
 * page waits seconds before appearing.
 *
 * Reduced motion: the CSS never hides anything in the first place, so
 * this mounts, observes, and changes nothing visible.
 */

/**
 * `as` is erased to a permissive component type before rendering. The
 * alternative — keeping the generic through JSX — makes every prop
 * resolve to `never` for an unresolved ElementType.
 */
type PolymorphicTag = ComponentType<
  {
    ref?: Ref<HTMLElement>;
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
  } & Record<string, unknown>
>;

const OBSERVER_OPTIONS: IntersectionObserverInit = {
  // Fire a little before the element's top edge lands, so the entrance
  // reads as "already arriving" rather than "popped in late".
  rootMargin: "0px 0px -12% 0px",
  threshold: 0.15,
};

function useRevealOnce<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Anything already on screen at mount (short pages, restored scroll
    // positions, deep links) resolves immediately — an element the reader
    // is looking at must never be waiting on an intersection callback.
    const observer = new IntersectionObserver((entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.shown = "true";
        obs.unobserve(entry.target);
      }
    }, OBSERVER_OPTIONS);

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

type RevealProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  /** Rise distance in px. Larger for figures, smaller for dense copy. */
  distance?: number;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

/** Rises and fades in once, as a single block. */
export function Reveal<T extends ElementType = "div">({
  as,
  children,
  distance,
  className = "",
  ...rest
}: RevealProps<T>) {
  const ref = useRevealOnce<HTMLElement>();
  const Tag = (as ?? "div") as unknown as PolymorphicTag;
  return (
    <Tag
      ref={ref}
      data-flow-reveal=""
      className={className}
      style={
        distance
          ? ({ "--flow-reveal-y": `${distance}px` } as CSSProperties)
          : undefined
      }
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * Staggers its DIRECT children — the list, the grid, the step sequence.
 * Order carries meaning here, so the stagger is small (80ms) and capped:
 * it should read as one gesture arriving in sequence, not as items
 * queueing up.
 */
export function RevealGroup<T extends ElementType = "div">({
  as,
  children,
  distance,
  className = "",
  ...rest
}: RevealProps<T>) {
  const ref = useRevealOnce<HTMLElement>();
  const Tag = (as ?? "div") as unknown as PolymorphicTag;
  return (
    <Tag
      ref={ref}
      data-flow-reveal-group=""
      className={className}
      style={
        distance
          ? ({ "--flow-reveal-y": `${distance}px` } as CSSProperties)
          : undefined
      }
      {...rest}
    >
      {children}
    </Tag>
  );
}
