---
name: start
description: 새 작업 세션 시작 - 현재 프로젝트 컨텍스트 자동 로드 (모든 프로젝트 공용)
user-invocable: true
---

# 작업 세션 시작 (공용)

이 스킬은 `C:\WORK\` 하위 **모든 프로젝트가 공유**하는 범용 세션 시작 스킬입니다.
프로젝트 루트·문서·서버 상태를 자동 감지하므로 하드코딩된 경로가 없습니다.

## 1단계: 프로젝트 루트 자동 감지

```bash
git rev-parse --show-toplevel 2>/dev/null || pwd
```

→ 이 경로를 `$PROJECT_ROOT` 로 간주합니다. 아래 모든 단계는 이 경로 기준.

## 2단계: 오늘 커밋 이력 확인

```bash
cd "$PROJECT_ROOT" && git log --since="midnight" --format="%h %ai %s" --reverse 2>/dev/null || echo "(git log 없음)"
```

→ 오늘 세션에서 수행된 커밋을 시간순으로 확인합니다.

## 3단계: 최근 작업일지 확인

`$PROJECT_ROOT/docs/work-log.md` 파일을 찾습니다.

- **있으면** 읽어서 마지막 날짜 섹션을 파악합니다.
- **없으면** 이 단계를 건너뜁니다 (`/end` 스킬이 처음 실행될 때 자동 생성됨).

## 4단계: 프로젝트 상태 훑기

아래 파일들을 발견되는 대로 확인합니다 (없으면 건너뜀):

| 파일 | 용도 |
|------|------|
| `docs/dev-plan.md` | 현재 마일스톤·진행률 확인 |
| `docs/bugfix-log.md` | 최근 수정된 버그 파악 |
| `docs/upgrade-log.md` | 최근 추가된 기능 파악 |
| `CLAUDE.md` | 프로젝트 규칙·관례 재확인 |
| `README.md` | 프로젝트 개요 (CLAUDE.md 없을 때 대체) |

## 5단계: Orbitron 서버 상태 확인 (opt-in)

**`$PROJECT_ROOT/docs/orbitron-server.md` 파일이 존재할 때만** 수행합니다.
(해당 프로젝트가 Orbitron 배포 서버를 사용한다는 신호)

```bash
ssh stevenlim@192.168.219.101 "echo '=== GPU ===' && nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader && echo '=== CONTAINERS ===' && docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | head -20 && echo '=== DISK ===' && df -h / | tail -1 && echo '=== RAM ===' && free -h | head -2"
```

→ GPU·컨테이너·디스크·메모리 현황 확인.
→ 디스크 사용량 86% 이상이면 경고.
→ `docs/orbitron-server.md` 의 기재 내용과 다르면 차이점을 메모했다가 `/end` 단계에서 반영합니다.

## 6단계: twinverse-ai 서버 상태 확인 (opt-in)

**`$PROJECT_ROOT/docs/twinverse-ai-server.md` 또는 `ai-shared-registry.md` 참조가
CLAUDE.md 에 있을 때만** 수행합니다.

```bash
ssh stevenlim@192.168.219.117 "nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader && docker ps --format '{{.Names}}' | head -10"
```

→ 접속 실패해도 경고만 출력하고 세션은 계속 진행 (하드웨어 전압 이슈로 불안정할 수 있음).

## 7단계: 사용자에게 보고

아래 형식으로 간단 보고 후 사용자의 작업 요청을 수행합니다.

```
## 세션 시작 준비 완료

**프로젝트**: {PROJECT_ROOT 경로의 마지막 디렉토리명}
**브랜치**: {현재 git 브랜치}
**오늘 커밋**: {N건} (없으면 "없음")

**최근 작업** (work-log.md 마지막 섹션):
- {1-2 줄 요약}

**서버 상태** (해당하는 경우만):
- Orbitron: GPU VRAM 사용량, 컨테이너 N개, 디스크 N%
- twinverse-ai: (접속 성공/실패)

준비 완료. 무엇을 도와드릴까요?
```

---

## 핵심 규칙

1. **자동 탐지 우선**: 프로젝트 경로를 하드코딩하지 않고 `git rev-parse` 로 감지
2. **Opt-in 서버 체크**: Orbitron/twinverse-ai 체크는 해당 문서/마커가 있을 때만 실행
3. **파일 없으면 건너뛰기**: 어떤 파일도 존재 여부를 먼저 확인하고, 없으면 해당 단계를 조용히 건너뜀
4. **최소 소음**: 보고는 3-5 줄로 짧게. 긴 출력은 사용자가 요청할 때만
