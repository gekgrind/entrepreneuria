"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { scrollLenisToTop, startLenis, stopLenis } from "./lenis-handle";
import {
  buildPixelField,
  indexFromPoint,
  COVERED_SCALE,
  SEED_SCALE,
  type PixelField,
} from "./pixel-field";

type GsapInstance = typeof import("gsap").gsap;

/** Viewport point a transition propagates from — usually where the user clicked. */
export type TransitionOrigin = { x: number; y: number };

type RouteTransitionValue = {
  navigate: (href: string, origin?: TransitionOrigin | null) => void;
};

const RouteTransitionContext = createContext<RouteTransitionValue | null>(null);

/**
 * Null when no provider is mounted, which lets TransitionLink degrade to a
 * plain next/link instead of throwing.
 */
export function useRouteTransition(): RouteTransitionValue | null {
  return useContext(RouteTransitionContext);
}

/* Stage timings, in seconds (GSAP's unit).
   Cover ≈ 380ms, reveal ≈ 340ms: ~720ms of motion plus however long the route
   takes to commit. Fast enough that the field reads as a transformation of the
   interface rather than something to sit through. */
const CELL_IN = 0.2;
const COVER_STAGGER = 0.18;
const CELL_OUT = 0.18;
const REVEAL_STAGGER = 0.16;

/* The seal. A flat fill under the cells, brought up in the last breath of the
   cover and dropped in the first of the reveal. While the field is complete it
   is the thing guaranteeing opacity — no arrangement of rounding errors or a
   dropped tween can open a gap onto the route swap — and it is never visible
   on its own, because at both ends of its fade the cells already cover. */
const SEAL_IN = 0.12;
const SEAL_OUT = 0.1;

const CONTENT_DURATION = 0.34;
const CONTENT_OFFSET = 0.08;
const CONTENT_SHIFT = 14;
const REDUCED_FADE = 0.075;

/* Resize rebuilds are cosmetic: 1fr tracks keep the field covering the
   viewport whatever the counts say, so only density goes stale. Debounced
   well past the end of a drag, and skipped outright mid-transition. */
const RESIZE_DEBOUNCE_MS = 220;

/* If a route never commits — offline, a thrown error, a cancelled push — the
   overlay must not stay parked over the page. Reveal anyway once this passes.
   Deliberately generous: firing early is the worse failure, because it wipes
   the field away over the *outgoing* page and the new route then pops in
   unannounced. A slow RSC fetch (or a cold dev compile) can genuinely take a
   couple of seconds, so this is a last resort, not a normal path. */
const COMMIT_TIMEOUT_MS = 8000;

let enginePromise: Promise<GsapInstance> | null = null;

/**
 * GSAP loads on the first navigation rather than at mount, so the initial page
 * load never waits on it. The homepage motion layer pulls the same chunk, so
 * this is usually a cache hit by the time anyone clicks.
 */
function loadTransitionEngine(): Promise<GsapInstance> {
  if (!enginePromise) {
    enginePromise = import("gsap").then(({ gsap }) => gsap);
  }
  return enginePromise;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The persistent <main> the shell renders; absent on the app/auth shells. */
function getContentEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-route-content]");
}

export default function RouteTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const sealRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<PixelField | null>(null);

  const pathnameRef = useRef(pathname);
  /* The path we are navigating away from, and the resolver waiting on it. We
     settle on *any* commit away from it rather than on arrival at a specific
     target, because auth-gated routes redirect: clicking /account while signed
     out commits /login, and waiting for /account would stall until timeout. */
  const pendingFromRef = useRef<string | null>(null);
  const commitResolveRef = useRef<(() => void) | null>(null);
  /* Bumped per run so a superseded run bails at its next await instead of
     fighting the newer one for the field. */
  const runIdRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    pathnameRef.current = pathname;
    // `settle` clears its own timer and both refs — single source of truth.
    if (pendingFromRef.current !== null && pendingFromRef.current !== pathname) {
      commitResolveRef.current?.();
    }
  }, [pathname]);

  /* Rebuilds the field for the current viewport; a no-op when the resolved
     grid is unchanged. Safe to call on every run, which is what keeps a
     missed resize from mattering. */
  const syncField = useCallback((): PixelField | null => {
    const grid = gridRef.current;
    if (!grid) return null;
    const next = buildPixelField(grid, fieldRef.current);
    fieldRef.current = next;
    return next;
  }, []);

  /* Build at mount so a popstate arriving before the first click still has a
     field to cover with — and so the very first navigation does not pay for
     several hundred element creations inside its own first frame. */
  useEffect(() => {
    syncField();

    let timer = 0;
    const onResize = () => {
      // Mid-transition the field is mid-flight; replacing its elements would
      // orphan every running tween. The next run re-syncs anyway.
      if (busyRef.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (busyRef.current) return;
        const before = fieldRef.current;
        const after = syncField();
        // Fresh elements carry no transform; restore the covered rest state so
        // a popstate still finds an opaque field.
        if (after && after !== before) {
          void loadTransitionEngine().then((gsap) => {
            if (fieldRef.current === after) {
              gsap.set(after.cells, { scale: COVERED_SCALE });
            }
          });
        }
      }, RESIZE_DEBOUNCE_MS);
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [syncField]);

  /* On unmount: invalidate any in-flight run so it bails at its next await
     rather than touching a detached overlay, release the run waiting on a
     commit (its resolver clears its own timer, so nothing outlives us), and
     never leave scrolling frozen. */
  useEffect(
    () => () => {
      runIdRef.current += 1;
      busyRef.current = false;
      commitResolveRef.current?.();
      startLenis();
    },
    [],
  );

  const waitForCommit = useCallback((target: string): Promise<void> => {
    const from = pathnameRef.current;
    // Already on that path (a search-only change) — nothing to wait for.
    if (from === target) return Promise.resolve();

    return new Promise<void>((resolve) => {
      let timeout = 0;
      const settle = () => {
        window.clearTimeout(timeout);
        commitResolveRef.current = null;
        pendingFromRef.current = null;
        resolve();
      };
      timeout = window.setTimeout(settle, COMMIT_TIMEOUT_MS);

      pendingFromRef.current = from;
      commitResolveRef.current = settle;
    });
  }, []);

  /* Forward navigation always lands at the top. A hash target owns its own
     position, and back/forward restores the historical one — racing Next.js's
     scroll restoration there would just flip a coin. */
  const resetScroll = useCallback((preserveExisting: boolean) => {
    if (preserveExisting) return;
    scrollLenisToTop();
    // `instant` matters: globals.css sets scroll-behavior: smooth on <html>.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  /* Takes a null gsap so it still works when the engine chunk failed to load —
     in that case nothing was ever animated, so plain style writes suffice. */
  const settleIdle = useCallback((gsap: GsapInstance | null) => {
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.style.visibility = "hidden";
      overlay.style.pointerEvents = "none";
    }
    /* Rest state is "fully covering, but hidden", so a popstate can reach an
       opaque field with nothing but a visibility flip. Written after the
       overlay is hidden, in the same task, so the covered field never paints. */
    const field = fieldRef.current;
    if (gsap) {
      if (field) gsap.set(field.cells, { scale: COVERED_SCALE });
      if (sealRef.current) gsap.set(sealRef.current, { opacity: 1 });
    } else if (sealRef.current) {
      sealRef.current.style.opacity = "1";
    }

    const content = getContentEl();
    if (content) {
      if (gsap) gsap.set(content, { clearProps: "opacity,transform" });
      else {
        content.style.opacity = "";
        content.style.transform = "";
      }
    }
    startLenis();
  }, []);

  const run = useCallback(
    async (
      href: string,
      fromPopState: boolean,
      origin: TransitionOrigin | null,
    ) => {
      const runId = ++runIdRef.current;
      busyRef.current = true;
      let gsap: GsapInstance | null = null;
      let target = "";

      try {
        /* Parsed inside the try: a throw out here would strand busyRef at true
           and kill navigation for the rest of the session. */
        const url = new URL(href, window.location.href);
        target = url.pathname;
        const hasHash = url.hash.length > 0;
        const reduced = prefersReducedMotion();

        if (!reduced) stopLenis();

        gsap = await loadTransitionEngine();
        if (runId !== runIdRef.current) return;

        const overlay = overlayRef.current;
        const seal = sealRef.current;
        const content = getContentEl();
        const field = reduced ? null : syncField();

        if (reduced || !overlay || !field) {
          /* Reduced motion: no field, just a 150ms cross-fade end to end. The
             same path covers the case where the grid never built, so a failure
             there costs the effect and nothing else. */
          if (content) {
            await gsap.to(content, {
              opacity: 0,
              duration: REDUCED_FADE,
              ease: "none",
              overwrite: "auto",
            });
            if (runId !== runIdRef.current) return;
          }

          if (!fromPopState) router.push(href);
          await waitForCommit(target);
          if (runId !== runIdRef.current) return;

          resetScroll(hasHash || fromPopState);

          const incoming = getContentEl();
          if (incoming) {
            await gsap.to(incoming, {
              opacity: 1,
              duration: REDUCED_FADE,
              ease: "none",
              overwrite: "auto",
            });
          }
          return;
        }

        const seed = origin ?? {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        };
        const originIndex = indexFromPoint(field, seed.x, seed.y);
        /* The tuple annotation is load-bearing: GSAP types `grid` as a fixed
           pair, and a plain array literal widens to number[]. */
        const stagger = {
          grid: [field.rows, field.cols] as [number, number],
          from: originIndex,
        };

        /* Stage 1 — cover. The field propagates outward from the seed: each
           cell grows from nothing to full, its delay set by its distance from
           the cell the user clicked in. On a popstate the field
           is already covering (the handler flipped visibility synchronously,
           before React could paint the incoming route) and this is skipped —
           the browser has already committed, so there is no window to
           propagate into. */
        if (!fromPopState) {
          gsap.set(overlay, { visibility: "visible", pointerEvents: "auto" });
          gsap.set(seal, { opacity: 0 });
          gsap.set(field.cells, { scale: SEED_SCALE });

          const cover = gsap.timeline();
          cover.to(
            field.cells,
            {
              scale: COVERED_SCALE,
              duration: CELL_IN,
              ease: "power3.out",
              // `amount` is the whole window: the farthest cell starts exactly
              // this late, so the wave cannot stretch on a large viewport.
              // Easing the distribution out front-loads the near cells, which
              // reads as the field rushing away from the click.
              stagger: { ...stagger, amount: COVER_STAGGER, ease: "power1.out" },
            },
            0,
          );
          cover.to(
            seal,
            { opacity: 1, duration: SEAL_IN, ease: "none" },
            COVER_STAGGER + CELL_IN - SEAL_IN,
          );
          await cover;
          if (runId !== runIdRef.current) return;
        }

        /* Stage 2 — swap, only ever behind a fully opaque field. Hiding the
           content here is what keeps the incoming route invisible even in the
           frames after the field starts clearing. */
        if (content) gsap.set(content, { opacity: 0, y: CONTENT_SHIFT });
        if (!fromPopState) router.push(href);
        await waitForCommit(target);
        if (runId !== runIdRef.current) return;

        resetScroll(hasHash || fromPopState);

        /* Stage 3 — reveal. The field drains from the same seed, so the new
           page opens out of the point that was clicked. Easing the
           distribution in holds the outer cells back, which keeps the edges of
           the viewport sealed while the centre is already through. */
        const reveal = gsap.timeline();
        reveal.to(seal, { opacity: 0, duration: SEAL_OUT, ease: "none" }, 0);
        reveal.to(
          field.cells,
          {
            scale: SEED_SCALE,
            duration: CELL_OUT,
            /* Out, not in: a cell should commit to leaving. Easing in would
               park it just under full size for most of its tween, so the gap
               it opens would creep in as a hairline; easing out clears that
               band almost immediately and the gap reads as a block from the
               moment it appears. */
            ease: "power2.out",
            stagger: { ...stagger, amount: REVEAL_STAGGER, ease: "power1.in" },
          },
          0,
        );

        const incoming = getContentEl();
        if (incoming) {
          reveal.to(
            incoming,
            {
              opacity: 1,
              y: 0,
              duration: CONTENT_DURATION,
              ease: "power2.out",
              overwrite: "auto",
            },
            CONTENT_OFFSET,
          );
        }
        await reveal;
      } catch {
        /* The animation is a nicety; the navigation is not. If the engine
           chunk or a tween failed, still get the user to the page. */
        if (!fromPopState && window.location.pathname !== target) {
          router.push(href);
        }
      } finally {
        if (runId === runIdRef.current) {
          // Must not throw — this is the only path that unfreezes scrolling.
          try {
            settleIdle(gsap);
          } catch {
            startLenis();
          }
          busyRef.current = false;
        }
      }
    },
    [resetScroll, router, settleIdle, syncField, waitForCommit],
  );

  useEffect(() => {
    const handlePopState = () => {
      // Fires for hash changes too; only a real route change transitions.
      if (window.location.pathname === pathnameRef.current) return;

      /* The browser has already committed to this navigation — there is no
         window in which to propagate a cover first. Show the field and hide
         the outgoing content synchronously, in the same task as the event, so
         React cannot paint the incoming route unmasked. The field rests at
         covering position, so visibility is the only thing to flip — writing a
         transform here would poison GSAP's base transform. */
      if (!prefersReducedMotion()) {
        const overlay = overlayRef.current;
        if (overlay) {
          overlay.style.visibility = "visible";
          overlay.style.pointerEvents = "auto";
        }
      }
      const content = getContentEl();
      if (content) content.style.opacity = "0";

      // Back/forward gets the reveal half only, seeded from the centre: there
      // is no click to propagate from and no time to cover in.
      void run(window.location.href, true, null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [run]);

  const navigate = useCallback(
    (href: string, origin?: TransitionOrigin | null) => {
      // Drop clicks that land mid-transition rather than interleave two runs.
      if (busyRef.current) return;
      void run(href, false, origin ?? null);
    },
    [run],
  );

  const value = useMemo<RouteTransitionValue>(() => ({ navigate }), [navigate]);

  return (
    <RouteTransitionContext.Provider value={value}>
      {children}
      <div
        ref={overlayRef}
        aria-hidden="true"
        /* Above every layer the site can raise, ClickSpark's 999999 included:
           a navigating click already has the field propagating out of it, and
           a spark burst on top of that is a second answer to the same event.
           Sparks still fire normally on clicks that do not navigate. */
        className="pointer-events-none fixed inset-0 z-[1000000]"
        /* Idle is "covering, but hidden" — deliberately no transform on this
           element or on the cells. A transform set here would become GSAP's
           *base* transform and compose with everything it writes. Visibility
           alone hides the layer; GSAP owns transform and opacity.
           Containment keeps several hundred cells from ever participating in
           the page's own layout or paint work. */
        style={{ visibility: "hidden", contain: "layout paint style" }}
      >
        <div
          ref={sealRef}
          className="absolute inset-0 bg-void-950"
          style={{ opacity: 1 }}
        />
        <div ref={gridRef} className="absolute inset-0 grid" />
      </div>
    </RouteTransitionContext.Provider>
  );
}
