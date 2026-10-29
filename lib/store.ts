import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = process.env.KVARN_DATA_DIR ?? path.join(process.cwd(), "data");

const resolve = (rel: string) => path.join(DATA_DIR, rel);

export function readJson<T>(rel: string): T | null {
  const file = resolve(rel);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
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

export function listTranscripts(): { name: string; text: string }[] {
  const dir = resolve("transcripts");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".txt"))
    .sort()
    .map((name) => ({ name, text: fs.readFileSync(path.join(dir, name), "utf8") }));
}
