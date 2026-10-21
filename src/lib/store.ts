import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "fs";
import path from "path";
import { buildDemo } from "./seed";
import type { Project, StoreData } from "./types";

const filePath = path.join(process.cwd(), "data", "store.json");

/**
 * 저장소 캐시.
 * 예전에는 화면 하나를 그릴 때마다 store.json 전체(답변 원문 포함)를 읽고 JSON.parse 했습니다.
 * 이제 파일 수정 시각이 같으면 파싱한 객체 하나를 재사용합니다.
 * - 캐시는 항상 '마지막 저장본' 하나만 들고 있으므로 요청이 많아져도 메모리가 늘지 않습니다.
 * - 바깥에서 파일을 고치면 mtime이 바뀌어 다음 요청에서 다시 읽습니다.
 * - 캐시한 객체는 고치지 마세요. 바꿀 때는 새 객체를 만들어 writeStore에 넘깁니다.
 */
let cache: { mtimeMs: number; size: number; data: StoreData } | null = null;

function emptyStore(): StoreData {
  return { projects: [buildDemo()] };
}

export function readStore(): StoreData {
  let stat;
  try {
    stat = statSync(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const fresh = emptyStore();
      writeStore(fresh);
      return fresh;
    }
    throw error;
  }
  if (cache && cache.mtimeMs === stat.mtimeMs && cache.size === stat.size) {
    return cache.data;
  }
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as StoreData;
  const data = parsed && Array.isArray(parsed.projects) ? parsed : emptyStore();
  cache = { mtimeMs: stat.mtimeMs, size: stat.size, data };
  return data;
}

export function writeStore(store: StoreData) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2));
  renameSync(tmp, filePath);
  const stat = statSync(filePath);
  cache = { mtimeMs: stat.mtimeMs, size: stat.size, data: store };
}

export function findProject(store: StoreData, id: string): Project | undefined {
  return store.projects.find((project) => project.id === id);
}

/** 프로젝트 하나를 바꿔 저장합니다. 다른 프로젝트 객체는 그대로 두어 화면 캐시가 유지됩니다. */
export function saveProject(project: Project) {
  const store = readStore();
  const index = store.projects.findIndex((item) => item.id === project.id);
  const projects =
    index < 0
      ? [project, ...store.projects]
      : store.projects.map((item, position) => (position === index ? project : item));
  writeStore({ ...store, projects });
}

export function removeProject(id: string): boolean {
  const store = readStore();
  const projects = store.projects.filter((project) => project.id !== id);
  if (projects.length === store.projects.length) return false;
  writeStore({ ...store, projects });
  return true;
}
