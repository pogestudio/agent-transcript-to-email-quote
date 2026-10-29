import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appendJsonl, listRuns, newId, readJson, readJsonl, writeJson } from "./store";
import type { Run } from "./types";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kvarn-store-"));
  vi.stubEnv("KVARN_DATA_DIR", dir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

const run = (id: string, createdAt: string) =>
  ({ id, createdAt, source: "ui", transcript: "C: Twenty kilo.", customer: "Café Linnea" }) as Run;

describe("store", () => {
  it("writes a run into KVARN_DATA_DIR and reads it back", () => {
    const saved = run("r_1", "2026-10-29T08:00:00.000Z");
    writeJson("runs/r_1.json", saved);
    expect(fs.existsSync(path.join(dir, "runs", "r_1.json"))).toBe(true);
    expect(readJson<Run>("runs/r_1.json")).toEqual(saved);
  });

  it("returns null for a file that doesn't exist", () => {
    expect(readJson("runs/missing.json")).toBeNull();
  });

  it("round trips appendJsonl and readJsonl in order", () => {
    const events = [{ step: 1, kind: "llm" }, { step: 1, kind: "tool" }, { step: 1, kind: "end" }];
    for (const e of events) appendJsonl("traces/r_1.jsonl", e);
    expect(readJsonl("traces/r_1.jsonl")).toEqual(events);
  });

  it("lists runs newest first", () => {
    writeJson("runs/r_old.json", run("r_old", "2026-10-29T08:00:00.000Z"));
    writeJson("runs/r_new.json", run("r_new", "2026-10-29T09:00:00.000Z"));
    expect(listRuns("ui").map((r) => r.id)).toEqual(["r_new", "r_old"]);
  });

  it("makes ids that the run page accepts", () => {
    expect(newId()).toMatch(/^r_\d{8}_\d{6}_\w+$/);
    expect(newId()).not.toBe(newId());
  });
});
