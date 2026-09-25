import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import vm from "node:vm";

const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const versionJs = readFileSync(new URL("../js/version.js", import.meta.url), "utf8");

test("설정에 보이는 버전과 서비스 워커 버전이 같다", () => {
  const swVersion = sw.match(/const VERSION = "([^"]+)"/)[1];
  const shown = versionJs.match(/APP_VERSION = "([^"]+)"/)[1];
  assert.ok(shown.startsWith(`${swVersion} `), `sw ${swVersion} / 화면 ${shown}`);
});

test("오프라인 사본 목록의 파일이 모두 있고, js 파일이 빠짐없이 들어 있다", () => {
  const files = [...sw.matchAll(/^\s+"([^"]+)",?$/gm)].map((m) => m[1]).filter((f) => f !== "./");
  const root = new URL("../", import.meta.url);
  assert.deepEqual(files.filter((f) => !existsSync(new URL(f, root))), []);
  const js = readdirSync(new URL("../js/", import.meta.url)).map((f) => `js/${f}`);
  assert.deepEqual(js.filter((f) => !files.includes(f)), [], "js 폴더 파일이 사본 목록에 빠졌다");
});

test("서비스 워커 파일에 문법 오류가 없다 (오류가 있으면 폰이 새 버전을 영영 못 받는다)", () => {
  assert.doesNotThrow(() => new vm.Script(sw, { filename: "sw.js" }));
});
