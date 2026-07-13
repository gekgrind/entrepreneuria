"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

const ETSY_SHOP_URL =
  "https://www.etsy.com/shop/Entrepreneuria?utm_source=entrepreneuria.io&utm_medium=referral&utm_campaign=waitlist_success";

export function HomeWaitlistForm({ source }: { source: string }) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setStatus("error");
      setMessage("Please enter your email address.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, source, company }),
      });

      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "We couldn't add you to the waitlist.");
        return;
      }

      setStatus("success");
      setMessage(data.message ?? "You're on the list.");
      setEmail("");
      setCompany("");
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again in a moment.");
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-white/15 bg-white/[0.04] p-6"
      >
        <p className="text-base font-semibold text-white">
          You&apos;re in. {message}
        </p>
        <p className="mt-2 text-sm leading-6 text-white/65">
          While you wait, the founder tool shop is open today.
        </p>
        <a
          href={ETSY_SHOP_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white"
        >
          Browse the shop <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={`waitlist-email-${source}`} className="sr-only">
          Email address
        </label>
        <input
          id={`waitlist-email-${source}`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@yourbusiness.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={status === "loading"}
          required
          className="h-13 min-w-0 flex-1 rounded-full !border-white/15 !bg-white/[0.06] px-5 text-[15px] !text-white outline-none transition placeholder:!text-white/40 focus:!border-white/40"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="h-13 shrink-0 rounded-full bg-[var(--brand-orange)] px-7 text-[15px] font-semibold text-white transition hover:bg-[#b96a24] disabled:opacity-60"
        >
          {status === "loading" ? "Joining…" : "Join the waitlist"}
        </button>
      </div>

      {/* Honeypot */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor={`waitlist-company-${source}`}>Company</label>
        <input
          id={`waitlist-company-${source}`}
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
      </div>

      {status === "error" && message ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
