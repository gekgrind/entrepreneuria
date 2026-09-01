import type Lenis from "lenis";

/**
 * Module-level handle to the one Lenis instance the site ever creates.
 * SmoothScroll registers the instance it owns; the route transition uses this
 * to freeze scrolling while the overlay covers the viewport and to jump to the
 * top without the smooth scroller animating the jump.
 *
 * Lenis is homepage-only and is skipped entirely for reduced-motion users, so
 * every accessor here is a deliberate no-op on routes that never mount it.
 */
let instance: Lenis | null = null;

export function setLenisInstance(next: Lenis | null): void {
  instance = next;
}

export function stopLenis(): void {
  instance?.stop();
}

export function startLenis(): void {
  instance?.start();
}

export function scrollLenisToTop(): void {
  // `force` scrolls even while stopped — which is exactly the covered window.
  instance?.scrollTo(0, { immediate: true, force: true });
}

/**
 * Smooth-scroll to an absolute Y through the one Lenis instance (so the
 * scrubbed ScrollTrigger timelines stay in sync). Returns false when no
 * instance exists — the caller falls back to native smooth scrolling.
 */
export function scrollLenisTo(target: number): boolean {
  if (!instance) return false;
  instance.scrollTo(target, { duration: 1.15 });
  return true;
}
