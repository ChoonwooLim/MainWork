# AI Shared Registry (Single Source of Truth)

> **Steven Lim의 모든 프로젝트가 공동으로 사용하는 AI 리소스의 단일 진실 원천.**
>
> TwinverseAI · SodamFN · 이후 추가될 모든 프로젝트는 이 파일을 읽고 동일한 규칙을 따른다.
>
> **변경 순서는 반드시**: ① 이 파일 먼저 업데이트 → ② 각 프로젝트의 `.env`/`docs`/`Orbitron.yaml` 반영
> 한쪽만 업데이트하는 건 금지(drift 발생).

- **위치**: `C:\WORK\infra-docs\ai-shared-registry.md` (git repo: `C:\WORK\infra-docs`)
- **최초 작성**: 2026-04-12
- **마지막 업데이트**: 2026-04-15 (NPC 대화 권장 모델 `gemma3:12b` 추가 · TwinverseAI Office 멀티플레이어 피벗 반영)
- **관리자**: Steven Lim

---

## 1. 서버 인벤토리 (LAN: 192.168.219.0/24)

| 호스트명 | IP | OS | 역할 | 주요 자원 |
|---------|-----|-----|------|----------|
| **twinverse-ai** ⭐ | `192.168.219.117` | Ubuntu 24.04.4 | **전용 AI/GPU 컴퓨트** | Threadripper 3970X (64T) · 125GB RAM · RTX 3090 24GB · 913GB NVMe · Ollama · Docker + nvidia-container-toolkit |
| GPU PC (Windows) | `192.168.219.100` | Windows 11 | UE5 Pixel Streaming · 기존 Flux | GTX 1080 x2 · UE5 5.7.4 패키지 · TwinverseDesk PS2 |
| Orbitron | `192.168.219.101` | Ubuntu 24.04.4 | 배포 · DB · 미디어 | GTX 1080 x2 · 64GB RAM · Docker (15+ 컨테이너) · PostgreSQL |

### SSH 접속
| 호스트 | SSH 명령 | 사용자 | 키 |
|--------|---------|--------|-----|
| twinverse-ai | `ssh twinverse-ai` | `stevenlim` (NOPASSWD sudo) | `~/.ssh/popos_rsa` |
| Orbitron | `ssh stevenlim@192.168.219.101` | `stevenlim` | 등록됨 |
| GPU PC | (Windows 로컬) | — | — |

### 역할 분리 원칙
- **AI 컴퓨트는 전부 `twinverse-ai`에 집중** — 이것이 기본 전제.
- GPU PC(`.100`)는 **PS2/Pixel Streaming/UE5 전담**. 새 AI 서비스 배치 금지.
- Orbitron(`.101`)은 **웹 배포 + DB + 미디어 서빙 전담**. AI 모델 서빙 금지(GPU 약함).

---

## 2. 포트 예약표 (twinverse-ai)

> 새 서비스 띄울 때 이 표를 먼저 확인. 충돌 방지.

| 포트 | 서비스 | 상태 | 소유/공유 | 접근 범위 |
|------|--------|------|-----------|-----------|
| 22 | SSH | ✅ 운영 | 공용 | LAN + Tailscale/VPN |
| 11434 | **Ollama** (LLM) | ✅ 운영 | 공용 | `0.0.0.0` LAN 전체 |
| 8100 | **ai-image-service** (Flux.1 + Real-ESRGAN + rembg + LaMa) | ✅ 운영 (systemd) | 공용 | LAN |
| 8101 | TTS (Edge-TTS / XTTS v2) | 📝 예약 | 공용 | LAN |
| 8102 | Music (ACE-Step) | 📝 예약 | 공용 | LAN |
| 8200 | Whisper (STT) | 📝 예약 | 공용 | LAN |
| 8300 | ComfyUI | 📝 예약 | 공용 | LAN |
| 8400 | SDXL / Stable Diffusion WebUI | 📝 예약 | 공용 | LAN |
| 8500 | Embedding server (bge/e5) | 📝 예약 | 공용 | LAN |
| 18789 | **OpenClaw Gateway** (WebSocket RPC, CLI 에이전트 브로커) | ✅ 운영 (DeskRPG) / 📝 Office Tier 2 NPC 재사용 예정 | 공용 | LAN |

범례: ✅ 운영 · 🔄 이관 중 · 📝 예약(미구축) · ❌ 폐기

---

## 3. 오픈소스 모델 (Self-hosted)

### 3.1 LLM — Ollama @ twinverse-ai:11434

> **엔드포인트**: `http://192.168.219.117:11434`
> **OpenAI-compatible**: `POST /v1/chat/completions`, `/v1/embeddings`
> **Native API**: `POST /api/generate`, `/api/chat`, `/api/embeddings`

| 모델 태그 | 크기 | 강점 | 권장 용도 | 사용 프로젝트 |
|----------|------|------|----------|--------------|
| `qwen2.5:7b` | 4.7 GB | 한국어 ⭐ · 지시 추종 | 작업일지 요약 · 분류 · 마케팅 카피 | 공용 |
| `mistral:7b` | 4.4 GB | 범용 · 빠름 | 기본 텍스트 태스크 | 공용 |
| `llava:7b` | 4.7 GB | **멀티모달(비전)** | 이미지 설명 · 영수증 OCR · 메뉴 인식 | SodamFN (OCR 후보) |
| `qwen2.5:0.5b` | 0.4 GB | 초경량 · 초고속 | 간단 분류 · 키워드 추출 | 공용 |
| `gemma3:12b` | 8.1 GB | 한국어 · 빠른 응답 ⭐ | **Office 메타버스 NPC 대화** (200자 이하 말풍선) | TwinverseAI (NPC) |
| `gemma4:e4b` | 9.6 GB | 중간 품질 · 속도 균형 | NPC 대화 대안 · 일반 대화 | TwinverseAI (NPC 대안) |
| `gemma4:26b` | 18 GB | 고품질 | 중요 NPC (비서) · 요약 고품질 | 공용 (선택적) |
| `gemma4:31b` | 20 GB | 최고 품질 | 복잡 추론 · 심도 문서 분석 | 공용 (선택적) |

#### NPC 대화 권장 설정 (TwinverseAI Office)

- **1차 모델**: `gemma3:12b` — VRAM 8 GB, 한국어 OK, 6 플레이어 × 10 NPC 동시성 기준 3090 1장 수용
- **호출 경로**: `POST http://192.168.219.117:11434/api/chat` (backend `/api/npc/chat` 프록시)
- **환경변수**: `OLLAMA_URL=http://192.168.219.117:11434`, `NPC_OLLAMA_MODEL=gemma3:12b`
- **폴백**: `NPC_LLM_FALLBACK=anthropic` + `NPC_LLM_FALLBACK_API_KEY=...` (Ollama 장애 시만)
- **rate limit**: backend `/api/npc/chat` = 120/min (슬롯당 6명 × NPC 10명 동시 대화 피크 대응)

**추가 권장 모델** (미설치, 필요 시 pull):
- `qwen2.5:14b` · `qwen2.5:32b` — 고품질 한국어 (RTX 3090 24GB면 14b 4-bit 여유)
- `deepseek-r1:14b` — 추론 전용
- `nomic-embed-text` — 임베딩 (RAG 용)
- `llama3.2-vision:11b` — llava 대체

### 3.2 이미지 생성 — ai-image-service @ twinverse-ai:8100 (✅ 운영)

- **엔드포인트**: `http://192.168.219.117:8100`
- **배포 위치**: `/srv/ai-image-service/` (systemd unit: `ai-image-service.service`)
- **Python**: 3.12.3 · venv @ `/srv/ai-image-service/venv`
- **HF 캐시**: `/srv/ai-image-service/.hf_cache` (Flux.1-schnell은 gated repo이므로 `HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1` 강제)
- **로그**: `/var/log/ai-image-service.log`
- **관리 명령**: `ssh twinverse-ai "sudo systemctl (status|restart|stop) ai-image-service"`

| 엔드포인트 | 용도 | 비고 |
|-----------|------|------|
| `GET /health` | 헬스체크 + VRAM 상태 | gpu_count/gpus 반환 |
| `POST /generate` | T2I (Flux.1-schnell) | 4-step, STYLE_SUFFIXES 10종 (natural/studio/minimal/overhead/angle45/closeup/steam/delivery/casual/premium) |
| `POST /img2img` | I2I (Flux.1-schnell) | strength 파라미터 |
| `POST /upscale` | Real-ESRGAN x4 | 512→2048 |
| `POST /remove-bg` | rembg u2net | CPU |
| `POST /segment` | 마스크 추출 | — |
| `POST /inpaint` | SimpleLama 인페인팅 | CPU/GPU |

| 모델 | 용도 | 비고 |
|------|------|------|
| **Flux.1-schnell** | 고품질 T2I (4 step) | RTX 3090 24GB · `enable_sequential_cpu_offload` + `bfloat16` 사용 — **이게 최적**(2026-04-12 A/B 벤치마크 결과). 이유는 3.2.2 참조 |
| **Real-ESRGAN 4x** | 업스케일 (512 → 2048) | 타일 400, half=True |
| **rembg (u2net)** | 배경 제거 | CPU 실행 |
| **SimpleLama** | 인페인팅 (마스크 제거) | `simple-lama-inpainting==0.1.2` |
| (미래) Flux.1-dev | 더 고품질 T2I (20+ step) | gated — HF 토큰 필요 |

### 3.2.1 설치 · 복구 주의사항
- **Flux.1-schnell은 현재 gated repo** (2026-04 이후). 새로 받으려면 HF 토큰 + 라이선스 승인 필요.
  현 배포는 2026-04-03에 GPU PC에서 받아놓은 캐시를 `scp`로 이관해 사용 중.
  캐시 유실 시 복구는 (a) HF 토큰 설정 또는 (b) GPU PC(`D:\SodamAI\models\huggingface\hub\models--black-forest-labs--FLUX.1-schnell`)에서 재복사.
- systemd unit에 **`HF_HUB_OFFLINE=1` + `TRANSFORMERS_OFFLINE=1`** 필수. 없으면 gated 401 에러로 기동 실패.
- **basicsr==1.4.2 패치 필수**: `venv/lib/python3.12/site-packages/basicsr/data/degradations.py`에서
  `from torchvision.transforms.functional_tensor import rgb_to_grayscale` → `functional`로 수정 (torchvision 0.17+ 호환).
- **simple-lama-inpainting은 `--no-deps`로 설치** (pillow<10.0.0 핀이 깨져있음).

### 3.2.2 Flux 실행 모드 — A/B 벤치마크 결과 (2026-04-12)

RTX 3090 24GB + Flux.1-schnell bf16(≈33GB, transformer 단독만 ~24GB) 조합에서 **세 가지 모드를 실측**:

| 모드 | 1024x1024 · 4 step | 결과 | 판정 |
|------|-------------------|------|------|
| `pipe.to("cuda")` (native) | — | **OOM** (transformer 24GB + T5/VAE 초과) | ❌ 불가 |
| `enable_model_cpu_offload()` | ~22초 | 작동하나 transformer가 VRAM을 꽉 채워 다른 컴포넌트와 메모리 경쟁 발생 | ❌ 느림 |
| `enable_sequential_cpu_offload()` | **~11.5초** | 레이어 단위 소규모 스왑, VRAM 상시 0.7GB만 사용, PCIe 대역폭 효율적 | ✅ **최적** |

**결론**: `enable_sequential_cpu_offload` + `bfloat16` 조합이 RTX 3090 24GB에서 **가장 빠르고 안정적**.
"GTX 1080 레거시 설정"이라는 오해가 있을 수 있는데 실측 결과 24GB에서도 이 방식이 최적임.
A/B 결과는 `main.py` 주석에도 박제되어 있음. **코드 건드릴 때 함부로 native 모드로 바꾸지 말 것.**

### 3.2.3 하드웨어 안정성 경고 ⚠️ (2026-04-12 미해결)

> **twinverse-ai는 현재 장시간 Flux 워크로드에서 전원 관련 리부팅 이슈가 있음 — 하드웨어 미수리 상태.**

**증상**: 연속 Flux 이미지 생성 중 (2번째 생성 ~75% 지점) **서버가 갑자기 재부팅됨**.
- 커널 로그에 panic/oops/OOM/nvidia 에러 **전혀 없음**. "마지막 메시지 → 새 부팅 마커" 패턴 = 고전적 하드 파워로스 시그니처.
- 원인: **전압 스파이크 추정** (사용자 확인). 전원/PSU/브레이커 경로 이슈.
- 첫 번째 생성(콜드 로드)은 정상 완주(11.8초) → 두 번째부터 risk ↑.

**운영 가이드 (HW 수리 전까지)**:
1. 연속 생성 **금지** — 요청 간 쿨다운(예: 30초+)을 두거나, 배치 1개로 제한.
2. 프로덕션 이미지 파이프라인은 **6.1 폴백 캐스케이드**로 이중화 운영(Replicate/OpenAI 폴백 항상 활성).
3. `nvidia-smi -pl 280` (기본 350W) 같은 GPU 전력 제한으로 스파이크 완화 가능 — 임시 대응.
4. AI 사이드(코드/systemd)는 정상. **건드리지 말 것**. 하드웨어 이슈임.
5. 이 상태에서 새로운 project가 Flux 대량 사용을 계획한다면 **반드시 Steven에게 먼저 확인**.

### 3.3 TTS (예약, 미구축)
- Edge-TTS (로컬) + XTTS v2 후보

### 3.4 STT (예약, 미구축)
- Whisper large-v3 / faster-whisper

### 3.5 OpenClaw Gateway (CLI 에이전트 브로커)

> **WebSocket RPC 게이트웨이** — ChatGPT / Claude Code / Gemini 등 CLI 에이전트에 persistent session + 도구 사용 + 스트리밍 응답을 제공하는 통합 계층.
>
> **현재 운영**: DeskRPG (`tvdesk.twinverse.org`) 에서 AI NPC 동료 시스템으로 실사용 중.
> **Office 재사용 예정**: TwinverseAI Office 메타버스 Tier 2 에이전트 NPC (AI 비서, AI 개발자 등).

- **엔드포인트**: `ws://<host>:18789` (기본, `OPENCLAW_PORT=18789`)
- **프로토콜**: 자체 RPC (v1~v3) — `agents.list`, `agents.create`, `chat.send` (streaming delta), `chat.abort`
- **인증**: pairing flow + `OPENCLAW_TOKEN` (device identity, Ed25519 서명)
- **지원 모델 예시**: `openai-codex/gpt-5.4`, `anthropic-claude-code/sonnet-4-6`, (그 외 OpenClaw 플러그인 모델)
- **세션**: `agent:{agentId}:{sessionName}` 키로 persistent
- **환경변수 (표준)**:
  - `OPENCLAW_WS_URL` — 게이트웨이 WebSocket URL (예: `ws://192.168.219.101:18789`)
  - `OPENCLAW_TOKEN` — Orbitron secrets (실제 값 여기 금지)
  - `OPENCLAW_MODEL` — 기본 에이전트 모델 (프로젝트별 override 가능)
- **참조 클라이언트**: `C:\WORK\TwinverseAI\deskrpg-master\src\lib\openclaw-gateway.js` (Node.js) — Office 백엔드에서 Python 으로 포팅 시 참조

#### 용도 매트릭스

| 용도 | 프로젝트 | 에이전트 수 | 비고 |
|------|---------|------------|------|
| NPC 동료 (업무 위임, 2D) | DeskRPG | 채널별 n명 | ✅ 운영 |
| Tier 2 에이전트 NPC (3D) | TwinverseAI Office | 슬롯당 최대 3명 | 📝 Phase 0.5 Task 0.5.12 |

---

## 4. 유료 API 프로바이더

> 실제 키 값은 여기에 기입하지 않음. **Orbitron secrets** (또는 프로젝트별 안전 저장소)에만 저장.

| 프로바이더 | 환경변수명 (표준) | 키 보관처 | 현재 사용 프로젝트 | 용도 | 단가(참고) |
|----------|-------------------|----------|-------------------|------|-----------|
| OpenAI | `OPENAI_API_KEY` | Orbitron secrets | SodamFN (이미지 폴백) | DALL-E 3 · GPT-4 | $0.04/이미지 |
| Anthropic | `ANTHROPIC_API_KEY` | Orbitron secrets | (예정: 양 프로젝트) | Claude 3.5/4 | per-token |
| Replicate | `REPLICATE_API_TOKEN` | Orbitron secrets | SodamFN (이미지 폴백) | SDXL/Flux | ~$0.005/이미지 |
| Cloudflare R2 | `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL` | Orbitron secrets | SodamFN (이미지 저장) | 객체 스토리지 | — |
| HuggingFace | `HUGGINGFACE_TOKEN` | (예정) | (예정) | 모델 다운로드 게이트 | 무료 |
| ElevenLabs | `ELEVENLABS_API_KEY` | (예정) | (예정) | TTS 폴백 | per-char |
| Stability AI | `STABILITY_API_KEY` | (예정) | (예정) | SD3 대체 | per-image |

### 키 추가 시 표준 절차
1. 이 표에 한 행 추가 (환경변수명 · 프로바이더 · 용도)
2. 사용할 프로젝트의 `.env` 주석에만 존재 힌트 (`# OPENAI_API_KEY via Orbitron secrets`) — 실제 값은 금지
3. 해당 프로젝트 `Orbitron.yaml`에 `env:` 선언 (값은 빈 문자열, Orbitron secrets UI에서 채움)
4. 양쪽 CLAUDE.md에 “이 키는 공용”이라고 명시할 필요 있으면 갱신

---

## 5. 환경변수 네이밍 컨벤션 (전 프로젝트 공통)

| 변수명 | 의미 | 예시 |
|--------|------|------|
| `AI_GPU_SERVER_URL` | 이미지 생성(Flux) 호스트 | `http://192.168.219.117:8100` |
| `OLLAMA_URL` | 로컬 LLM 호스트 | `http://192.168.219.117:11434` |
| `TTS_SERVER_URL` | TTS 호스트 (예약) | `http://192.168.219.117:8101` |
| `MUSIC_SERVER_URL` | 음악 생성 호스트 (예약) | `http://192.168.219.117:8102` |
| `WHISPER_URL` | STT 호스트 (예약) | `http://192.168.219.117:8200` |
| `COMFYUI_URL` | ComfyUI 호스트 (예약) | `http://192.168.219.117:8300` |
| `OPENAI_API_KEY` | OpenAI 키 | (secrets) |
| `ANTHROPIC_API_KEY` | Claude 키 | (secrets) |
| `REPLICATE_API_TOKEN` | Replicate 키 | (secrets) |
| `{PROVIDER}_API_KEY` | 유료 프로바이더 표준 형식 | — |

**규칙**:
- 새 프로젝트도 이 이름 그대로 사용. 프로젝트별로 변형 금지.
- 값은 항상 FQDN 또는 IP + 포트. `localhost` 절대 금지(다른 기기에서 호출 안 됨).
- Docker 컨테이너에서 호출 시도 host IP 그대로 사용 가능 (twinverse-ai가 LAN에 열려 있음).

---

## 6. Fallback 캐스케이드 (표준 정책)

새 AI 기능을 만들 때 다음 순서로 구현한다. 이유: **비용 최소화 + 내구성 확보**.

### 6.1 이미지 생성
```
① twinverse-ai Flux.1-schnell (:8100)    ← 무료, 최우선
② Replicate SDXL/Flux                     ← 백업 ($0.005/장)
③ OpenAI DALL-E 3                          ← 최종 폴백 ($0.04/장)
```

### 6.2 LLM (텍스트)
```
① twinverse-ai Ollama qwen2.5:7b/14b       ← 무료, 최우선
② Anthropic Claude 3.5 Sonnet              ← 고난이도 태스크
③ OpenAI GPT-4                              ← 최종 폴백
```

### 6.3 TTS (예정)
```
① twinverse-ai Edge-TTS/XTTS v2 (:8101)    ← 무료
② ElevenLabs                                ← 프리미엄
```

### 6.4 STT (예정)
```
① twinverse-ai Whisper (:8200)             ← 무료
② OpenAI Whisper API                        ← 폴백
```

### 건강 체크 규칙
- 각 호출 앞단에 TCP 1.5초 reachability 체크 → fail 시 즉시 다음 티어로
- Circuit breaker: 3회 연속 실패 시 60초 간 해당 티어 스킵

---

## 7. 프로젝트별 사용 매트릭스

| 리소스 | TwinverseAI | SodamFN | 비고 |
|--------|-------------|---------|------|
| twinverse-ai Ollama | 🔄 도입 예정 | 🔄 도입 예정 (AI Gateway Phase 1) | 양쪽 모두 LLM 아직 미사용 |
| twinverse-ai Flux 이미지 (:8100) | 🔄 도입 가능 | ✅ 운영 | 양쪽 공용 (2026-04-12 이관 완료) |
| OpenAI API | ❌ | ✅ 폴백 | 키 공유 예정 |
| Anthropic API | ❌ | ❌ | 둘 다 미사용(예정) |
| Replicate API | ❌ | ✅ 폴백 | 키 공유 예정 |
| Cloudflare R2 | ❌ | ✅ 운영 | SodamFN 단독 |
| GPU PC Pixel Streaming | ✅ 운영 | ❌ | TwinverseAI 단독 |
| Orbitron PostgreSQL | ✅ 운영 | ✅ 운영 | 분리된 DB |

---

## 8. 변경 로그

| 날짜 | 변경 | 영향 프로젝트 | 작업자 |
|------|------|--------------|--------|
| 2026-04-12 | 레지스트리 최초 작성 · twinverse-ai(192.168.219.117) 서버 셋업 (Ubuntu 24.04, Docker 29.4, nvidia-container-toolkit 1.19, Ollama 0.20.5 + 4종 모델) | TwinverseAI · SodamFN | Steven + Claude |
| 2026-04-12 | **ai-image-service GPU PC(.100) → twinverse-ai(.117) 이관 완료**. systemd `ai-image-service.service`로 운영. Flux.1-schnell HF 캐시(32GB, snapshot only)를 scp로 이관. basicsr torchvision 호환 패치 + simple-lama `--no-deps` 설치 대응. `/health` LAN 응답 확인. | SodamFN · (TwinverseAI 사용 가능) | Steven + Claude |
| 2026-04-12 | **Flux A/B 벤치마크 + 코드 고정**: sequential_cpu_offload(11.5s) vs model_cpu_offload(22s) vs native(OOM) 실측. RTX 3090 24GB에서도 sequential이 최적임을 확인, `main.py`에 주석으로 박제(3.2.2). | SodamFN · 이후 Flux 사용할 모든 프로젝트 | Steven + Claude |
| 2026-04-12 | **twinverse-ai 하드웨어 안정성 경고 기록** (3.2.3): 연속 Flux 생성 중 전압 스파이크 추정 리부팅. HW 미수리 상태 — 운영 가이드(쿨다운·폴백 상시 활성·전력 제한) 추가. | 전 프로젝트 | Steven + Claude |
| 2026-04-12 | **레지스트리 크로스-프로젝트 반영**: C:\WORK 내 모든 AI 소비 프로젝트(Artifex.AI · ArtifexPro · AutoShorts_DT · TwinVerse · artifex.ai-studio-pro · proposal-agent)의 CLAUDE.md에 이 레지스트리 포인터 추가 — 모든 프로젝트가 동일한 twinverse-ai/GPU/AI 규칙을 참조. | 전 프로젝트 | Steven + Claude |

---

## 9. 변경 절차 (MUST READ — 일치성 유지 규칙)

새 AI 키/모델/서비스/엔드포인트를 추가할 때마다 다음 절차를 **반드시** 따른다.

### Step 1. 이 파일을 먼저 수정
- 해당 섹션(포트 예약표 · 모델 목록 · 프로바이더 · 변수명)을 업데이트
- Section 8 변경 로그에 한 행 추가 (날짜 · 변경 · 영향 프로젝트)

### Step 2. 영향 받는 모든 프로젝트의 `.env` / `Orbitron.yaml` / docs 동기화
- 변수명이 새로 추가되면 **양쪽 프로젝트 모두** `.env`/`Orbitron.yaml` 4곳에 반영
- 네이밍 규칙 섹션 5의 이름을 그대로 사용
- **한쪽만 업데이트하고 끝내면 안 됨** — cross-project drift의 원인

### Step 3. cross-check 후 커밋
커밋 전에 다음 3가지 확인:
1. [ ] 이 레지스트리와 각 프로젝트 `.env`의 변수명이 일치하는가?
2. [ ] 포트가 섹션 2 예약표에 등록되어 있고 충돌 없는가?
3. [ ] Orbitron secrets에 실제 키가 올라갔는가(유료 API인 경우)?

### Step 4. 세션 종료 시
- 변경이 있었다면 `/end` 스킬 사용 전 이 파일 커밋 여부 확인
- 이 파일은 어느 repo에도 속하지 않음(`C:\WORK\` 루트에 있음) — **직접 백업/git 관리 필요**

---

## 10. 운영 노트

### 10.1 twinverse-ai 기본 사용
```bash
# LLM 호출 (curl 테스트)
curl http://192.168.219.117:11434/api/generate \
  -d '{"model":"qwen2.5:7b","prompt":"안녕하세요","stream":false}'

# OpenAI-compatible
curl http://192.168.219.117:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5:7b","messages":[{"role":"user","content":"hi"}]}'

# Docker GPU 테스트
ssh twinverse-ai "sudo docker run --rm --gpus all nvidia/cuda:12.6.0-base-ubuntu24.04 nvidia-smi"

# Ollama 모델 추가
ssh twinverse-ai "ollama pull qwen2.5:14b"
```

### 10.2 보안 주의
- twinverse-ai는 현재 **LAN 전체에 Ollama가 열려 있음** (`0.0.0.0:11434`). 외부 노출 금지.
- 외부 접근이 필요하면 Cloudflare Tunnel 또는 authenticated reverse proxy를 앞단에 둘 것.
- API 키는 이 파일에 **절대** 기입 금지. Orbitron secrets만 사용.
- 프로젝트 `.env`에 비밀값 저장은 로컬 dev 한정, `.gitignore` 확인 필수.

### 10.3 알려진 문제/제약
- Ollama는 한 번에 한 모델만 VRAM에 로드 (RTX 3090 24GB면 14b 4-bit 여러 개 가능하지만 default는 keep_alive 기반 스왑).
- nvidia-container-toolkit 사용 시 `--gpus all` 플래그 필수. 일부 이미지는 `NVIDIA_VISIBLE_DEVICES=all`도 함께 요구.
- twinverse-ai의 디스크는 913GB / 817GB 여유. 모델 여러 개 받아도 여유 큼.

---

## 11. 참조

- TwinverseAI: `c:\WORK\TwinverseAI\CLAUDE.md` — 이 레지스트리 참조 섹션 포함
- SodamFN: `c:\WORK\SodamFN\CLAUDE.md` — 이 레지스트리 참조 섹션 포함
- Artifex.AI: `c:\WORK\Artifex.AI\CLAUDE.md` — 이 레지스트리 참조 포인터
- ArtifexPro: `c:\WORK\ArtifexPro\CLAUDE.md` — 이 레지스트리 참조 포인터
- artifex.ai-studio-pro: `c:\WORK\artifex.ai-studio-pro\CLAUDE.md` — 이 레지스트리 참조 포인터
- AutoShorts_DT: `c:\WORK\AutoShorts_DT\CLAUDE.md` — 이 레지스트리 참조 포인터
- TwinVerse: `c:\WORK\TwinVerse\CLAUDE.md` — 이 레지스트리 참조 포인터
- proposal-agent: `c:\WORK\proposal-agent\CLAUDE.md` — 이 레지스트리 참조 포인터
- SodamFN AI Gateway Phase 1 설계: `c:\WORK\SodamFN\docs\superpowers\specs\2026-04-11-ai-gateway-phase1-design.md`
