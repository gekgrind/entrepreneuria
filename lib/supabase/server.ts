import "server-only";

type WaitlistEntry = {
  email: string;
  source: string;
};

type SupabaseErrorPayload = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getRestUrl() {
  const baseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");

  return `${baseUrl.replace(/\/$/, "")}/rest/v1/waitlist?columns=email,source`;
}

function getHeaders() {
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return {
    "Content-Type": "application/json",
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Prefer: "return=minimal",
  };
}

export async function insertWaitlistEntry(entry: WaitlistEntry) {
  const controller = new AbortController();
  const WAITLIST_TIMEOUT_MS = 5000;
  const timeout = setTimeout(() => controller.abort(), WAITLIST_TIMEOUT_MS); // 5 seconds

  let response: Response;

  try {
    response = await fetch(getRestUrl(), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(entry),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Waitlist request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (response.ok) {
    return;
  }

  const error = (await response.json().catch(() => ({}))) as SupabaseErrorPayload;

  const failure = new Error(
    error.message ?? "Supabase waitlist insert failed"
  ) as Error & {
    code?: string;
    details?: string;
    hint?: string;
  };

  failure.code = error.code;
  failure.details = error.details;
  failure.hint = error.hint;

  throw failure;
}
