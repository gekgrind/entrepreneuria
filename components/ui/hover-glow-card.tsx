"use client";

import type {
  CSSProperties,
  HTMLAttributes,
  PointerEvent,
  ReactNode,
} from "react";
import { useRef } from "react";

import { cn } from "@/lib/utils";

export function useHoverGlow<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  const onPointerMove = (event: PointerEvent<T>) => {
    const element = ref.current;

    if (!element || event.pointerType === "touch") {
      return;
    }

    const rect = element.getBoundingClientRect();
    element.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
    element.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
  };

  const onPointerLeave = () => {
    const element = ref.current;

    if (!element) {
      return;
    }

    element.style.setProperty("--mouse-x", "50%");
    element.style.setProperty("--mouse-y", "50%");
  };

  return [
    ref,
    {
      "--mouse-x": "50%",
      "--mouse-y": "50%",
    } as CSSProperties,
    onPointerMove,
    onPointerLeave,
  ] as const;
}

export function HoverGlowLayers() {
  return (
    <>
      <span className="hover-glow-card__glow pointer-events-none absolute inset-0 transition-opacity duration-300" />
      <span className="hover-glow-card__edge pointer-events-none absolute inset-0 transition-opacity duration-300" />
    </>
  );
}

type HoverGlowCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function HoverGlowCard({
  children,
  className,
  style,
  onPointerMove,
  onPointerLeave,
  ...props
}: HoverGlowCardProps) {
  const [glowRef, glowStyle, handlePointerMove, handlePointerLeave] =
    useHoverGlow<HTMLDivElement>();

  return (
    <div
      ref={glowRef}
      style={{ ...glowStyle, ...style }}
      onPointerMove={(event) => {
        handlePointerMove(event);
        onPointerMove?.(event);
      }}
      onPointerLeave={(event) => {
        handlePointerLeave();
        onPointerLeave?.(event);
      }}
      className={cn("hover-glow-card group relative overflow-hidden", className)}
      {...props}
    >
      <HoverGlowLayers />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
