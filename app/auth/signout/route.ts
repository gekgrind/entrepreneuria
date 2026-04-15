import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { signOutUser } from "@/lib/supabase/auth-server";

export async function POST(request: Request) {
  await signOutUser();

  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });

  const cookieStore = await cookies();
  const authCookies = cookieStore
    .getAll()
    .filter(
      (cookie) =>
        cookie.name === "sb-access-token" ||
        cookie.name === "supabase-auth-token" ||
        (cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"))
    );

  for (const cookie of authCookies) {
    response.cookies.delete(cookie.name);
  }

  return response;
}