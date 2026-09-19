import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createElement } from "react";
import { renderToString } from "react-dom/server";

import CommandCenterPage from "../../app/(app)/command-center/page";
import { commandCenterApps } from "./apps";

const SUITE = ["Prospra", "Architecta", "Directorium", "Synceri"];
const COMING_SOON = ["architecta", "directorium", "synceri"];

function renderArticles() {
  const html = renderToString(createElement(CommandCenterPage));
  const articles = html.match(/<article[\s\S]*?<\/article>/g) ?? [];
  return { html, articles };
}

describe("command center product registry", () => {
  it("lists exactly the four operating-suite products", () => {
    assert.deepEqual(
      commandCenterApps.map((app) => app.name),
      SUITE,
    );
  });

  it("marks only Prospra as available", () => {
    const status = Object.fromEntries(
      commandCenterApps.map((app) => [app.id, app.status]),
    );

    assert.equal(status.prospra, "available");
    for (const id of COMING_SOON) {
      assert.equal(status[id], "coming-soon", id);
    }
  });
});

describe("command center render", () => {
  it("renders four product cards and no Digital Vault or Agentverse", () => {
    const { html, articles } = renderArticles();

    assert.equal(articles.length, 4);
    SUITE.forEach((name, index) => {
      assert.match(articles[index] ?? "",new RegExp(`>${name}</h3>`));
    });
    assert.doesNotMatch(html, /Digital Vault|Agentverse/);
  });

  it("gives only Prospra a launch treatment", () => {
    const { articles } = renderArticles();
    const [prospra = "", ...comingSoon] = articles;

    assert.match(prospra,/>Available</);
    assert.match(prospra, /Launch App/);
    assert.match(prospra, /href="https:\/\/prospra\.entrepreneuria\.io"/);

    for (const card of comingSoon) {
      assert.match(card, />Coming Soon</);
      assert.doesNotMatch(card, />Available<|Launch App|href=/);
    }
  });

  it("does not show an active-count label or live activity for unreleased products", () => {
    const { html } = renderArticles();

    assert.doesNotMatch(html, /\d+(?:<!-- -->)?\s*of\s*(?:<!-- -->)?\s*\d+(?:<!-- -->)?\s*active/);
    assert.doesNotMatch(
      html,
      /completed a strategy report|queued for CRM sync|Generate Content|Analyze Website|Quick Automation/,
    );
  });
});
