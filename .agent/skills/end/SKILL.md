---
name: end
description: 작업 세션 종료 - 프로젝트 문서 자동 업데이트/생성, 커밋, 요약 보고 (모든 프로젝트 공용)
user-invocable: true
---

# 작업 세션 종료 (공용)

이 스킬은 `C:\WORK\` 하위 **모든 프로젝트가 공유**하는 범용 세션 종료 스킬입니다.
프로젝트 루트·문서 존재 여부를 자동 감지하고, **없는 문서는 템플릿으로 자동 생성**합니다.
**프로젝트 문서 자동 업데이트가 핵심입니다.**

## 0단계: 프로젝트 루트 감지

```bash
git rev-parse --show-toplevel 2>/dev/null || pwd
```

→ 이 경로를 `$PROJECT_ROOT` 로 간주합니다. 이하 모든 단계 이 기준.

## 1단계: 세션 작업 내역 수집

```bash
cd "$PROJECT_ROOT" && git status --short
cd "$PROJECT_ROOT" && git log --since="midnight" --format="%h %ai %s" --reverse
```

커밋 메시지 prefix 로 카테고리를 분류합니다:

| Prefix | 대상 문서 |
|--------|----------|
| `feat:` | `upgrade-log.md` |
| `fix:` | `bugfix-log.md` |
| `style:` / `refactor:` / `docs:` / `infra:` / `chore:` | `work-log.md` 에만 기록 |

마일스톤 상태 변화가 있으면 `dev-plan.md` 에도 반영.

## 2단계: docs/ 디렉토리 & 4개 기본 문서 자동 생성

`$PROJECT_ROOT/docs/` 가 없으면 생성:

```bash
mkdir -p "$PROJECT_ROOT/docs"
```

아래 4개 문서가 없으면 Write 도구로 **템플릿을 생성**합니다.
(존재하면 건드리지 않고, 기존 내용 아래에 append 만 수행)

### 2-0. docs/work-log.md (없으면 생성)

```markdown
# 작업일지

이 프로젝트의 모든 세션별 작업 내역을 날짜순으로 기록합니다.
`/end` 스킬이 세션 종료 시 자동으로 append 합니다.

---
```

### 2-0. docs/bugfix-log.md (없으면 생성)

```markdown
# 버그 수정 로그

| 날짜 | 버그 | 원인 | 수정 내용 | 관련 파일 |
|------|------|------|-----------|-----------|
```

### 2-0. docs/upgrade-log.md (없으면 생성)

```markdown
# 업그레이드 로그

| 날짜 | 변경 내용 | 카테고리 | 관련 파일 |
|------|----------|---------|----------|
```

### 2-0. docs/dev-plan.md (없으면 생성)

```markdown
# 개발계획서

프로젝트 비전, 마일스톤, 기능 목록을 기록합니다.

## 마일스톤

| # | 이름 | 상태 | 목표일 |
|---|------|------|--------|

## 기능 목록

| 기능 | 상태 | 담당 | 메모 |
|------|------|------|------|
```

## 3단계: docs/ 문서 append 업데이트

**기존 내용 절대 삭제 금지. 아래에 추가만.**

### 3-1. docs/work-log.md — 매번 반드시 업데이트

파일 끝에 오늘 날짜 섹션 추가 (같은 날짜가 이미 있으면 그 아래 이어서):

```markdown
## YYYY-MM-DD

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | (설명) | 완료 |
| fix  | (설명) | 완료 |

### 세부 내용

- (커밋 또는 작업 단위별 설명)

---
```

### 3-2. docs/bugfix-log.md — fix 커밋이 있을 때만

기존 테이블 맨 아래에 행 추가:

```markdown
| YYYY-MM-DD | (버그 설명) | (원인) | (수정 내용) | (관련 파일) |
```

### 3-3. docs/upgrade-log.md — feat 커밋이 있을 때만

기존 테이블 맨 아래에 행 추가:

```markdown
| YYYY-MM-DD | (변경 내용) | (카테고리) | (관련 파일) |
```

### 3-4. docs/dev-plan.md — 마일스톤 상태 변화가 있을 때만

마일스톤·기능 테이블의 상태 컬럼만 업데이트. 새 기능은 행 추가.

### 3-5. docs/orbitron-server.md — 파일이 존재하고 변화가 있을 때만

이 문서가 있으면 Orbitron 배포 서버를 사용하는 프로젝트입니다.

```bash
ssh stevenlim@192.168.219.101 "nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv,noheader && echo '---' && docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' && echo '---' && df -h / | tail -1"
```

변경 항목 (새 컨테이너, GPU/CUDA 버전, 디스크, 설치 소프트웨어 등) 이 있으면 문서 갱신.
없으면 파일 생성하지 않음 (해당 프로젝트는 Orbitron 미사용).

### 업데이트 규칙

1. **기존 내용 보존**: 이전 내용 절대 삭제/수정 금지 (dev-plan.md 상태 컬럼 제외)
2. **중복 방지**: 같은 날짜에 동일 내용 있으면 추가 안 함
3. **커밋 기반 분석**: `git log` 의 prefix 로 카테고리 판단
4. **미커밋 변경 포함**: `git status` 의 미커밋 변경도 분석해 포함
5. **Opt-in 문서**: orbitron-server.md 처럼 특정 인프라 의존 문서는 이미 존재할 때만 갱신

## 4단계: Frontend 스킬/플러그인 동기화 (opt-in)

**`$PROJECT_ROOT/frontend/src/data/skills.json` 파일이 존재할 때만** 실행.
(해당 프로젝트가 프론트엔드에서 스킬·플러그인 목록을 보여주는 경우)

### 4-1. skills.json 동기화

1. `.claude/skills/` + `~/.claude/skills/` 디렉토리의 SKILL.md 를 모두 스캔
2. 각 frontmatter(name, description) 파싱
3. `frontend/src/data/skills.json` 읽기
4. 기존 JSON 에 없는 새 스킬은 "자동 발견" 카테고리에 추가:
   - `command`: `/{name}`
   - `desc`: frontmatter description
   - `features`: ["자동 감지된 스킬입니다. 상세 기능은 추후 업데이트됩니다."]
5. **삭제된 스킬은 JSON 에서 제거하지 않음** (수동 작성 내용 보존)

### 4-2. plugins.json 동기화

**`frontend/src/data/plugins.json` 이 존재할 때만.**

1. `~/.claude/plugins/installed_plugins.json` 의 user scope 플러그인 + 프로젝트
   `.claude/settings*.json` 의 `mcpServers` 를 읽기
2. `plugins.json` 에 없는 새 항목은 기본 템플릿으로 추가
3. 기존 수동 작성 내용은 보존

### 동기화 규칙

1. **없으면 건너뛰기**: `frontend/src/data/` 디렉토리나 JSON 파일이 없으면 이 단계 자체를 건너뜀
2. **추가만 수행**: 수동 작성된 상세 내용 덮어쓰기 금지
3. **변경 없으면 저장 안 함**

## 5단계: Git 커밋 & 푸시

미커밋 변경사항(코드 + 문서)이 있으면 스테이징 → 커밋 → 푸시.

### 5-1. 스테이징

```bash
cd "$PROJECT_ROOT" && git add -A
```

(프로덕션 시크릿 `.env` / `credentials.json` 등은 `.gitignore` 가 차단한다고 가정)

### 5-2. 커밋 메시지 규칙

- `feat:` 새 기능
- `fix:` 버그 수정
- `style:` UI / 디자인
- `refactor:` 리팩토링
- `docs:` 문서
- `infra:` 인프라·배포
- `chore:` 기타 잡일

코드 변경과 문서 업데이트는 가능하면 **하나의 커밋**으로 묶습니다.
문서만 업데이트된 경우: `docs: 프로젝트 문서 자동 업데이트 (작업일지/버그로그 등)`

### 5-3. 푸시

```bash
cd "$PROJECT_ROOT" && git push
```

→ 현재 브랜치 기준 push. upstream 이 없으면 `git push -u origin $(git branch --show-current)`.

## 6단계: 세션 종료 보고

아래 형식으로 요약:

```
## 세션 종료 보고

**프로젝트**: {디렉토리명}
**브랜치**: {branch}

### 오늘 작업 요약
| 카테고리 | 작업 내용 | 상태 |
|---|---|---|
| feat | ... | 완료 |
| fix  | ... | 완료 |

### 문서 업데이트
- work-log.md: 업데이트 완료
- bugfix-log.md: (업데이트 / 변경 없음 / 신규 생성)
- upgrade-log.md: (업데이트 / 변경 없음 / 신규 생성)
- dev-plan.md: (업데이트 / 변경 없음 / 신규 생성)
- orbitron-server.md: (업데이트 / 변경 없음 / 해당 없음)

### 서버 상태 (해당하는 경우만)
- Orbitron: GPU 사용량, 컨테이너 N개, 디스크 N%

### Git 상태
- 커밋: N건
- 푸시: 완료 / 실패 / 대기

### 다음 세션 참고
- (미완료 작업·주의점·다음 할 일)
```

---

## 핵심 규칙

1. **자동 탐지**: 프로젝트 루트·문서 존재 여부를 모두 런타임에 감지
2. **없는 문서 자동 생성**: `docs/work-log.md` 등 4개 기본 문서는 없으면 템플릿으로 생성
3. **Opt-in 인프라 체크**: `docs/orbitron-server.md`, `frontend/src/data/skills.json` 등 마커 파일이 있을 때만 해당 단계 실행
4. **기존 내용 절대 보존**: append 만 수행, 삭제/수정 금지 (dev-plan 상태 컬럼 예외)
5. **안전한 커밋**: `.env` / secrets 는 `.gitignore` 가 막는다고 가정, 새 프로젝트라면 먼저 `.gitignore` 확인
