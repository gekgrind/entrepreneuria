import { NextResponse } from "next/server";

/*
 * What refreshSessionThroughServer calls. The proxy refreshes the session
 * on the way here and says whether it could (`X-Auth-Session`); this
 * handler reads and writes nothing, so no second Supabase client can
 * refresh the same session or remove it during an Auth API outage.
 */
export function GET() {
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
