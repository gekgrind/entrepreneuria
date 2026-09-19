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
 * It reports whether its subtree is on screen by setting
 * `data-visible="true|false"` on its own root, and nothing else. The
 * Synceri figures react to that attribute in CSS, which buys two things
 * the flow system's `Reveal` can't give a figure:
 *
 *  1. Ambient motion that is genuinely OFF while the figure is
 *     off-screen (`hold` — the context field, the relay pulse), rather
 *     than an infinite animation burning compositor frames on a page
 *     this long.
 *  2. Entrance choreography INSIDE a figure (`once` — the capacity view
 *     settling, the day thread), where the parts have to arrive in a
 *     meaningful order rather than as one block.
 *
 * Reduced motion is handled entirely in CSS: every rule that reads this
 * attribute sits inside `prefers-reduced-motion: no-preference`, so
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
  /** Stop observing after the first intersection (entrances). */
  once?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export function Stage<T extends ElementType = "div">({
  as,
  once = false,
  className = "",
  children,
  ...rest
}: StageProps<T>) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          if (once) {
            if (!entry.isIntersecting) continue;
            target.dataset.visible = "true";
            obs.unobserve(target);
          } else {
            target.dataset.visible = String(entry.isIntersecting);
          }
        }
      },
      { threshold: once ? 0.25 : 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  const Tag = (as ?? "div") as unknown as PolymorphicTag;

  return (
    <Tag ref={ref} data-visible="false" className={className} {...rest}>
      {children}
    </Tag>
  );
}
