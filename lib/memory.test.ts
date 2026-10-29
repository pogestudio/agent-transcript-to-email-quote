import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addMemory, deleteMemory, MEMORY_DAYS, memoriesFor, MONEY_NOTE_ERROR } from "./memory";

const DAY_MS = 24 * 60 * 60 * 1000;
const TUESDAY = "Always wants delivery on Tuesdays";

describe("memory", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "kvarn-memory-"));
    vi.stubEnv("KVARN_DATA_DIR", dir);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("adds a note and reads it back", () => {
    const memory = addMemory("Café Linnea", TUESDAY, "r_1");
    expect(memory).toMatchObject({ note: TUESDAY, sourceRunId: "r_1" });
    expect(Date.parse(memory.expiresAt) - Date.parse(memory.createdAt)).toBe(MEMORY_DAYS * DAY_MS);
    expect(memoriesFor("Café Linnea")).toEqual([memory]);
  });

  it.each([
    "Always gets 15% off",
    "Quote them in SEK",
    "Gets 100 kr off",
    "Pays 200 kronor less per bag",
    "Special price for loyal customers",
    "Samma pris som förra gången",
    "Discount approved last time",
    "Ge dem rabatt",
  ])("refuses a note about money: %s", (note) => {
    expect(() => addMemory("Café Linnea", note, "r_1")).toThrow(MONEY_NOTE_ERROR);
    expect(memoriesFor("Café Linnea")).toEqual([]);
  });

  it("leaves out an expired note", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    addMemory("Café Linnea", TUESDAY, "r_1");
    vi.setSystemTime(new Date(Date.now() + (MEMORY_DAYS - 1) * DAY_MS));
    expect(memoriesFor("Café Linnea")).toHaveLength(1);
    vi.setSystemTime(new Date(Date.now() + 2 * DAY_MS));
    expect(memoriesFor("Café Linnea")).toEqual([]);
  });

  it("forgets one note and keeps the others", () => {
    const tuesday = addMemory("Café Linnea", TUESDAY, "r_1");
    const door = addMemory("Café Linnea", "Deliver to the back door", "r_2");
    expect(deleteMemory("Café Linnea", tuesday.id)).toBe(true);
    expect(memoriesFor("Café Linnea")).toEqual([door]);
    expect(deleteMemory("Café Linnea", tuesday.id)).toBe(false);
  });

  it("keys the customer ignoring case and the spaces around the name", () => {
    const memory = addMemory("  Café Linnea ", TUESDAY, "r_1");
    expect(memoriesFor("CAFÉ LINNEA")).toEqual([memory]);
    expect(memoriesFor("Kafé Solsidan")).toEqual([]);
    expect(memoriesFor(null)).toEqual([]);
    expect(deleteMemory("café linnea", memory.id)).toBe(true);
  });
});
