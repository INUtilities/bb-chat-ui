import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { activityLines, backgroundActivities, createBackgroundAccordions, pairActivities } from "./background-activity.ts";

test("background accordion lines show status and the current agent progress", () => {
  assert.deepEqual(activityLines({
    taskStatus: "running",
    workflow: { agents: [
      { label: "지난 조사", state: "done", resultPreview: "끝" },
      { phaseTitle: "조사", label: "코드 읽기", state: "running", lastToolName: "Read", lastToolSummary: "lib/a.ts" },
      { label: "다음", state: "queued", lastToolName: "Grep" },
    ] },
  }), ["실행 중", "조사 · 코드 읽기 · 실행 중 · Read — lib/a.ts", "다음 · 대기 · Grep"]);
});

test("a settled background task shows its latest result instead of every agent", () => {
  assert.deepEqual(activityLines({
    taskStatus: "failed",
    workflow: { agents: [
      { label: "준비", state: "done", resultPreview: "준비됨" },
      { label: "검토", state: "failed", error: "boom" },
    ] },
  }), ["실패", "검토 · 실패 — boom"]);
});

test("a command without agent progress uses the summary and error", () => {
  assert.deepEqual(activityLines({ taskStatus: "running", summary: "npm test", error: "실패" }), ["실행 중", "npm test", "실패"]);
  assert.deepEqual(activityLines({ taskStatus: "pending" }), ["대기", "진행 내용 없음"]);
});

test("timeline background commands keep their own ids when descriptions match", () => {
  const activities = backgroundActivities({ activeBackgroundCommands: [
    { id: "one", description: "npm test", taskStatus: "running", summary: "첫 번째" },
    { id: "two", description: "npm test", taskStatus: "running", summary: "두 번째" },
    { id: "", description: "빠짐", taskStatus: "running" },
  ] });
  assert.deepEqual(activities.map(activity => activity.id), ["one", "two"]);
  assert.deepEqual(pairActivities(["npm test", "build", "npm test"], activities).map(activity => activity?.lines[1]), ["첫 번째", undefined, "두 번째"]);
});

test("a disclosure title keeps its command out of the list pairing", () => {
  const dom = new JSDOM(`<section id="card"><div class="flex items-center"><button aria-expanded="true"><span><span title="npm test">npm test</span></span></button></div><section id="thread-background-commands-card-body"><div><div class="flex flex-col"><div class="px-3"><span title="npm test">npm test</span></div><div class="px-3"><span title="build">build</span></div></div></div></section></section>`);
  const accordions = createBackgroundAccordions(dom.window.document);
  const card = dom.window.document.querySelector<HTMLElement>("#card")!;
  accordions.sync(card, [
    { id: "one", description: "npm test", lines: ["실행 중", "제목"] },
    { id: "two", description: "npm test", lines: ["실행 중", "목록"] },
    { id: "three", description: "build", lines: ["실행 중", "빌드"] },
  ]);
  const rows = Array.from(card.querySelectorAll<HTMLElement>("#thread-background-commands-card-body div.px-3"));
  assert.equal(card.querySelector("button")!.getAttribute("data-bb-chat-ui-info-activity"), null);
  assert.equal(card.querySelector(".items-center")!.getAttribute("data-bb-chat-ui-info-activity"), null);
  rows[0].click();
  assert.equal(rows[0].nextElementSibling?.textContent, "실행 중목록");
  rows[1].click();
  assert.equal(rows[1].nextElementSibling?.textContent, "실행 중빌드");
  assert.equal(card.querySelectorAll("[data-bb-chat-ui-info-activity-panel]").length, 1);
  accordions.stop();
  dom.window.close();
});

test("a single static background row opens its accordion under the title", () => {
  const dom = new JSDOM(`<section id="card"><div class="flex items-center"><div class="px-3"><span><span title="npm test">npm test</span></span></div></div></section>`);
  const accordions = createBackgroundAccordions(dom.window.document);
  const card = dom.window.document.querySelector<HTMLElement>("#card")!;
  const row = card.querySelector<HTMLElement>("div.px-3")!;
  accordions.sync(card, [{ id: "one", description: "npm test", lines: ["실행 중", "하나만"] }]);
  row.click();
  assert.equal(row.getAttribute("aria-expanded"), "true");
  assert.equal(row.parentElement?.nextElementSibling?.textContent, "실행 중하나만");
  row.click();
  assert.equal(card.querySelector("[data-bb-chat-ui-info-activity-panel]"), null);
  accordions.stop();
  dom.window.close();
});
