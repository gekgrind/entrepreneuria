import "server-only";

const AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET ?? "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type SupabaseErrorResponse = {
  code?: string;
  message?: string;
  details?: string;
};

type ProfileRecord = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getSupabaseBaseUrl() {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
}

function serviceHeaders() {
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

async function parseSupabaseError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as SupabaseErrorResponse;
  return payload.message ?? `Supabase request failed (${response.status}).`;
}

export function validateAvatarFile(file: File) {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return "Please upload a JPG, PNG, WEBP, or GIF image.";
  }

  if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
    return "Image must be less than 2MB.";
  }

  return null;
}

export async function getProfileIdentity(userId: string): Promise<ProfileRecord | null> {
  const response = await fetch(
    `${getSupabaseBaseUrl()}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,full_name,avatar_url&limit=1`,
    {
      method: "GET",
      headers: {
        ...serviceHeaders(),
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json()) as ProfileRecord[];
  return rows[0] ?? null;
}

function buildObjectPath(userId: string, extension: string) {
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `${userId}/avatar-${Date.now()}.${safeExtension}`;
}

export async function uploadAvatarAndPersist(args: { userId: string; file: File }) {
  const validationError = validateAvatarFile(args.file);
  if (validationError) {
    throw new Error(validationError);
  }

  const arrayBuffer = await args.file.arrayBuffer();
  const extensionFromType = args.file.type.split("/")[1] ?? "jpg";
  const objectPath = buildObjectPath(args.userId, extensionFromType);

  const uploadResponse = await fetch(
    `${getSupabaseBaseUrl()}/storage/v1/object/${AVATAR_BUCKET}/${objectPath}`,
    {
      method: "POST",
      headers: {
        ...serviceHeaders(),
        "Content-Type": args.file.type,
        "x-upsert": "true",
      },
      body: arrayBuffer,
      cache: "no-store",
    }
  );

  if (!uploadResponse.ok) {
    throw new Error(await parseSupabaseError(uploadResponse));
  }

  const publicUrl = `${getSupabaseBaseUrl()}/storage/v1/object/public/${AVATAR_BUCKET}/${objectPath}`;

  const updateResponse = await fetch(
    `${getSupabaseBaseUrl()}/rest/v1/profiles?id=eq.${encodeURIComponent(args.userId)}`,
    {
      method: "PATCH",
      headers: {
        ...serviceHeaders(),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ avatar_url: publicUrl }),
      cache: "no-store",
    }
  );

  if (!updateResponse.ok) {
    throw new Error(await parseSupabaseError(updateResponse));
  }

  const updatedRows = (await updateResponse.json()) as ProfileRecord[];

  if (!updatedRows[0]) {
    throw new Error("Profile row was not found for this user.");
  }

  return updatedRows[0];
}

export async function clearAvatar(userId: string) {
  const updateResponse = await fetch(
    `${getSupabaseBaseUrl()}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        ...serviceHeaders(),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ avatar_url: null }),
      cache: "no-store",
    }
  );

  if (!updateResponse.ok) {
    throw new Error(await parseSupabaseError(updateResponse));
  }

  const updatedRows = (await updateResponse.json()) as ProfileRecord[];

  if (!updatedRows[0]) {
    throw new Error("Profile row was not found for this user.");
  }

  return updatedRows[0];
}

export { AVATAR_BUCKET };
