import type { LucideIcon } from "lucide-react";

export type CommandCenterAppStatus = "available" | "coming-soon";

export type CommandCenterLiveDataTone =
  | "positive"
  | "info"
  | "warning"
  | "muted";

export type CommandCenterApp = {
  id: string;
  name: string;
  description: string;
  status: CommandCenterAppStatus;
  tierLabel?: string;
  includedInPlan: boolean;
  href?: string;
  icon: LucideIcon;
  accentClass: string;
  features: string[];
  useCases: string[];
  liveData?: {
    message: string;
    actionLabel: string;
    tone: CommandCenterLiveDataTone;
  };
};
