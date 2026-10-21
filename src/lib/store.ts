import { mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import { buildDemo } from "./seed";
import type { Project, StoreData } from "./types";

const filePath = path.join(process.cwd(), "data", "store.json");

function emptyStore(): StoreData {
  return { projects: [buildDemo()] };
}

export function readStore(): StoreData {
  try {
    const text = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(text) as StoreData;
    if (!parsed || !Array.isArray(parsed.projects)) return emptyStore();
    return parsed;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      const fresh = emptyStore();
      writeStore(fresh);
      return fresh;
    }
    throw error;
  }
}

export function writeStore(store: StoreData) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2));
  renameSync(tmp, filePath);
}

export function findProject(store: StoreData, id: string): Project | undefined {
  return store.projects.find((project) => project.id === id);
}

export function saveProject(project: Project) {
  const store = readStore();
  const index = store.projects.findIndex((item) => item.id === project.id);
  if (index < 0) store.projects.unshift(project);
  else store.projects[index] = project;
  writeStore(store);
}
