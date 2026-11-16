import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { WEBSITE_DEMOS } from "./demos";
import {
  INDUSTRIES,
  previewActionFor,
  publishedIndustries,
  publishedIndustry,
  publishedTemplates,
  WEBSITE_TEMPLATES,
  websiteTemplateSchema,
} from "./templates";

describe("template gallery registry", () => {
  it("publishes the three approved handyman demos unchanged, plus Aurelle for salons", () => {
    assert.deepEqual(
      publishedTemplates().map((t) => [t.industry, t.id]),
      [
        ["handyman", "redclay"],
        ["handyman", "porchlight"],
        ["handyman", "ashford"],
        ["salons", "aurelle"],
      ]
    );
    for (const d of WEBSITE_DEMOS) {
      const t = publishedTemplates("handyman").find((x) => x.id === d.id);
      assert.ok(t, d.id);
      assert.equal(t.url, d.url);
      assert.equal(t.styleInterest, d.style);
      assert.deepEqual(t.desktop, d.desktop);
      assert.equal(t.position, d.position);
    }
  });

  it("every published template is fictional, https, dated and has both screenshots on disk", () => {
    for (const t of publishedTemplates()) {
      assert.equal(t.fictional, true);
      assert.match(t.url, /^https:\/\//);
      assert.match(t.verifiedOn, /^\d{4}-\d{2}-\d{2}$/);
      for (const img of [t.desktop, t.mobile]) {
        assert.ok(existsSync(path.join(process.cwd(), "public", img.src)), img.src);
      }
      assert.equal(t.desktop.alt, "", "desktop shot is decorative (the heading names it)");
      assert.match(t.mobile.alt, /sample website on a phone$/);
    }
  });

  it("only industries with a published template are reachable", () => {
    assert.deepEqual(publishedIndustries().map((i) => i.slug), ["handyman", "salons"]);
    assert.equal(publishedIndustry("salons")?.name, "Hair salons");
    assert.equal(publishedIndustry("plumbers"), undefined);
    assert.equal(publishedIndustry("__proto__"), undefined);
    for (const t of WEBSITE_TEMPLATES) assert.ok(INDUSTRIES.some((i) => i.slug === t.industry));
  });

  it("styled templates prefill the Services form; others fall back to a prefilled email", () => {
    const handyman = publishedIndustry("handyman")!;
    const salons = publishedIndustry("salons")!;
    const [redclay] = publishedTemplates("handyman");
    const [aurelle] = publishedTemplates("salons");

    const form = previewActionFor(redclay, handyman);
    assert.equal(form.kind, "form");
    assert.equal(form.kind === "form" && form.href, "/services?style=local-professional&type=Handyman+or+home+repair#preview");

    const email = previewActionFor(aurelle, salons);
    assert.equal(email.kind, "email");
    assert.deepEqual(email.kind === "email" && email.lines, [
      ["Type of business", "Hair salons"],
      ["Website style", "Gilded Editorial (the Aurelle Salon example)"],
    ]);
  });
});

describe("template schema publishing rules", () => {
  const base = {
    id: "draftsalon",
    industry: "salons",
    design: "Unnamed",
    business: "Example Salon",
    position: "p",
    description: "d",
    palette: ["#000000"],
    fictional: true,
  };

  it("accepts a draft with no URL, date or screenshots", () => {
    assert.equal(websiteTemplateSchema.safeParse({ ...base, status: "draft" }).success, true);
  });

  it("refuses to publish without a URL, verification date and both screenshots", () => {
    const r = websiteTemplateSchema.safeParse({ ...base, status: "published" });
    assert.equal(r.success, false);
    assert.deepEqual(r.error?.issues.map((i) => i.path[0]).sort(), ["desktop", "mobile", "url", "verifiedOn"]);
  });

  it("refuses non-https demo links and non-fictional entries", () => {
    const [aurelle] = publishedTemplates("salons");
    assert.equal(websiteTemplateSchema.safeParse({ ...aurelle, url: "http://example.com/" }).success, false);
    assert.equal(websiteTemplateSchema.safeParse({ ...aurelle, fictional: false }).success, false);
  });
});
