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

type GsapInstance = typeof import("gsap").gsap;

type RouteTransitionValue = {
  navigate: (href: string) => void;
};

const RouteTransitionContext = createContext<RouteTransitionValue | null>(null);

/**
 * Null when no provider is mounted, which lets TransitionLink degrade to a
 * plain next/link instead of throwing.
 */
export function useRouteTransition(): RouteTransitionValue | null {
  return useContext(RouteTransitionContext);
}

/* Stage timings, in seconds (GSAP's unit). */
const COVER_DURATION = 0.5;
const REVEAL_DURATION = 0.5;
const CONTENT_DURATION = 0.4;
const CONTENT_OFFSET = 0.1;
const CONTENT_SHIFT = 24;
const REDUCED_FADE = 0.075;

/* If a route never commits — offline, a thrown error, a cancelled push — the
   overlay must not stay parked over the page. Reveal anyway once this passes.
   Deliberately generous: firing early is the worse failure, because it wipes
   the panel away over the *outgoing* page and the new route then pops in
   unannounced. A slow RSC fetch (or a cold dev compile) can genuinely take a
   couple of seconds, so this is a last resort, not a normal path. */
const COMMIT_TIMEOUT_MS = 8000;

const WIPE_EASE = "routeWipe";
/* cubic-bezier(0.76, 0, 0.24, 1) as the path CustomEase parses. */
const WIPE_EASE_PATH = "M0,0 C0.76,0 0.24,1 1,1";

let enginePromise: Promise<GsapInstance> | null = null;

/**
 * GSAP loads on the first navigation rather than at mount, so the initial page
 * load never waits on it. The homepage motion layer pulls the same chunk, so
 * this is usually a cache hit by the time anyone clicks.
 */
function loadTransitionEngine(): Promise<GsapInstance> {
  if (!enginePromise) {
    enginePromise = Promise.all([
      import("gsap"),
      import("gsap/CustomEase"),
    ]).then(([{ gsap }, { CustomEase }]) => {
      gsap.registerPlugin(CustomEase);
      CustomEase.create(WIPE_EASE, WIPE_EASE_PATH);
      return gsap;
    });
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
  const pathnameRef = useRef(pathname);
  /* The path we are navigating away from, and the resolver waiting on it. We
     settle on *any* commit away from it rather than on arrival at a specific
     target, because auth-gated routes redirect: clicking /account while signed
     out commits /login, and waiting for /account would stall until timeout. */
  const pendingFromRef = useRef<string | null>(null);
  const commitResolveRef = useRef<(() => void) | null>(null);
  /* Bumped per run so a superseded run bails at its next await instead of
     fighting the newer one for the overlay. */
  const runIdRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    pathnameRef.current = pathname;
    // `settle` clears its own timer and both refs — single source of truth.
    if (pendingFromRef.current !== null && pendingFromRef.current !== pathname) {
      commitResolveRef.current?.();
    }
  }, [pathname]);

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
      // Back to covering position but hidden, so a popstate can reveal it
      // instantly with nothing but a visibility flip.
      if (gsap) {
        gsap.set(overlay, {
          yPercent: 0,
          visibility: "hidden",
          pointerEvents: "none",
        });
      } else {
        overlay.style.visibility = "hidden";
        overlay.style.pointerEvents = "none";
      }
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
    async (href: string, fromPopState: boolean) => {
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
        const content = getContentEl();

        if (reduced || !overlay) {
          /* Reduced motion: no panel, just a 150ms cross-fade end to end. */
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

        /* Stage 1 — cover. Position and reveal in one write so no frame can
           paint the panel at the wrong offset. On a popstate it is already
           over the viewport (the handler flipped visibility synchronously,
           before React could paint the incoming route) and this is a no-op. */
        gsap.set(overlay, {
          yPercent: fromPopState ? 0 : 100,
          visibility: "visible",
          pointerEvents: "auto",
        });
        await gsap.to(overlay, {
          yPercent: 0,
          duration: fromPopState ? 0 : COVER_DURATION,
          ease: WIPE_EASE,
          overwrite: "auto",
        });
        if (runId !== runIdRef.current) return;

        /* Stage 2 — swap, only ever behind a fully opaque panel. Hiding the
           content here is what keeps the incoming route invisible even in the
           frames after the panel starts moving off. */
        if (content) gsap.set(content, { opacity: 0, y: CONTENT_SHIFT });
        if (!fromPopState) router.push(href);
        await waitForCommit(target);
        if (runId !== runIdRef.current) return;

        resetScroll(hasHash || fromPopState);

        /* Stage 3 — reveal. */
        const reveal = gsap.timeline();
        reveal.to(overlay, {
          yPercent: -100,
          duration: REVEAL_DURATION,
          ease: WIPE_EASE,
          overwrite: "auto",
        });
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
    [resetScroll, router, settleIdle, waitForCommit],
  );

  useEffect(() => {
    const handlePopState = () => {
      // Fires for hash changes too; only a real route change transitions.
      if (window.location.pathname === pathnameRef.current) return;

      /* The browser has already committed to this navigation — there is no
         window in which to animate a cover first. Reveal the panel and hide
         the outgoing content synchronously, in the same task as the event, so
         React cannot paint the incoming route unmasked. The panel already
         rests at covering position, so visibility is the only thing to flip —
         writing a transform here would poison GSAP's base transform. */
      if (!prefersReducedMotion()) {
        const overlay = overlayRef.current;
        if (overlay) {
          overlay.style.visibility = "visible";
          overlay.style.pointerEvents = "auto";
        }
      }
      const content = getContentEl();
      if (content) content.style.opacity = "0";

      void run(window.location.href, true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [run]);

  const navigate = useCallback(
    (href: string) => {
      // Drop clicks that land mid-transition rather than interleave two runs.
      if (busyRef.current) return;
      void run(href, false);
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
        className="pointer-events-none fixed inset-0 z-[200] bg-[#0A0E27]"
        /* Idle is "covering position, but hidden" — deliberately no transform.
           A transform set here would become GSAP's *base* transform and get
           composed with every yPercent it writes, parking the panel a whole
           viewport off-target. Visibility alone hides it; GSAP owns transform. */
        style={{ visibility: "hidden" }}
      />
    </RouteTransitionContext.Provider>
  );
}
