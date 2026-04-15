import { NextResponse } from "next/server";
import { z } from "zod";

import { insertWaitlistEntry } from "@/lib/supabase/waitlist-server";

const waitlistSchema = z
  .object({
    email: z.string().trim().email(),
    source: z.string().trim().optional(),
    company: z.string().trim().max(200).optional(),
  })
  .strict();

const ALLOWED_SOURCES = new Set(["waitlist page", "/waitlist"]);

export async function POST(request: Request) {
  try {
    const payload = waitlistSchema.parse(await request.json());

    if (payload.company) {
      return NextResponse.json(
        { message: "You're on the waitlist. We'll reach out when your spot is ready." },
        { status: 200 }
      );
    }

    const email = payload.email.trim().toLowerCase();
    const source =
  payload.source && ALLOWED_SOURCES.has(payload.source)
    ? payload.source
    : "waitlist page";

    await insertWaitlistEntry({
      email,
      source,
    });

    return NextResponse.json(
      { message: "You're on the waitlist. We'll reach out when your spot is ready." },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    if (
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "23505"
) {
      return NextResponse.json(
        {
          message:
            "You're already on the waitlist. We'll reach out when your spot is ready.",
        },
        { status: 200 }
      );
    }

    console.error("Waitlist API error", error);

    return NextResponse.json(
      { error: "Unable to join the waitlist right now. Please try again shortly." },
      { status: 500 }
    );
  }
}
