"use client";

import NextLink from "next/link";
import type { ComponentProps, MouseEvent } from "react";

import { useRouteTransition, type TransitionOrigin } from "./RouteTransition";

type TransitionLinkProps = ComponentProps<typeof NextLink>;

/**
 * Where the transition should propagate from. A real pointer click gives the
 * exact point; keyboard activation reports (0, 0) with `detail === 0`, so the
 * link's own centre stands in — still causally connected to the thing the user
 * acted on, which is the whole point of seeding from the click. The single
 * layout read happens here, on click, never inside the animation.
 */
function originFromEvent(
  event: MouseEvent<HTMLAnchorElement>,
): TransitionOrigin {
  if (event.detail === 0) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return { x: event.clientX, y: event.clientY };
}

/**
 * Drop-in replacement for next/link that hands same-origin navigations to the
 * route transition so the pixel field can cover before the route commits.
 * Anything the transition cannot own — new tabs, modified clicks, downloads,
 * cross-origin hrefs, in-page anchors — falls through to next/link untouched,
 * as does every link rendered with no provider above it.
 */
export default function TransitionLink({
  onClick,
  ...props
}: TransitionLinkProps) {
  const transition = useRouteTransition();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    if (!transition) return;
    // Keep NextLink's explicit navigation contracts and same-path updates.
    if (props.replace || props.scroll === false || props.onNavigate) return;
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.currentTarget;
    if (anchor.target && anchor.target !== "_self") return;
    if (anchor.hasAttribute("download")) return;

    // Resolved off the DOM so relative hrefs and mailto:/tel: behave.
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname) {
      return;
    }

    const origin = originFromEvent(event);
    event.preventDefault();
    transition.navigate(url.pathname + url.search + url.hash, origin);
  };

  return <NextLink {...props} onClick={handleClick} />;
}
