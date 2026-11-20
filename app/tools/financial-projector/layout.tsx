import type { ReactNode } from "react";

import { PublicAiToolGate } from "@/components/tools/PublicAiToolGate";

/* Read per request: PUBLIC_AI_TOOLS_ENABLED is a runtime switch (lib/ai/public-tools-flag.ts). */
export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: ReactNode }) {
  return <PublicAiToolGate>{children}</PublicAiToolGate>;
}
