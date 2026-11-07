import "server-only";

import type { InquiryRecord, InquiryStore } from "./intake";

/**
 * Supabase-backed inquiry store (table `website_inquiries`,
 * scripts/002_websites_services.sql). Service-role REST, server only.
 * Returns null when the store is not enabled, so intake can run CRM-only
 * until the owner approves and applies the migration.
 *
 * Enabled by WEBSITES_INQUIRY_STORE=supabase.
 */
const TIMEOUT_MS = 5000;

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

async function rest(path: string, init: RequestInit & { prefer?: string }) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const base = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/rest/v1/${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...(init.prefer ? { Prefer: init.prefer } : {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
      throw new Error(`website_inquiries ${init.method ?? "GET"} ${res.status}: ${detail.code ?? ""} ${detail.message ?? ""}`.trim());
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export function getSupabaseInquiryStore(): InquiryStore | null {
  if (process.env.WEBSITES_INQUIRY_STORE !== "supabase") return null;

  const store: InquiryStore = {
    async findByIdempotencyKey(key) {
      const res = await rest(`website_inquiries?idempotency_key=eq.${encodeURIComponent(key)}&limit=1`, { method: "GET" });
      const rows = (await res.json()) as InquiryRecord[];
      return rows[0] ?? null;
    },
    async insert(record) {
      const res = await rest("website_inquiries?on_conflict=idempotency_key", {
        method: "POST",
        prefer: "return=representation,resolution=ignore-duplicates",
        body: JSON.stringify(record),
      });
      const rows = (await res.json()) as InquiryRecord[];
      if (rows[0]) return { record: rows[0], created: true };
      const existing = await store.findByIdempotencyKey(record.idempotency_key);
      if (!existing) throw new Error("website_inquiries insert conflict without existing row");
      return { record: existing, created: false };
    },
    async update(id, patch) {
      await rest(`website_inquiries?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
      });
    },
  };
  return store;
}
