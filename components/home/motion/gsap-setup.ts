import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

export { gsap, ScrollTrigger, SplitText };

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * True when the device has any precise pointer or a desktop-sized viewport.
 * Used to pick the WebGL quality tier — hybrid Windows touchscreens report
 * a coarse primary pointer but still have desktop-class GPUs.
 */
export const isHighTierDevice = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(any-pointer: fine)").matches ||
    window.innerWidth >= 1024);
