# 설치·검사한 스킬 목록

검사 도구: NVIDIA SkillSpector v2.12.0 (`--no-llm`, 무료) + Claude 소스 직접 검토.
설치 위치: `~/.claude/skills/`

| 스킬 | 출처 | 검사 결과 | 상태 | 용도 |
|---|---|---|---|---|
| skill-inspector | NVIDIA/SkillSpector `skills/skill-inspector` @ c7958a3 | **APPROVE** — 0/100, 문제 0건 | 설치됨 (2026-09-25) | 다른 스킬을 설치 전에 검사 |
| frontend-design | anthropics/skills `skills/frontend-design` @ 3337550 | **APPROVE** — 13/100. HIGH 1건은 오탐("에러 문구는 사과하지 않는다"는 앱 문구 작성 요령) | 설치됨 (2026-09-25) | 화면 디자인 방향·글꼴·색 정하기 |
| webapp-testing | anthropics/skills `skills/webapp-testing` @ 3337550 | **CAUTION** — 64/100. 로컬 서버 실행용 `shell=True`, "소스 읽지 말라"는 지시, Playwright+Chromium 설치 필요 | **설치 안 함** (2026-09-25 사용자 결정 — node --test + 폰 직접 확인으로 대체) | 브라우저 자동 테스트 |
| reborn-ytlearn (yt-transcript · yt-frames · ytlearn-ko-guide) | npm `reborn-ytlearn@1.0.0` (개인 게시자, 2026-09-19 첫 공개, 공개 저장소 없음) | **CAUTION** — 12/100, 검사 범위 63.6%. 코드는 깨끗하나 출처 불분명 · 안내 스킬에 유료 스킬팩 광고 · `npx --yes` 는 매번 최신판을 바로 실행 | **설치 안 함** (2026-09-25 사용자 결정 — 공식 yt-dlp·ffmpeg 를 직접 쓰기로) | 유튜브 자막·장면 읽기 |

## 도구 (스킬 아님)

| 도구 | 설치 방법 | 이유 |
|---|---|---|
| yt-dlp 2026.08.19 · ffmpeg 9.0.2 | `brew install yt-dlp ffmpeg` | 레시피 유튜브 영상의 설명·화면 자막 읽기 |
| skillspector (CLI) | `uv tool install git+https://github.com/NVIDIA/SkillSpector.git@c7958a3…` | skill-inspector 가 실제 검사에 쓰는 프로그램. 이 Mac 에 2.11.2 가 이미 있었고 2.12.0 으로 올림 |
