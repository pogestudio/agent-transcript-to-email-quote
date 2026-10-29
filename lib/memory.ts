import { newId, readJson, writeJson } from "./store";
import type { Memory } from "./types";

const FILE = "memory.json";
export const MEMORY_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

// Prices and discounts are rules in code. "kronor" and "krona" slip past \bkr\b, so they are named too.
const MONEY = /\d+\s*%|\bsek\b|\bkr(ona|onor)?\b|price|pris|discount|rabatt/i;
export const MONEY_NOTE_ERROR = "Prices and discounts are rules, not memories";

type MemoryStore = Record<string, Memory[]>;

// One key per customer, whatever the case or the spaces around the name.
export const customerKey = (customer: string) => customer.trim().toLowerCase();

const load = () => readJson<MemoryStore>(FILE) ?? {};

export function addMemory(customer: string, note: string, sourceRunId: string): Memory {
  const key = customerKey(customer), text = note.trim();
  if (!key) throw new Error("A memory needs a customer name");
  if (!text) throw new Error("A memory needs a note");
  if (MONEY.test(text)) throw new Error(MONEY_NOTE_ERROR);
  const now = Date.now();
  const memory: Memory = {
    id: newId("m"), note: text, createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + MEMORY_DAYS * DAY_MS).toISOString(), sourceRunId,
  };
  const store = load();
  store[key] = [...(store[key] ?? []), memory];
  writeJson(FILE, store);
  return memory;
}

// The customer's notes that haven't expired, oldest first.
export function memoriesFor(customer: string | null): Memory[] {
  if (!customer?.trim()) return [];
  const now = new Date().toISOString();
  return (load()[customerKey(customer)] ?? []).filter((m) => m.expiresAt > now);
}

// Forgets one note. False when the customer has no note with that id.
export function deleteMemory(customer: string, id: string): boolean {
  const store = load(), key = customerKey(customer);
  const notes = store[key] ?? [];
  const kept = notes.filter((m) => m.id !== id);
  if (kept.length === notes.length) return false;
  if (kept.length) store[key] = kept;
  else delete store[key];
  writeJson(FILE, store);
  return true;
}
