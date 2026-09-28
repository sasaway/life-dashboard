// 앱 시작. x.9 버전으로 처음 켜질 때는 다른 코드가 기록을 건드리기(옛 형식 옮기기 등) 전에 백업부터 한다 (v1.9).
// 백업이 실패하거나 오래 걸려도(15초) 앱은 그대로 켜진다 — 실패는 설정 › 데이터 백업에 보인다.
import { autoBackup } from "./backup-db.js";

await Promise.race([
  autoBackup().catch(() => {}),
  new Promise((resolve) => setTimeout(resolve, 15000)),
]);
await import("./app.js");
