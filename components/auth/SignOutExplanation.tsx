import { SIGN_OUT_EXPLANATION } from "@/lib/auth/sign-out-client";

/* Stable, page-unique ids: the header's mobile menu and the user menu can
   be on one page at the same time. */
export const SIGN_OUT_DESCRIPTION_IDS = {
  headerMobile: "header-mobile-signout-description",
  userMenu: "user-menu-signout-description",
  accountMenu: "account-menu-signout-description",
} as const;

/**
 * Visible text that a sign-out control points at with aria-describedby, so
 * the qualification reaches keyboard, touch and screen-reader users and
 * not only hover.
 */
export function SignOutExplanation({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  return (
    <p id={id} className={className}>
      {SIGN_OUT_EXPLANATION}
    </p>
  );
}
