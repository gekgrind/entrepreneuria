"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { StyleInterest } from "@/lib/services/websites/styles";

export type PackageChoice = "" | "unsure" | "starter" | "growth" | "business";

interface Selection {
  style: StyleInterest | "";
  setStyle: (s: StyleInterest | "") => void;
  pkg: PackageChoice;
  /** Choose a package from a card, then bring the visitor to the form. */
  requestPackage: (p: PackageChoice) => void;
  setPkg: (p: PackageChoice) => void;
  /** Incremented on every package request so the form can move focus. */
  focusTick: number;
}

const SelectionContext = createContext<Selection | null>(null);

/**
 * Shares the gallery's "Use this style" toggles and the package cards with
 * the inquiry form, so the toggles and the form selects stay in sync both
 * ways (Sprint 2 handoff §6).
 */
export function SelectionProvider({
  initialStyle,
  initialPackage,
  children,
}: {
  initialStyle: StyleInterest | "";
  initialPackage: PackageChoice;
  children: ReactNode;
}) {
  const [style, setStyle] = useState<StyleInterest | "">(initialStyle);
  const [pkg, setPkg] = useState<PackageChoice>(initialPackage);
  const [focusTick, setFocusTick] = useState(0);

  const requestPackage = useCallback((p: PackageChoice) => {
    setPkg(p);
    const target = document.getElementById("preview");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    setFocusTick((t) => t + 1);
  }, []);

  const value = useMemo(
    () => ({ style, setStyle, pkg, setPkg, requestPackage, focusTick }),
    [style, pkg, requestPackage, focusTick]
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): Selection {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used inside <SelectionProvider>");
  return ctx;
}
