import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCatalogue, type BoolderDataset } from "@/lib/integrations/outdoor/boolder";
import { catalogueSql } from "@/lib/integrations/outdoor/catalogue-sql";

const sample = JSON.parse(readFileSync("tests/fixtures/boolder-sample.json", "utf8")) as BoolderDataset;

describe("catalogueSql", () => {
  const catalogue = buildCatalogue(sample);
  const batches = catalogueSql(catalogue, { version: "abc123", date: "2026-10-01T00:00:00Z" }, { areas: 1, problems: 2 });

  it("writes parents before children and cleans up last", () => {
    const kinds = batches.map((b) => b.match(/^(?:insert into|delete from) public\.(\w+)/)?.[1]);
    const order = ["gyms", "outdoor_areas", "outdoor_circuits", "outdoor_problems"];
    const firstIndex = order.map((t) => kinds.indexOf(t));
    expect(firstIndex.every((i) => i >= 0)).toBe(true);
    expect([...firstIndex].sort((a, b) => a - b)).toEqual(firstIndex);
    expect(batches.at(-1)).toMatch(/^delete from public\.outdoor_problems/);
    expect(batches.at(-1)).toContain("insert into public.outdoor_data_imports");
  });

  it("splits large tables into batches", () => {
    const problemBatches = batches.filter((b) => b.startsWith("insert into public.outdoor_problems"));
    expect(problemBatches).toHaveLength(Math.ceil(catalogue.problems.length / 2));
  });

  it("joins areas to their gym through the external id and upserts in place", () => {
    const areas = batches.find((b) => b.startsWith("insert into public.outdoor_areas"))!;
    expect(areas).toContain("join public.gyms g on g.external_provider = 'BOOLDER' and g.external_id = r.id::text");
    expect(areas).toContain("on conflict (id) do update set gym_id = excluded.gym_id");
  });

  it("keeps data inside dollar quotes and escapes plain literals", () => {
    const withQuote = catalogueSql(catalogue, { version: "it's", date: null });
    expect(withQuote.at(-1)).toContain("'it''s'");
    const hostile = buildCatalogue({
      ...sample,
      problems: sample.problems.map((p, i) => (i === 0 ? { ...p, name: "x$boolder$; drop table gyms; --" } : p)),
    });
    expect(() => catalogueSql(hostile, { version: null, date: null })).toThrow(/quoting tag/);
  });
});
