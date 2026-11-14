import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { getTrustedSiteOrigins, isSameOriginRequest } from "@/lib/auth/same-origin";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { clearAvatar, uploadAvatarAndPersist } from "@/lib/identity/profile-avatar";

/*
 * The session cookie is scoped to `.entrepreneuria.io`, and every
 * subdomain is same-site, so SameSite=Lax alone would let any sibling
 * origin send these requests with the visitor's session. Only this
 * site's own pages may change the avatar.
 */
function refuseCrossOrigin(request: NextRequest) {
  if (isSameOriginRequest(request, getTrustedSiteOrigins(request))) {
    return null;
  }

  return NextResponse.json(
    { error: "This request must come from this site." },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const refused = refuseCrossOrigin(request);
  if (refused) return refused;

  try {
    const user = await requireAuthenticatedUser();
    const formData = await request.formData();
    const candidate = formData.get("avatar");

    if (!(candidate instanceof File)) {
      return NextResponse.json({ error: "Please select an image to upload." }, { status: 400 });
    }

    const profile = await uploadAvatarAndPersist({ userId: user.id, file: candidate });

    revalidatePath("/command-center");
    revalidatePath("/dashboard");
    revalidatePath("/account");
    revalidatePath("/account/avatar");
    revalidatePath("/settings");

    return NextResponse.json({ avatarUrl: profile.avatar_url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Avatar upload failed.";
    const status = message.toLowerCase().includes("signed in") ? 401 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const refused = refuseCrossOrigin(request);
  if (refused) return refused;

  try {
    const user = await requireAuthenticatedUser();

    await clearAvatar(user.id);

    revalidatePath("/command-center");
    revalidatePath("/dashboard");
    revalidatePath("/account");
    revalidatePath("/account/avatar");
    revalidatePath("/settings");

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove avatar.";
    const status = message.toLowerCase().includes("signed in") ? 401 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
