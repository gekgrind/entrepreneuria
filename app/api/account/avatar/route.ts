import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { clearAvatar, uploadAvatarAndPersist } from "@/lib/identity/profile-avatar";

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const formData = await request.formData();
    const candidate = formData.get("avatar");

    if (!(candidate instanceof File)) {
      return NextResponse.json({ error: "Please select an image to upload." }, { status: 400 });
    }

    const profile = await uploadAvatarAndPersist({ userId: user.id, file: candidate });

    revalidatePath("/account");
    revalidatePath("/account/avatar");

    return NextResponse.json({ avatarUrl: profile.avatar_url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Avatar upload failed.";
    const status = message.toLowerCase().includes("signed in") ? 401 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE() {
  try {
    const user = await requireAuthenticatedUser();

    await clearAvatar(user.id);

    revalidatePath("/account");
    revalidatePath("/account/avatar");

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove avatar.";
    const status = message.toLowerCase().includes("signed in") ? 401 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
