import { NextResponse } from "next/server";

import { getUser } from "@/lib/auth/get-user";

export async function GET() {
  const user = await getUser();

  return NextResponse.json(
    { user },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
