/**
 * Provider metadata normalization.
 *
 * Supabase copies each provider's profile claims into `user_metadata`
 * verbatim, and the providers disagree about the shape:
 *
 *   Google  full_name, name, avatar_url, picture, email
 *   GitHub  full_name, name, user_name, preferred_username, avatar_url
 *
 * GitHub's `full_name`/`name` are null whenever the account has no
 * display name set, and the email is absent entirely when the account
 * keeps it private. Reading a single key would therefore leave GitHub
 * users nameless — so every consumer resolves identity through these
 * helpers instead of indexing metadata directly.
 *
 * Nothing here is provider-branched: the fallbacks are ordered from
 * most to least human, and each provider simply supplies whichever
 * keys it has.
 */

export type UserMetadata = Record<string, unknown> | null | undefined;

/** Non-empty trimmed string, or null. Metadata values are untyped. */
function readString(metadata: UserMetadata, key: string) {
  const value = metadata?.[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function firstString(metadata: UserMetadata, keys: readonly string[]) {
  for (const key of keys) {
    const value = readString(metadata, key);

    if (value) {
      return value;
    }
  }

  return null;
}

const NAME_KEYS = [
  "full_name",
  "name",
  // GitHub's handle. Not a real name, but far better than an empty
  // account menu — and it is what the visitor calls themselves there.
  "user_name",
  "preferred_username",
  "nickname",
] as const;

const AVATAR_KEYS = ["avatar_url", "picture"] as const;

/**
 * A display name for the account, falling back to the local part of
 * the email so the UI always has something to render.
 */
export function resolveDisplayName(
  metadata: UserMetadata,
  email?: string | null,
) {
  const fromMetadata = firstString(metadata, NAME_KEYS);

  if (fromMetadata) {
    return fromMetadata;
  }

  const localPart = email?.split("@")[0]?.trim();

  return localPart ? localPart : null;
}

export function resolveAvatarUrl(metadata: UserMetadata) {
  const value = firstString(metadata, AVATAR_KEYS);

  if (!value) {
    return null;
  }

  /* Provider metadata is attacker-influenceable in principle, and this
     value is rendered as an image `src`. Only http(s) may through. */
  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * The authenticated email. `user.email` from Supabase is canonical;
 * metadata is only consulted when the provider withheld it there.
 * GitHub accounts with a private email may have neither, which is a
 * supported state — callers must tolerate null.
 */
export function resolveEmail(metadata: UserMetadata, email?: string | null) {
  const canonical = email?.trim();

  if (canonical) {
    return canonical;
  }

  return readString(metadata, "email");
}
