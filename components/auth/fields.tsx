"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";

import type { OAuthProvider } from "@/lib/auth/oauth";

/**
 * The auth design system — one set of primitives shared by login,
 * sign-up, forgot-password and reset-password so every state (default,
 * focus, filled, invalid, loading, disabled) is expressed identically
 * across the flow.
 *
 * Field chrome lives in globals.css (.auth-input) because the legacy
 * unlayered `input {}` rule in that file outranks Tailwind's utility
 * layer; a class selector beats it cleanly without !important.
 */

export function AuthHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6 sm:mb-8">
      <h2 className="type-display-sm">{title}</h2>
      {subtitle ? (
        <p className="mt-2 text-sm leading-6 text-white/55">{subtitle}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fields                                                              */
/* ------------------------------------------------------------------ */

type AuthFieldProps = {
  label: string;
  /** Renders a show/hide control and toggles the input type. */
  reveal?: boolean;
  /** Small right-aligned control beside the label, e.g. a reset link. */
  action?: ReactNode;
  hint?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id">;

export function AuthField({
  label,
  reveal = false,
  action,
  hint,
  type = "text",
  ...props
}: AuthFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [shown, setShown] = useState(false);

  const resolvedType = reveal ? (shown ? "text" : "password") : type;
  const describedBy =
    [props["aria-describedby"], hint ? hintId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="type-label text-white/55">
          {label}
        </label>
        {action}
      </div>

      <div className="relative">
        <input
          {...props}
          id={id}
          type={resolvedType}
          aria-describedby={describedBy}
          className={`auth-input${reveal ? " auth-input--with-affix" : ""}`}
        />

        {reveal ? (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            /* The label already names the field; what a screen-reader
               user needs announced here is the control's effect. */
            aria-label={
              shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`
            }
            aria-pressed={shown}
            tabIndex={props.disabled ? -1 : 0}
            className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-white/45 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intelligence/60"
          >
            <EyeIcon off={shown} />
          </button>
        ) : null}
      </div>

      {hint ? (
        <p id={hintId} className="mt-2 text-xs leading-5 text-white/40">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <path d="m3 3 18 18" /> : null}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/**
 * The primary action is HUMAN orange, not intelligence cyan: per the
 * constellation accent grammar, orange is the founder's light and the
 * founder's action. Signing in is the most human thing on this page.
 */
export function AuthSubmit({
  children,
  loading = false,
  loadingLabel,
  disabled,
}: {
  children: ReactNode;
  loading?: boolean;
  loadingLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className="group relative inline-flex min-h-[52px] w-full items-center justify-center overflow-hidden rounded-full bg-human px-6 text-sm font-semibold text-[#1a1206] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intelligence focus-visible:ring-offset-4 focus-visible:ring-offset-void-950 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100"
    >
      <span className="button-shimmer" aria-hidden="true" />
      <span className="relative flex items-center gap-2.5">
        {loading ? <Spinner /> : null}
        {loading ? loadingLabel : children}
      </span>
    </button>
  );
}

/**
 * The provider group. Stacked full-width, one row per provider, in the
 * order the registry declares them — at this lane width (max 25rem, and
 * narrower still on mobile) a two-column split would break "Continue
 * with Google" onto two lines and shrink each target below a
 * comfortable tap. Stacking keeps both providers at the same 52px
 * height as the primary action, and keeps the provider names readable.
 */
export function OAuthProviderGroup({ children }: { children: ReactNode }) {
  return <div className="grid gap-3">{children}</div>;
}

/**
 * One provider button. Deliberately identical chrome for every
 * provider — the mark is the only thing that differs — so the group
 * reads as one set of equal-weight options rather than as a primary
 * and an afterthought.
 */
export function OAuthButton({
  provider,
  onClick,
  loading = false,
  disabled,
}: {
  provider: OAuthProvider;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className="inline-flex min-h-[52px] w-full items-center justify-center gap-3 rounded-full border border-white/12 bg-white/[0.04] px-6 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intelligence focus-visible:ring-offset-4 focus-visible:ring-offset-void-950 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {loading ? <Spinner /> : <ProviderMark provider={provider.id} />}
      {loading ? provider.redirectingLabel : provider.label}
    </button>
  );
}

function ProviderMark({ provider }: { provider: OAuthProvider["id"] }) {
  return provider === "github" ? <GitHubMark /> : <GoogleMark />;
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46Z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7Z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z"
      />
    </svg>
  );
}

/**
 * GitHub's Invertocat, drawn in `currentColor` so it inherits the
 * button's white and stays legible on the void. GitHub's brand
 * guidelines allow the mark in a single solid colour; lucide's stroked
 * approximation would have read a full weight lighter beside Google's
 * solid multicolour mark, and the two sit two rows apart.
 */
function GitHubMark() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent opacity-70 motion-safe:animate-spin"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Structure + messaging                                               */
/* ------------------------------------------------------------------ */

export function AuthDivider({ children = "or" }: { children?: string }) {
  return (
    <div className="my-5 flex items-center gap-4 sm:my-6" aria-hidden="true">
      <span className="h-px flex-1 bg-white/10" />
      <span className="type-label text-white/35">{children}</span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}

/**
 * Errors are assertive so they interrupt; status and success notes are
 * polite so they never talk over a screen reader mid-sentence.
 */
export function AuthAlert({
  tone,
  children,
  id,
}: {
  tone: "error" | "status" | "success";
  children: ReactNode;
  id?: string;
}) {
  const styles = {
    error: "border-red-400/30 bg-red-500/10 text-red-100",
    status: "border-intelligence/25 bg-intelligence/[0.07] text-intelligence",
    success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  }[tone];

  return (
    <p
      id={id}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`rounded-xl border px-4 py-3 text-sm leading-6 ${styles}`}
    >
      {children}
    </p>
  );
}

export function AuthMeta({ children }: { children: ReactNode }) {
  return <p className="mt-7 text-sm text-white/50">{children}</p>;
}

export function AuthLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded font-medium text-intelligence no-accent-link underline decoration-intelligence/35 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intelligence/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void-950"
    >
      {children}
    </Link>
  );
}

/**
 * Frames Turnstile as part of the instrument layer.
 *
 * Cloudflare's managed widget has two shapes: a visible ~65px challenge,
 * or nothing at all when it clears the visitor silently. Reserving the
 * space unconditionally keeps the button from jumping, but leaves a hole
 * in the silent case — so the slot carries its own status chip and
 * releases the reservation once a token exists. Both outcomes then read
 * as designed states rather than as something failing to load.
 */
export function AuthVerification({
  children,
  verified = false,
}: {
  children: ReactNode;
  verified?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="type-label text-white/40">Verification</p>
        <p
          className={`type-label flex items-center gap-2 ${
            verified ? "text-intelligence/80" : "text-white/30"
          }`}
        >
          <span
            aria-hidden="true"
            className={
              verified
                ? "h-1.5 w-1.5 rounded-full bg-intelligence shadow-[0_0_8px_rgba(0,212,255,0.8)]"
                : "h-1.5 w-1.5 rounded-full border border-white/35"
            }
          />
          {verified ? "Verified" : "Checking"}
        </p>
      </div>
      <div className="auth-turnstile" data-verified={verified || undefined}>
        {children}
      </div>
    </div>
  );
}
