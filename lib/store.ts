import fs from "node:fs";
import path from "node:path";
import type { Run } from "./types";

// Read on every call, so tests can point KVARN_DATA_DIR at a temp folder.
export const dataDir = () => process.env.KVARN_DATA_DIR ?? path.join(process.cwd(), "data");

const resolve = (rel: string) => path.join(dataDir(), rel);

const ensureDirFor = (file: string) => fs.mkdirSync(path.dirname(file), { recursive: true });

// r_ + UTC time + random, e.g. r_20261029_075231_k3f9
export function newId(): string {
  const time = new Date().toISOString().replace(/\D/g, "");
  return `r_${time.slice(0, 8)}_${time.slice(8, 14)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function readJson<T>(rel: string): T | null {
  const file = resolve(rel);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
}

export function writeJson(rel: string, value: unknown): void {
  const file = resolve(rel);
  ensureDirFor(file);
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

export function appendJsonl(rel: string, value: unknown): void {
  const file = resolve(rel);
  ensureDirFor(file);
  fs.appendFileSync(file, JSON.stringify(value) + "\n");
}

export function listJson<T>(dir: string): T[] {
  const full = resolve(dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(fs.readFileSync(path.join(full, name), "utf8")) as T);
}

export function readJsonl<T>(rel: string): T[] {
  const file = resolve(rel);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);
}

// Newest first; all sources when none is given.
export function listRuns(source?: Run["source"]): Run[] {
  return listJson<Run>("runs")
    .filter((r) => !source || r.source === source)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const TRANSCRIPT_NAME = /^[\w.-]+\.txt$/;

export function readTranscript(name: string): string | null {
  const file = resolve(`transcripts/${name}`);
  return TRANSCRIPT_NAME.test(name) && fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

export function listTranscripts(): { name: string; text: string }[] {
  const dir = resolve("transcripts");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".txt"))
    .sort()
    .map((name) => ({ name, text: fs.readFileSync(path.join(dir, name), "utf8") }));
}
