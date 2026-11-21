import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { publicAiToolsEnabled } from "@/lib/ai/public-tools-flag";

/**
 * Server-side gate for a public AI tool page. Used by each tool's layout.tsx
 * (the pages themselves are client components and are left unchanged).
 * While PUBLIC_AI_TOOLS_ENABLED is not "true" the tool route returns 404.
 */
export function PublicAiToolGate({ children }: { children: ReactNode }) {
  if (!publicAiToolsEnabled()) notFound();
  return children;
}
