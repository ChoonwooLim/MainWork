# C:\WORK\.agent — 크로스-프로젝트 공용 리소스

이 디렉토리는 `C:\WORK\` 하위 **모든 프로젝트가 공유**하는 Claude Code 리소스를
버전 관리(MainWork repo)하는 곳입니다.

- **위치**: `C:\WORK\.agent\`
- **저장소**: `https://github.com/ChoonwooLim/MainWork.git`
- **런타임 위치**: `C:\Users\choon\.claude\` (Claude Code 가 실제로 읽는 곳)

---

## 구조

```
.agent/
├── README.md                   # 이 파일
├── workflows/                  # 공용 워크플로우 md (프로젝트 무관)
│   ├── finish-work.md
│   └── ssh-server.md
├── skills/                     # 범용 스킬 24 개 (Impeccable 디자인 시스템 등)
│   ├── adapt/ animate/ arrange/ audit/ bolder/ clarify/ code-review/
│   ├── colorize/ critique/ delight/ distill/ extract/ frontend-design/
│   ├── harden/ init/ normalize/ onboard/ optimize/ overdrive/ polish/
│   └── quieter/ teach-impeccable/ typeset/ ultraplan/
└── plugins-manifest.json       # 사용자 레벨 플러그인 스냅샷
```

---

## 스킬 (Skills)

### 왜 `.agent/skills/` 와 `~/.claude/skills/` 두 곳에 있나?

- **`.agent/skills/`** = **정본(source of truth)**. MainWork repo 로 버전 관리.
  변경/추가 시 여기를 고친다.
- **`~/.claude/skills/`** = **런타임 미러**. Claude Code 가 실제로 읽는 곳.
  `.agent/skills/` 에서 복사해 넣는다.

### 초기 설치 (새 기기 세팅 시)

```bash
mkdir -p ~/.claude/skills
cp -r C:/WORK/.agent/skills/* ~/.claude/skills/
```

### 변경 후 재동기화

```bash
# .agent/skills/ 를 고친 후:
cp -r C:/WORK/.agent/skills/* ~/.claude/skills/

# 반대로, ~/.claude/skills/ 를 직접 고쳤다면 정본에 반영:
cp -r ~/.claude/skills/{adapt,animate,...,ultraplan} C:/WORK/.agent/skills/
cd C:/WORK && git add .agent/skills && git commit -m "chore: skill update" && git push
```

### 프로젝트 전용 스킬

다음 3 개는 **TwinverseAI 전용**이라 이 공용 디렉토리에 넣지 않음
(하드코딩된 `c:\WORK\TwinverseAI` 경로 포함):

- `start`  — TwinverseAI 세션 시작 (git log, orbitron server 체크 등)
- `end`    — TwinverseAI docs 자동 업데이트
- `project-start` — TwinverseAI start/end 파이프라인

다른 프로젝트에서 비슷한 스킬이 필요하면 각 프로젝트 `.claude/skills/` 에
프로젝트-고유 버전으로 만든다 (하드코딩 경로는 그 프로젝트 것으로).

---

## 플러그인 (Plugins)

Claude Code 플러그인은 `~/.claude/plugins/installed_plugins.json` 에서
`scope` 필드로 관리된다:

- `scope: "user"` → 모든 프로젝트에서 공유 ✅
- `scope: "project"` 또는 `scope: "local"` → 특정 프로젝트에만 활성화

### 2026-04-12 기준 user scope 플러그인 (8 개)

| 이름 | 용도 |
|------|------|
| `frontend-design` | 프론트엔드 디자인 원칙 · /audit /polish /critique 등 |
| `superpowers` | brainstorming · debugging · TDD · 메타 스킬 프레임워크 (v5.0.7) |
| `github` | GitHub 이슈 · PR · 릴리스 관리 |
| `figma` | Figma 디자인 파일 연동 |
| `context7` | 최신 라이브러리 문서 조회 |
| `feature-dev` | 기능 개발 워크플로우 에이전트 |
| `telegram` | Telegram 알림 발송 |
| `supabase` | Supabase DB · Auth · Storage 연동 |

위 플러그인은 TwinverseAI / SodamFN / Artifex.AI 등 어느 프로젝트에서
Claude Code 를 띄워도 그대로 사용 가능.

### project scope 로 남긴 플러그인

- `code-review` — 현재 SodamFN 에만 설치됨. 다른 프로젝트에서 필요하면
  해당 프로젝트 디렉토리에서 `/plugin install` 로 별도 설치하거나 user scope 로 승격 요청.

### 새 플러그인 추가 절차

1. Claude Code 에서 `/plugin install <이름>` 실행 (기본적으로 local scope 로 설치됨)
2. 다른 프로젝트에서도 쓰려면 `installed_plugins.json` 에서
   해당 플러그인의 `scope` 를 `"user"` 로 바꾸고 `projectPath` 를 삭제
3. `C:\WORK\.agent\plugins-manifest.json` 에 한 줄 추가
4. `git add .agent/plugins-manifest.json && git commit && git push`

---

## 참고

- AI 리소스(서버 주소 · 포트 · 모델 · API 키) 는 `C:\WORK\infra-docs\ai-shared-registry.md` 참조 (별개 SSOT)
- 프로젝트별 CLAUDE.md 에 위 레지스트리 포인터가 박혀있음
- 이 `.agent/` 디렉토리는 AI 리소스 레지스트리와 분리된 **Claude Code 툴링 전용** SSOT
