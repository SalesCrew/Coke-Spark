import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { buildFragebogenUsage, sortFragebogenByUsage, unusedFragebogenUsage, loadingFragebogenUsage, unavailableFragebogenUsage, type QuestionnaireCampaignUsage } from "../src/lib/fragebogen-campaign-usage";
import { FragebogenUsageBadge, FragebogenUsageDetail } from "../src/components/admin/FragebogenCampaignUsage";

const campaign = (changes: Partial<QuestionnaireCampaignUsage> = {}): QuestionnaireCampaignUsage => ({ id:"campaign", name:"October Flex", section:"flex", currentFragebogenId:"Q4", status:"scheduled", scheduleType:"scheduled", startDate:"2026-10-08", endDate:"2026-10-10", ...changes });
const at = (date: string, rows = [campaign()], section: QuestionnaireCampaignUsage["section"] = "flex") => buildFragebogenUsage(rows, section, new Date(date));

test("Vienna start/end days are inclusive and long-lived badges expire, including DST boundaries", () => {
  assert.equal(at("2026-10-07T21:59:59Z").get("Q4")?.status,"scheduled");
  assert.equal(at("2026-10-07T22:00:00Z").get("Q4")?.status,"active");
  assert.equal(at("2026-10-10T21:59:59Z").get("Q4")?.status,"active");
  assert.equal(at("2026-10-10T22:00:00Z").get("Q4"),undefined);
  const dst = [campaign({startDate:"2026-10-25",endDate:"2026-10-25"})];
  assert.equal(at("2026-10-24T22:00:00Z",dst).get("Q4")?.status,"active");
  assert.equal(at("2026-10-25T22:59:59Z",dst).get("Q4")?.status,"active");
  assert.equal(at("2026-10-25T23:00:00Z",dst).get("Q4"),undefined);
});

test("template status and quarter names do not control use; paused, expired, malformed and other-section campaigns do not count", () => {
  const rows = [campaign(),campaign({id:"paused",status:"inactive"}),campaign({id:"expired",endDate:"2026-10-07"}),campaign({id:"invalid",endDate:"2026-02-30"}),campaign({id:"billa",section:"billa"}),campaign({id:"no-form",currentFragebogenId:null}),campaign({id:"not-started-unlimited",scheduleType:"always",status:"scheduled"})];
  const before = structuredClone(rows), usage = at("2026-10-08T10:00:00Z",rows).get("Q4")!;
  assert.equal(usage.label,"In Verwendung");
  assert.equal(usage.detail,"1 laufende Kampagne · 08.10.2026 – 10.10.2026");
  assert.deepEqual(rows,before);
  assert.equal(at("2026-10-08T10:00:00Z",rows,"standard").size,0);
  const html = renderToStaticMarkup(<FragebogenUsageBadge usage={usage} accent="#84CC16" background="green" />);
  assert.match(html,/In Verwendung/);
  assert.match(renderToStaticMarkup(<FragebogenUsageDetail usage={usage} />),/1 laufende Kampagne/);
});

test("one template can be used by several campaigns and sections; current use takes precedence over future use", () => {
  const rows = [campaign(),campaign(),campaign({id:"second",scheduleType:"always",status:"active"}),campaign({id:"future",startDate:"2026-11-01",endDate:"2026-11-30"}),campaign({id:"billa",section:"billa",currentFragebogenId:"Q3"})];
  const usage = at("2026-10-08T10:00:00Z",rows).get("Q4")!;
  assert.equal(usage.detail,"2 laufende Kampagnen");
  assert.match(usage.title,/01.11.2026/);
  assert.equal(at("2026-10-08T10:00:00Z",rows,"billa").get("Q3")?.status,"active");
  assert.equal(at("2026-10-08T10:00:00Z",[rows[3]]).get("Q4")?.startDate,"2026-11-01");
});

test("unused, loading and failed lookups have distinct honest labels and stable non-mutating ordering", () => {
  const lookup = at("2026-10-08T10:00:00Z",[campaign(),campaign({id:"future",currentFragebogenId:"future",startDate:"2026-11-01",endDate:"2026-11-30"})]);
  const forms = [{id:"Q3",status:"active"},{id:"future",status:"inactive"},{id:"Q4",status:"inactive"},{id:"unused",status:"active"}];
  assert.deepEqual(sortFragebogenByUsage(forms,id=>lookup.get(id)??unusedFragebogenUsage).map(x=>x.id),["Q4","future","Q3","unused"]);
  assert.deepEqual(forms.map(x=>x.id),["Q3","future","Q4","unused"]);
  for (const usage of [unusedFragebogenUsage,loadingFragebogenUsage,unavailableFragebogenUsage]) {
    const html = renderToStaticMarkup(<><FragebogenUsageBadge usage={usage} accent="green" background="green" /><FragebogenUsageDetail usage={usage} /></>);
    assert.ok(html.includes(usage.label));
    assert.doesNotMatch(html,/Immer aktiv/);
    if(usage.status!=="inactive") assert.doesNotMatch(html,/Nicht in Verwendung|Keine laufende Kampagne/);
  }
});
