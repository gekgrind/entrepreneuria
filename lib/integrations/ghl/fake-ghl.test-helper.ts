/**
 * In-memory stand-in for the GHL v2 endpoints the adapter uses. Test-only.
 * No network, no real data.
 *
 * Modeled behavior, from the OpenAPI spec:
 *   - GET /contacts/search/duplicate?email= returns { contact: { id } | null }.
 *   - /contacts/upsert dedupes by email, OVERWRITES every field it is sent
 *     on an existing contact, and a `tags` field OVERWRITES all tags ("This
 *     field will overwrite all current tags…"). It answers `new: true` only
 *     when it created the contact.
 *   - PUT /contacts/{id} updates the fields it is sent; GET returns the contact.
 *   - GET /workflows/ lists `workflows` (none unless seeded).
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
 *
 * Sandbox-harness support (not documented GHL behaviour, modelled
 * conservatively):
 *   - DELETE /contacts/{id} removes the contact and its notes but NOT its
 *     opportunities (whether GHL cascades is undocumented, so the harness
 *     must delete opportunities itself).
 *   - GET/DELETE /opportunities/{id}; a missing one is 404.
 *   - /opportunities/search filters by contact_id, pipeline_id and
 *     pipeline_stage_id only when given; `ignoreStageFilter` and
 *     `ignorePipelineFilter` simulate GHL ignoring those filters.
 *   - GET /contacts/?locationId=&limit= lists contact ids with meta.total.
 */

export interface FakeContact {
  id: string;
  email: string;
  phone?: string;
  name?: string;
  companyName?: string;
  website?: string;
  source?: string;
  tags: Set<string>;
  customFields: Map<string, string>;
}
export interface FakeOpportunity {
  id: string;
  contactId: string;
  pipelineId: string;
  stageId?: string;
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

export interface FakeLocation {
  id: string;
  name: string;
  pipelines: Array<{ id: string; name: string; stages: Array<{ id: string; name: string }> }>;
  customFields: Array<{ id: string; name: string; fieldKey: string; dataType: string }>;
}

export function createFakeGhl(
  opts: {
    knownFieldIds?: string[];
    strictFields?: boolean;
    searchLag?: number;
    rejectPhones?: boolean;
    location?: FakeLocation;
    ignoreStageFilter?: boolean;
    ignorePipelineFilter?: boolean;
  } = {}
) {
  const hiddenFor = new Map<string, number>();
  const contacts = new Map<string, FakeContact>();
  const opportunities: FakeOpportunity[] = [];
  const notes = new Map<string, Array<{ id: string; body: string }>>();
  const known = new Set(opts.knownFieldIds ?? []);
  const faults: Fault[] = [];
  const workflows: Array<{ id: string; name: string; status: string }> = [];
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

  function validateFields(body: any): Response | null {
    for (const f of body.customFields ?? []) {
      if (!f.id) return json(422, { message: "custom field id required" });
      if (!known.has(f.id) && opts.strictFields) return json(422, { message: "invalid custom field" });
    }
    if (body.phone && opts.rejectPhones) return json(400, { message: "invalid phone" });
    return null;
  }
  function apply(c: FakeContact, body: any) {
    for (const k of ["phone", "name", "companyName", "website", "source"] as const) if (body[k]) c[k] = body[k];
    if (Array.isArray(body.tags)) c.tags = new Set(body.tags); // documented overwrite
    for (const f of body.customFields ?? []) if (known.has(f.id)) c.customFields.set(f.id, f.field_value);
  }
  const contactBody = (c: FakeContact) => ({
    id: c.id,
    customFields: [...c.customFields].map(([fid, value]) => ({ id: fid, value })),
  });

  function handle(method: string, path: string, query: URLSearchParams, body: any): Response {
    if (method === "POST" && path === "/contacts/upsert") {
      const bad = validateFields(body);
      let c = [...contacts.values()].find((x) => x.email === body.email);
      const created = !c;
      if (!c) {
        c = { id: id("ct"), email: body.email, tags: new Set(), customFields: new Map() };
        contacts.set(c.id, c);
      }
      if (bad) return bad;
      apply(c, body);
      return json(200, { new: created, contact: contactBody(c) });
    }
    if (method === "GET" && path === "/workflows/") return json(200, { workflows });
    // Read-only location metadata (discovery/identity). Unknown location → 404, as a token for another location would see.
    const loc = opts.location;
    if (method === "GET" && /^\/locations\/[^/]+$/.test(path)) {
      return loc && path.endsWith(`/${loc.id}`) ? json(200, { location: { id: loc.id, name: loc.name } }) : json(404, {});
    }
    if (method === "GET" && /^\/locations\/[^/]+\/customFields$/.test(path)) {
      return loc && path === `/locations/${loc.id}/customFields` ? json(200, { customFields: loc.customFields }) : json(404, {});
    }
    if (method === "GET" && path === "/opportunities/pipelines") {
      return loc && query.get("locationId") === loc.id ? json(200, { pipelines: loc.pipelines }) : json(404, {});
    }
    if (method === "GET" && path === "/contacts/") {
      const limit = Number(query.get("limit") ?? 20);
      return json(200, { contacts: [...contacts.values()].slice(0, limit).map((c) => ({ id: c.id })), meta: { total: contacts.size } });
    }
    if (method === "GET" && path === "/contacts/search/duplicate") {
      const email = query.get("email");
      const c = [...contacts.values()].find((x) => x.email === email);
      return json(200, { contact: c ? { id: c.id } : null });
    }
    let m = path.match(/^\/contacts\/([^/]+)$/);
    if (m && method === "DELETE") {
      const removed = contacts.delete(m[1]);
      notes.delete(m[1]);
      return json(removed ? 200 : 404, { succeded: removed });
    }
    if (m && method === "GET") {
      const c = contacts.get(m[1]);
      if (!c) return json(400, { message: "contact not found" });
      return json(200, {
        contact: {
          ...contactBody(c),
          email: c.email,
          phone: c.phone,
          name: c.name,
          companyName: c.companyName,
          website: c.website,
          tags: [...c.tags],
        },
      });
    }
    if (m && method === "PUT") {
      const c = contacts.get(m[1]);
      if (!c) return json(400, { message: "contact not found" });
      const bad = validateFields(body);
      if (bad) return bad;
      apply(c, body);
      return json(200, { succeded: true, contact: contactBody(c) });
    }
    m = path.match(/^\/contacts\/([^/]+)\/tags$/);
    if (m && method === "POST") {
      const c = contacts.get(m[1]);
      if (!c) return json(400, {});
      for (const t of body.tags) c.tags.add(t);
      return json(201, { tags: [...c.tags] });
    }
    if (method === "GET" && path === "/opportunities/search") {
      const contactId = query.get("contact_id");
      const stageId = query.get("pipeline_stage_id");
      const pipelineId = query.get("pipeline_id");
      const found = opportunities.filter(
        (o) =>
          !hide(o.id) &&
          (!contactId || o.contactId === contactId) &&
          (!pipelineId || opts.ignorePipelineFilter || o.pipelineId === pipelineId) &&
          (!stageId || opts.ignoreStageFilter || o.stageId === stageId) &&
          (query.get("status") === "all" || o.status === query.get("status"))
      );
      return json(200, {
        opportunities: found.map((o) => ({ id: o.id, name: o.name, contactId: o.contactId, pipelineId: o.pipelineId, pipelineStageId: o.stageId, status: o.status })),
        meta: { total: found.length },
      });
    }
    if (method === "POST" && path === "/opportunities/") {
      const o = {
        id: id("op"),
        contactId: body.contactId,
        pipelineId: body.pipelineId,
        stageId: body.pipelineStageId,
        status: body.status,
        name: body.name,
      };
      opportunities.push(o);
      if (opts.searchLag) hiddenFor.set(o.id, opts.searchLag);
      return json(201, { opportunity: { id: o.id } });
    }
    m = path.match(/^\/opportunities\/([^/]+)$/);
    if (m && (method === "GET" || method === "DELETE")) {
      const i = opportunities.findIndex((o) => o.id === m![1]);
      if (i < 0) return json(404, { message: "opportunity not found" });
      const o = opportunities[i];
      if (method === "DELETE") {
        opportunities.splice(i, 1);
        return json(200, { succeded: true });
      }
      return json(200, { opportunity: { id: o.id, name: o.name, contactId: o.contactId, pipelineId: o.pipelineId, pipelineStageId: o.stageId, status: o.status } });
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
    workflows,
    fail: (...f: Fault[]) => faults.push(...f),
    count: (method: string, path: string | RegExp) =>
      calls.filter((c) => c.method === method && (typeof path === "string" ? c.path === path : path.test(c.path))).length,
    seedContact(email: string, tags: string[], customFields: Record<string, string> = {}, details: Partial<FakeContact> = {}) {
      const c: FakeContact = { ...details, id: id("ct"), email, tags: new Set(tags), customFields: new Map(Object.entries(customFields)) };
      contacts.set(c.id, c);
      return c;
    },
  };
}
