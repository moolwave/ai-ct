import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

// store.ts와 error-log.ts는 불러올 때 process.cwd()로 경로를 정하므로, 임시 폴더로 옮긴 뒤 불러옵니다.
const dir = mkdtempSync(path.join(tmpdir(), "aict-"));
process.chdir(dir);

test("에러 로그: 파일에 한 줄씩 남고, 사용자 오류는 스택 없이 warn으로 남는다", async () => {
  const { logError, readErrorLog } = await import("./error-log");
  const { UserError } = await import("./errors");
  const silence = console.error;
  console.error = () => {};
  const unexpected = logError("test", new TypeError("boom"), { projectId: "p1" });
  console.error = silence;
  const expected = logError("test", new UserError("입력 확인"), { projectId: "p1" });
  const entries = readErrorLog();
  assert.equal(entries[0].id, expected);
  assert.equal(entries[0].level, "warn");
  assert.equal(entries[0].stack, undefined);
  assert.equal(entries[1].id, unexpected);
  assert.equal(entries[1].level, "error");
  assert.ok(entries[1].stack?.includes("TypeError: boom"));
  assert.equal(entries[1].context?.projectId, "p1");
});

test("에러 로그: 1MB를 넘으면 회전해 파일이 끝없이 커지지 않는다", async () => {
  const { logError } = await import("./error-log");
  const file = path.join(dir, "data", "logs", "errors.log");
  writeFileSync(file, "x".repeat(1_100_000));
  const { UserError } = await import("./errors");
  logError("test", new UserError("after rotate"));
  assert.ok(statSync(file).size < 10_000);
  assert.ok(statSync(path.join(dir, "data", "logs", "errors.1.log")).size > 1_000_000);
});

test("저장소: 파일이 그대로면 같은 객체를 재사용하고, 바뀌면 다시 읽는다", async () => {
  const { readStore, saveProject, findProject } = await import("./store");
  const first = readStore();
  assert.equal(readStore(), first, "같은 mtime이면 다시 파싱하지 않는다");

  const project = first.projects[0];
  saveProject({ ...project, name: "바꾼 이름" });
  const second = readStore();
  assert.notEqual(second, first);
  assert.equal(findProject(second, project.id)?.name, "바꾼 이름");
  assert.equal(first.projects[0].name, project.name, "캐시해 둔 옛 객체를 고치지 않는다");

  // 바깥에서 파일을 고친 경우
  const file = path.join(dir, "data", "store.json");
  const edited = JSON.parse(readFileSync(file, "utf8"));
  edited.projects[0].name = "밖에서 고침";
  writeFileSync(file, JSON.stringify(edited));
  const later = new Date(Date.now() + 5000);
  utimesSync(file, later, later);
  assert.equal(readStore().projects[0].name, "밖에서 고침");
});
