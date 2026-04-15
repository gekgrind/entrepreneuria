import { AvatarManagementForm } from "@/components/auth/avatar-management-form";
import { UserAvatar } from "@/components/auth/user-avatar";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getProfileIdentity } from "@/lib/identity/profile-avatar";

type AvatarPageState =
  | {
      status: "unauthenticated";
      message: string;
    }
  | {
      status: "missing-profile";
      message: string;
    }
  | {
      status: "ready";
      email: string | null;
      fullName: string | null;
      avatarUrl: string | null;
    };

async function getAvatarPageState(): Promise<AvatarPageState> {
  let userId: string;

  try {
    const user = await requireAuthenticatedUser();
    userId = user.id;
  } catch {
    return {
      status: "unauthenticated",
      message: "You must be signed in to manage an avatar.",
    };
  }

  const profile = await getProfileIdentity(userId);

  if (!profile) {
    return {
      status: "missing-profile",
      message:
        "Profile row is missing. Create a profile row for this user before uploading an avatar.",
    };
  }

  return {
    status: "ready",
    email: profile.email,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
  };
}

export default async function AvatarPage() {
  const state = await getAvatarPageState();

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Avatar</h1>

      {state.status === "ready" ? (
        <>
          <div className="flex items-center gap-4">
            <UserAvatar
              avatarUrl={state.avatarUrl}
              displayName={state.fullName}
              email={state.email}
              className="h-16 w-16"
            />
            <p className="text-sm text-muted-foreground">
              Upload a JPG, PNG, WEBP, or GIF up to 2MB.
            </p>
          </div>

          <AvatarManagementForm currentAvatarUrl={state.avatarUrl} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      )}
    </section>
  );
}
