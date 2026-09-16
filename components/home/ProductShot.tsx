import Image from "next/image";

/**
 * ProductShot — the product-artifact frame. Static-first:
 * beautiful with zero motion; Stage 8 adds the tilt-to-flat reveal.
 *
 * Real product UI only — this component never renders placeholders.
 * Products without a production screenshot simply don't get a frame
 * (registry-driven, per the no-fake-UI rule).
 */
export function ProductShot({
  src,
  alt,
  width,
  height,
  caption,
  glow = "intelligence",
  priority = false,
  shot,
  sizes,
  ratio,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
  glow?: "intelligence" | "none";
  priority?: boolean;
  /** Reveal choreography role (Stage 8, driven by HomeMotion). */
  shot?: "hero" | "support";
  /** Layout hint for next/image; omit to let it pick the widest source. */
  sizes?: string;
  /**
   * Crops the frame to this aspect ratio, anchored to the top of the
   * capture — for shots that caught the browser's own scrollbar or the
   * OS dock along their bottom edge. Omit to show the whole capture.
   */
  ratio?: string;
}) {
  return (
    <figure
      data-shot={shot}
      className={`relative ${shot === "hero" ? "[perspective:1400px]" : ""}`}
    >
      {glow === "intelligence" ? (
        <div
          aria-hidden="true"
          data-shot-glow
          className="glow-intelligence-radial pointer-events-none absolute -inset-x-10 -bottom-14 h-48 opacity-70 blur-2xl"
        />
      ) : null}
      <div
        data-shot-inner
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-void-800 shadow-[0_32px_80px_-32px_rgba(0,0,0,0.8)]"
        style={ratio ? { aspectRatio: ratio } : undefined}
      >
        {/* top-edge catchlight */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
        />
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes={sizes}
          className={
            ratio
              ? // The 2% zoom, anchored to the top, takes the captured
                // scrollbar off the right edge without touching the
                // product chrome along the top.
                "h-full w-full origin-top scale-[1.02] object-cover object-top"
              : "h-auto w-full"
          }
        />
      </div>
      {caption ? (
        <figcaption className="type-caption mt-4 text-white/50">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
