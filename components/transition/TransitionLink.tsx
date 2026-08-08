"use client";

import NextLink from "next/link";
import type { ComponentProps, MouseEvent } from "react";

import { useRouteTransition } from "./RouteTransition";

type TransitionLinkProps = ComponentProps<typeof NextLink>;

/**
 * Drop-in replacement for next/link that hands same-origin navigations to the
 * route transition so the cover animation can play before the route commits.
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
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.currentTarget;
    if (anchor.target && anchor.target !== "_self") return;
    if (anchor.hasAttribute("download")) return;

    // Resolved off the DOM so relative hrefs and mailto:/tel: behave.
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (
      url.pathname === window.location.pathname &&
      url.search === window.location.search
    ) {
      return;
    }

    event.preventDefault();
    transition.navigate(url.pathname + url.search + url.hash);
  };

  return <NextLink {...props} onClick={handleClick} />;
}
