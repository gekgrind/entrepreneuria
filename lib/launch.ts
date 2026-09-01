/**
 * Launch-state configuration — environment-backed, never a source edit.
 *
 * Set NEXT_PUBLIC_PROSPRA_LAUNCH_STATE in the environment:
 *   waitlist      pre-launch (default)
 *   early_access  limited beta open
 *   live          Prospra publicly available
 *   paused        signups temporarily paused (CTA falls back to waitlist)
 *
 * Launch day is an env change, not a commit.
 */

export const LAUNCH_STATES = [
  "waitlist",
  "early_access",
  "live",
  "paused",
] as const;
export type LaunchState = (typeof LAUNCH_STATES)[number];

function resolveLaunchState(): LaunchState {
  const raw = process.env.NEXT_PUBLIC_PROSPRA_LAUNCH_STATE;
  return (LAUNCH_STATES as readonly string[]).includes(raw ?? "")
    ? (raw as LaunchState)
    : "waitlist";
}

export const PROSPRA_LAUNCH_STATE: LaunchState = resolveLaunchState();

export interface PrimaryCta {
  label: string;
  href: string;
}

const PRIMARY_CTAS: Record<LaunchState, PrimaryCta> = {
  waitlist: { label: "Join the Waitlist", href: "/waitlist" },
  early_access: { label: "Get Early Access", href: "/sign-up" },
  live: { label: "Start Free", href: "/sign-up" },
  paused: { label: "Join the Waitlist", href: "/waitlist" },
};

export function getPrimaryCta(state: LaunchState = PROSPRA_LAUNCH_STATE): PrimaryCta {
  return PRIMARY_CTAS[state];
}
