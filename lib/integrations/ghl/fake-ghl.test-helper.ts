/**
 * In-memory stand-in for the GHL v2 endpoints the adapter uses. Test-only.
 * No network, no real data.
 *
 * Modeled behavior, from the OpenAPI spec:
 *   - /contacts/upsert matches an existing contact by email, then by phone,
 *     and UPDATES the fields it is sent ("will create or update the contact
 *     accordingly"); a `tags` field OVERWRITES all tags ("This field will
 *     overwrite all current tags…"). The response carries `new`.
 *   - /contacts/search/duplicate?email=|number= returns `{ contact }`, with
 *     `contact: null` when there is none. (The real response body is not in
 *     the published spec; this is the shape the adapter requires.)
 *   - /contacts/{id}/tags is additive.
 *   - Custom fields are addressed by id. An unknown id is rejected with 422
 *     in `strictFields` mode, otherwise ignored (left out of the response).
 *
 * Faults are matched in order and consumed:
 *   status         respond with that status (not applied)
 *   applied-500    apply, then respond 500 (ambiguous outcome)
 *   timeout        hang until the caller aborts (not applied)
 *   applied-hang   apply, then hang until abort (ambiguous outcome)
 *   garbage-200    respond 200 with a body that isn't JSON (not applied)
 *   stall-body     respond 200 headers, then the body never finishes (not applied)
 *
 * `searchLag`: an opportunity stays invisible to /opportunities/search for
 * this many searches after it's created, like an index that lags.
 */

export interface FakeContact {
  id: string;
  email: string;
  phone?: string;
  /** name, companyName, website, source as last written. */
  fields: Record<string, unknown>;
  tags: Set<string>;
  customFields: Map<string, string>;
}
export interface FakeOpportunity {
  id: string;
  contactId: string;
  pipelineId: string;
  status: string;
  name: string;
}
type FaultKind = number | "applied-500" | "timeout" | "applied-hang" | "garbage-200" | "stall-body";
export interface Fault {
  method: string;
  path: RegExp;
  kind: FaultKind;
  headers?: Record<string, string>;
}

export function createFakeGhl(opts: { knownFieldIds?: string[]; strictFields?: boolean; searchLag?: number; rejectPhones?: boolean } = {}) {
  const hiddenFor = new Map<string, number>();
  const contacts = new Map<string, FakeContact>();
  const opportunities: FakeOpportunity[] = [];
  const notes = new Map<string, Array<{ id: string; body: string }>>();
  const known = new Set(opts.knownFieldIds ?? []);
  const faults: Fault[] = [];
  const calls: Array<{ method: string; path: string; body: any; headers: Record<string, string> }> = [];
  let seq = 0;
  const id = (p: string) => `${p}_${++seq}`;

  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
  const tick = () => new Promise((r) => setImmediate(r));
  const hang = (signal?: AbortSignal | null) =>
    new Promise<Response>((_, reject) => {
      signal?.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")));
    });

  function hide(oid: string) {
    const n = hiddenFor.get(oid) ?? 0;
    if (n <= 0) return false;
    hiddenFor.set(oid, n - 1);
    return true;
  }

  function handle(method: string, path: string, query: URLSearchParams, body: any): Response {
    if (method === "POST" && path === "/contacts/upsert") {
      for (const f of body.customFields ?? []) {
        if (!f.id) return json(422, { message: "custom field id required" });
        if (!known.has(f.id) && opts.strictFields) return json(422, { message: "invalid custom field" });
      }
      if (body.phone && opts.rejectPhones) return json(400, { message: "invalid phone" });
      let c =
        [...contacts.values()].find((x) => x.email === body.email) ??
        (body.phone ? [...contacts.values()].find((x) => x.phone === body.phone) : undefined);
      const created = !c;
      if (!c) {
        c = { id: id("ct"), email: body.email, fields: {}, tags: new Set(), customFields: new Map() };
        contacts.set(c.id, c);
      }
      if (body.phone) c.phone = body.phone;
      for (const k of ["name", "companyName", "website", "source"]) if (k in body) c.fields[k] = body[k];
      if (Array.isArray(body.tags)) c.tags = new Set(body.tags); // documented overwrite
      for (const f of body.customFields ?? []) if (known.has(f.id)) c.customFields.set(f.id, f.field_value);
      return json(200, {
        new: created,
        contact: { id: c.id, customFields: [...c.customFields].map(([fid, value]) => ({ id: fid, value })) },
      });
    }
    if (method === "GET" && path === "/contacts/search/duplicate") {
      const email = query.get("email");
      const number = query.get("number");
      const c = [...contacts.values()].find((x) => (email ? x.email === email : number ? x.phone === number : false));
      return json(200, { contact: c ? { id: c.id, email: c.email } : null });
    }
    let m = path.match(/^\/contacts\/([^/]+)\/tags$/);
    if (m && method === "POST") {
      const c = contacts.get(m[1]);
      if (!c) return json(400, {});
      for (const t of body.tags) c.tags.add(t);
      return json(201, { tags: [...c.tags] });
    }
    if (method === "GET" && path === "/opportunities/search") {
      const found = opportunities.filter(
        (o) =>
          !hide(o.id) &&
          o.contactId === query.get("contact_id") &&
          o.pipelineId === query.get("pipeline_id") &&
          (query.get("status") === "all" || o.status === query.get("status"))
      );
      return json(200, { opportunities: found.map((o) => ({ id: o.id })), meta: { total: found.length } });
    }
    if (method === "POST" && path === "/opportunities/") {
      const o = { id: id("op"), contactId: body.contactId, pipelineId: body.pipelineId, status: body.status, name: body.name };
      opportunities.push(o);
      if (opts.searchLag) hiddenFor.set(o.id, opts.searchLag);
      return json(201, { opportunity: { id: o.id } });
    }
    m = path.match(/^\/contacts\/([^/]+)\/notes$/);
    if (m && method === "GET") return json(200, { notes: notes.get(m[1]) ?? [] });
    if (m && method === "POST") {
      const n = { id: id("nt"), body: body.body };
      notes.set(m[1], [...(notes.get(m[1]) ?? []), n]);
      return json(201, { note: n });
    }
    return json(404, { message: `no route ${method} ${path}` });
  }

  async function fetch(url: string, init?: RequestInit): Promise<Response> {
    const u = new URL(url);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, path: u.pathname, body, headers: (init?.headers ?? {}) as Record<string, string> });
    await tick(); // lets concurrent syncs interleave
    const fi = faults.findIndex((f) => f.method === method && f.path.test(u.pathname));
    if (fi >= 0) {
      const [fault] = faults.splice(fi, 1);
      if (typeof fault.kind === "number") return json(fault.kind, {}, fault.headers);
      if (fault.kind === "timeout") return hang(init?.signal);
      if (fault.kind === "garbage-200") return new Response("<html>gateway</html>", { status: 200 });
      if (fault.kind === "stall-body") {
        const signal = init?.signal;
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"partial":'));
            signal?.addEventListener("abort", () => controller.error(new DOMException("The operation was aborted.", "AbortError")));
          },
        });
        return new Response(stream, { status: 200 });
      }
      handle(method, u.pathname, u.searchParams, body); // applied…
      if (fault.kind === "applied-500") return json(500, {});
      return hang(init?.signal); // …then the response never arrives
    }
    return handle(method, u.pathname, u.searchParams, body);
  }

  return {
    fetch,
    calls,
    contacts,
    opportunities,
    notes,
    fail: (...f: Fault[]) => faults.push(...f),
    count: (method: string, path: string | RegExp) =>
      calls.filter((c) => c.method === method && (typeof path === "string" ? c.path === path : path.test(c.path))).length,
    seedContact(email: string, tags: string[], customFields: Record<string, string> = {}, extra: { phone?: string; fields?: Record<string, unknown> } = {}) {
      const c: FakeContact = {
        id: id("ct"),
        email,
        phone: extra.phone,
        fields: { ...(extra.fields ?? {}) },
        tags: new Set(tags),
        customFields: new Map(Object.entries(customFields)),
      };
      contacts.set(c.id, c);
      return c;
    },
  };
}
