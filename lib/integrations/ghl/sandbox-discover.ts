/**
 * Read-only discovery and identity check for the GHL SANDBOX sub-account.
 *
 * Every request goes through `readOnlyFetch`, which throws before sending
 * anything that isn't a GET, so this module cannot write to GHL.
 *
 * Used two ways:
 *   - scripts/ghl-sandbox-discover.mts prints the location name, pipeline,
 *     stage and custom-field ids (ids are not secrets) so the owner can fill
 *     in the sandbox env file without copying ids from the GHL UI.
 *   - scripts/ghl-sandbox-check.mts --live calls `verifySandboxIdentity`
 *     before its first write and refuses unless the token reaches a location
 *     whose name is exactly the expected one and contains "sandbox", and the
 *     configured pipeline, stage and field ids all belong to it.
 *
 * Output never includes the token, contact data or response bodies.
 */

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const SANDBOX_FIELDS = ["style_interest", "package_interest"] as const;
type SandboxField = (typeof SANDBOX_FIELDS)[number];

export interface DiscoverInput {
  token: string;
  locationId: string;
  apiVersion?: string;
  baseUrl?: string;
  fetch: FetchLike;
}

export interface Probe {
  /** What was read, e.g. "location". */
  name: string;
  /** The read scope the endpoint needs (GHL scopes table). */
  scope: string;
  ok: boolean;
  status: number | null;
  detail: string;
}

export interface Discovery {
  probes: Probe[];
  location: { id: string; name: string } | null;
  pipelines: Array<{ id: string; name: string; stages: Array<{ id: string; name: string }> }>;
  fields: Record<SandboxField, Array<{ id: string; name: string; fieldKey: string; dataType: string }>>;
  workflows: { total: number; active: number } | null;
  contactTotal: number | null;
}

/** Refuses anything but GET before it reaches the network. */
export function readOnlyFetch(inner: FetchLike): FetchLike {
  return (url, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method !== "GET") return Promise.reject(new Error(`read-only: refused ${method} ${new URL(url).pathname}`));
    if (init?.body != null) return Promise.reject(new Error("read-only: refused a GET with a body"));
    return inner(url, init);
  };
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function discoverSandbox(input: DiscoverInput): Promise<Discovery> {
  const base = (input.baseUrl ?? "https://services.leadconnectorhq.com").replace(/\/$/, "");
  const f = readOnlyFetch(input.fetch);
  const headers = { Authorization: `Bearer ${input.token}`, Version: input.apiVersion ?? "2021-07-28", Accept: "application/json" };
  const loc = encodeURIComponent(input.locationId);
  const probes: Probe[] = [];

  async function get(name: string, scope: string, path: string): Promise<any | null> {
    try {
      const res = await f(`${base}${path}`, { headers });
      const data = res.ok ? await res.json().catch(() => null) : null;
      const hint = res.status === 401 || res.status === 403 ? ` (token lacks ${scope}, or wrong location)` : "";
      probes.push({ name, scope, ok: res.ok && data != null, status: res.status, detail: res.ok ? (data ? "readable" : "unreadable body") : `HTTP ${res.status}${hint}` });
      return res.ok ? data : null;
    } catch (err) {
      probes.push({ name, scope, ok: false, status: null, detail: (err as Error).message });
      return null;
    }
  }

  const locData = await get("location", "locations.readonly", `/locations/${loc}`);
  const l = locData?.location;
  const location = l && str(l.id) ? { id: str(l.id), name: str(l.name) } : null;

  const pipeData = await get("pipelines", "opportunities.readonly", `/opportunities/pipelines?locationId=${loc}`);
  const pipelines = (Array.isArray(pipeData?.pipelines) ? pipeData.pipelines : []).map((p: any) => ({
    id: str(p?.id),
    name: str(p?.name),
    stages: (Array.isArray(p?.stages) ? p.stages : []).map((s: any) => ({ id: str(s?.id), name: str(s?.name) })),
  }));

  const cfData = await get("custom fields", "locations/customFields.readonly", `/locations/${loc}/customFields?model=contact`);
  const all = Array.isArray(cfData?.customFields) ? cfData.customFields : [];
  const fields = Object.fromEntries(
    SANDBOX_FIELDS.map((n) => [
      n,
      all
        .filter((c: any) => str(c?.fieldKey).toLowerCase() === `contact.${n}` || str(c?.name).toLowerCase() === n)
        .map((c: any) => ({ id: str(c.id), name: str(c.name), fieldKey: str(c.fieldKey), dataType: str(c.dataType) })),
    ])
  ) as Discovery["fields"];

  const wfData = await get("workflows", "workflows.readonly", `/workflows/?locationId=${loc}`);
  const wfs = Array.isArray(wfData?.workflows) ? wfData.workflows : null;
  const workflows = wfs ? { total: wfs.length, active: wfs.filter((w: any) => w?.status !== "draft").length } : null;

  // contacts.readonly, through the same endpoint the adapter's duplicate lookup uses, with an
  // address that can't exist. Returns no contact data.
  await get("duplicate search", "contacts.readonly", `/contacts/search/duplicate?locationId=${loc}&email=${encodeURIComponent("ghl-sandbox+scope-probe@example.com")}`);

  // Only the total is kept; contact records are discarded unread.
  const ctData = await get("contact count", "contacts.readonly", `/contacts/?locationId=${loc}&limit=1`);
  const total = ctData?.meta?.total;
  const contactTotal = typeof total === "number" ? total : null;

  return { probes, location, pipelines, fields, workflows, contactTotal };
}

export interface IdentityExpectation {
  locationId: string;
  expectedLocationName: string;
  pipelineId: string;
  pipelineStageId: string;
  customFieldIds: Partial<Record<string, string>>;
}

/** Hard identity gate for --live. Every failure is a reason to stop. */
export function checkIdentity(d: Discovery, want: IdentityExpectation): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const p of d.probes) {
    if (!p.ok && p.name !== "contact count") errors.push(`cannot read ${p.name}: ${p.detail}`);
  }
  if (!d.location) {
    errors.push("location could not be read; sandbox identity is unverified");
  } else {
    if (d.location.id !== want.locationId) errors.push("the token reached a different location id than GHL_SANDBOX_LOCATION_ID");
    if (!want.expectedLocationName) errors.push("GHL_SANDBOX_EXPECT_LOCATION_NAME is required");
    else if (d.location.name !== want.expectedLocationName) errors.push(`location name is "${d.location.name}", expected "${want.expectedLocationName}"`);
    if (!/sandbox/i.test(d.location.name)) errors.push(`location name "${d.location.name}" does not contain "sandbox"; refusing`);
  }
  const pipe = d.pipelines.find((p) => p.id === want.pipelineId);
  if (!pipe) errors.push("GHL_SANDBOX_PIPELINE_ID is not a pipeline in this location");
  else if (!pipe.stages.some((s) => s.id === want.pipelineStageId)) errors.push("GHL_SANDBOX_PIPELINE_STAGE_ID is not a stage of that pipeline");
  for (const n of SANDBOX_FIELDS) {
    const id = want.customFieldIds[n];
    if (!id) errors.push(`GHL_SANDBOX_CUSTOM_FIELD_IDS has no ${n}`);
    else if (!d.fields[n].some((f) => f.id === id)) errors.push(`custom field id for ${n} is not the location's ${n} field`);
  }
  if (!d.workflows) errors.push("workflow list unreadable");
  else if (d.workflows.active) errors.push(`${d.workflows.active} workflow(s) not in draft`);
  return { ok: errors.length === 0, errors };
}

export async function verifySandboxIdentity(
  config: { token: string; locationId: string; apiVersion: string; baseUrl?: string; pipelineId: string; pipelineStageId: string; customFieldIds: Partial<Record<string, string>> },
  expectedLocationName: string,
  fetch: FetchLike
) {
  const d = await discoverSandbox({ token: config.token, locationId: config.locationId, apiVersion: config.apiVersion, baseUrl: config.baseUrl, fetch });
  return { discovery: d, ...checkIdentity(d, { ...config, expectedLocationName }) };
}
