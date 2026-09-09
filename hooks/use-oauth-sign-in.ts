"use client";

import { useCallback, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildOAuthCallbackUrl,
  type OAuthProviderId,
} from "@/lib/auth/oauth";

/**
 * Starts a provider sign-in from either auth page.
 *
 * Login and sign-up need exactly the same behaviour here — begin the
 * PKCE flow, keep the button in its redirecting state until the browser
 * actually leaves, and surface a non-technical message if it does not —
 * so the behaviour lives here once and each page supplies only its own
 * destination.
 *
 * `pending` holds the provider that is mid-redirect, which is what the
 * buttons need: the one that was clicked shows a spinner, the others
 * disable.
 */
export function useOAuthSignIn({
  nextPath,
  onError,
}: {
  /** Where the visitor should land once the session exists. */
  nextPath: string;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState<OAuthProviderId | null>(null);

  const signIn = useCallback(
    async (provider: OAuthProviderId) => {
      setPending(provider);

      try {
        const supabase = getSupabaseBrowserClient();

        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: buildOAuthCallbackUrl(
              window.location.origin,
              nextPath,
            ),
          },
        });

        if (error) {
          /* Supabase's message here is configuration-shaped ("provider
             is not enabled"), which is not the visitor's problem and
             not theirs to read. */
          console.error(`[OAUTH_START_ERROR:${provider}]`, error.message);
          onError(
            "That sign-in option is unavailable right now. Please try again, or use your email and password.",
          );
          setPending(null);
        }
      } catch (err) {
        console.error(`[OAUTH_START_ERROR:${provider}]`, err);
        onError(
          "That sign-in option is unavailable right now. Please try again, or use your email and password.",
        );
        setPending(null);
      }
    },
    [nextPath, onError],
  );

  return { pending, signIn };
}
