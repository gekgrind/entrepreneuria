"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status = "idle" | "loading" | "success" | "error";

const DEFAULT_SOURCE = "waitlist page";

export function WaitlistForm() {
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
          source: DEFAULT_SOURCE,
          company,
        }),
      });

      const data = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "We couldn't add you to the waitlist.");
        return;
      }

      setStatus("success");
      setMessage(
        data.message ?? "You're on the waitlist. We'll be in touch soon."
      );
      setEmail("");
      setCompany("");
    } catch (error) {
      console.error("Waitlist submission failed", error);
      setStatus("error");
      setMessage("Something went wrong. Please try again in a moment.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="waitlist-email"
          className="text-sm font-medium text-[var(--brand-navy)]"
        >
          Email address
        </label>
        <Input
          id="waitlist-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={status === "loading"}
          className="h-12 rounded-2xl border-slate-300 bg-slate-50 px-4 text-[15px] text-slate-900 placeholder:text-slate-400 focus-visible:ring-[var(--brand-accent)]"
          required
        />
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="waitlist-company">Company</label>
        <input
          id="waitlist-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
      </div>

      <Button
        type="submit"
        disabled={status === "loading"}
        className="h-12 w-full rounded-full bg-[var(--brand-navy)] text-sm font-semibold text-white hover:bg-[#24385a]"
      >
        {status === "loading" ? "Joining..." : "Join the waitlist"}
      </Button>

      <p className="text-sm leading-7 text-slate-600">
        We&apos;ll use your email for launch updates and access invitations only.
      </p>

      {message ? (
        <p
          role="status"
          aria-live="polite"
          className={
            status === "error"
              ? "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              : "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          }
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}