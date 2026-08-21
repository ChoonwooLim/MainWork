# ChinguMe Translation Orchestrator and BYOK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver secure BYOK translation and a provider-neutral realtime/async translation pipeline for Korean, English, Japanese, Chinese, and Spanish beta users.

**Architecture:** A separately deployable Translation Orchestrator owns capability selection and streaming state while the core API owns member authorization and encrypted secret references. Dedicated ASR, MT, and TTS ports make providers replaceable; calls continue with original audio and an explicit degraded state when translation fails. All media forms use one job/session model and one quality-event vocabulary.

**Tech Stack:** Node.js 24.19.0, NestJS 11/Fastify 5, WebSocket, PostgreSQL 18.4, Redis-compatible streams/cache, KMS/HSM envelope-encryption port, OpenAI/Google/Azure Speech/DeepL adapters, Jest contract tests, Flutter caption/audio overlay.

**Spec:** `docs/superpowers/specs/2026-08-21-chingume-global-platform-design.md`

**Additional Spec:** `docs/superpowers/specs/2026-08-21-chingume-profile-showcase-discovery-design.md`

## Global Constraints

- Beta languages are `ko`, `en`, `ja`, `zh-Hans`, and `es`; capability is reported per modality, never as an unqualified language claim.
- Raw BYOK values never appear in PostgreSQL, mobile persistence, responses, analytics, support screens, traces, or error logs.
- OpenAI, Google, Azure Speech, and DeepL integrations sit behind ChinguMe-owned ports and contract tests.
- OpenClaw is not in the realtime ASR/MT/TTS hot path.
- Original audio remains usable when any translation stage fails.
- Caption translation target is p50 ≤1.5s and p95 ≤3s; translated voice target is p50 ≤2.5s and p95 ≤5s on the reference network.
- Transcript, recording, summary, and memory persistence follow the exact Plan 2 call consent snapshot.
- Every provider call has a deadline, circuit breaker, cost event, and deterministic local failure injection.
- All timestamps use UTC and visible IDs use UUIDv7.
- Every task follows red-green-refactor and ends with a focused commit.

---

## File Structure

```text
ChinguMe/
├── services/core-api/src/modules/byok/
├── services/translation-orchestrator/
│   ├── src/{domain,application,adapters,transport}/
│   ├── test/{contracts,realtime,jobs,quality}/
│   └── package.json
├── services/core-api/migrations/003_translation_byok.sql
├── quality/translation/{fixtures,rubrics,run-beta-eval.mjs}
└── apps/mobile/lib/features/translation/
```

## Stable Interfaces

```typescript
export type TranslationProvider = "openai" | "google" | "azure_speech" | "deepl";
export type TranslationModality = "text" | "asr" | "mt" | "tts" | "ocr" | "document" | "video_caption";
export interface SecretVault {
  put(input: { ownerId: string; provider: TranslationProvider; plaintext: Uint8Array }): Promise<{ secretRef: string; keyVersion: string }>;
  withSecret<T>(secretRef: string, fn: (plaintext: Uint8Array) => Promise<T>): Promise<T>;
  delete(secretRef: string): Promise<void>;
}
export interface CaptionEvent {
  sessionId: string;
  utteranceId: string;
  revision: number;
  sourceLanguage: string;
  sourceText: string;
  targetLanguage: string;
  translatedText: string;
  final: boolean;
  capturedAt: string;
  emittedAt: string;
}
```

---

### Task 1: Encrypted BYOK Connections and Deletion

**Files:**
- Create: `services/core-api/migrations/003_translation_byok.sql`
- Create: `services/core-api/src/modules/byok/application/secret-vault.ts`
- Create: `services/core-api/src/modules/byok/application/byok.service.ts`
- Create: `services/core-api/src/modules/byok/adapters/local/local-secret-vault.ts`
- Create: `services/core-api/src/modules/byok/adapters/http/byok.controller.ts`
- Test: `services/core-api/test/byok.e2e-spec.ts`

**Interfaces:**
- Consumes: verified member identity.
- Produces: provider connection metadata `{provider,status,lastCheckedAt,capabilities}` and opaque `secretRef`; raw values are accepted only on connect/rotate requests and never returned.

- [ ] **Step 1: Write failing secret-lifecycle tests**

```typescript
await connect("openai", "sk-local-valid").expect(201);
const listed = await listConnections().expect(200);
expect(JSON.stringify(listed.body)).not.toContain("sk-local-valid");
await disconnect("openai").expect(204);
expect(await vaultExistsFor(memberId, "openai")).toBe(false);
```

Add assertions that request/error logs, database rows, audit payloads, and problem details never contain the supplied secret or its prefix.

- [ ] **Step 2: Run the BYOK test**

Run: `npm --workspace @chingume/core-api test -- byok.e2e-spec.ts`

Expected: FAIL because the BYOK module does not exist.

- [ ] **Step 3: Implement envelope-vault semantics**

Persist only `secret_ref`, provider, owner, status, capability snapshot, key version, and timestamps. `withSecret` supplies a zeroizable byte buffer only inside the callback; adapters must not stringify it. Local vault uses AES-256-GCM with a test-only master key and refuses `staging|production`.

- [ ] **Step 4: Implement connect, check, rotate, and delete**

Connection check has an eight-second deadline and a no-billing/minimal request. Rotate writes the new reference, validates it, swaps in one transaction, then deletes the old reference. Failed validation deletes the candidate and retains the prior active connection.

- [ ] **Step 5: Run tests and tracked-secret scan**

Run: `npm --workspace @chingume/core-api test -- byok.e2e-spec.ts && npm run check:secrets`

Expected: PASS for owner isolation, rotation rollback, immediate deletion, timeout, invalid key, and redaction.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/migrations/003_translation_byok.sql ChinguMe/services/core-api/src/modules/byok ChinguMe/services/core-api/test/byok.e2e-spec.ts
git commit -m "feat: secure BYOK provider connections"
```

### Task 2: Capability Catalog and Provider Contracts

**Files:**
- Create: `services/translation-orchestrator/src/domain/capability.ts`
- Create: `services/translation-orchestrator/src/application/ports.ts`
- Create: `services/translation-orchestrator/src/application/capability-catalog.ts`
- Create: `services/translation-orchestrator/src/adapters/local/local-translation.provider.ts`
- Create: `services/translation-orchestrator/test/contracts/provider.contract.ts`
- Test: `services/translation-orchestrator/test/capability-catalog.spec.ts`

**Interfaces:**
- Consumes: provider ID and opaque secret resolver.
- Produces: exact ASR/MT/TTS/OCR/document/video capability matrix and provider contracts used by every adapter.

- [ ] **Step 1: Write the failing matrix and contract tests**

```typescript
expect(catalog.resolve({ source: "ko", target: "en", modalities: ["asr", "mt", "tts"] })).toEqual({
  asr: "local", mt: "local", tts: "local", voice: "local-en-neutral"
});
expect(() => catalog.resolve({ source: "xx", target: "ko", modalities: ["asr"] })).toThrowCode("CAPABILITY_UNAVAILABLE");
```

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/translation-orchestrator test -- capability-catalog.spec.ts`

Expected: FAIL because the service package and catalog are absent.

- [ ] **Step 3: Define the owned provider ports**

```typescript
export interface AsrProvider { stream(input: AsrStreamInput): AsyncIterable<AsrHypothesis>; }
export interface MtProvider { translate(input: { text: string; source: string; target: string; glossary: ReadonlyArray<GlossaryTerm>; deadline: Date }): Promise<{ text: string; detectedSource?: string; billedUnits: number }>; }
export interface TtsProvider { synthesize(input: { text: string; language: string; voice: string; deadline: Date }): AsyncIterable<Uint8Array>; }
export interface OcrProvider { recognize(input: { mediaRef: string; languageHints: string[]; deadline: Date }): Promise<OcrDocument>; }
```

- [ ] **Step 4: Implement deterministic local behavior**

Map fixed beta phrases bidirectionally, emit interim/final ASR revisions, stream two TTS chunks, return structured OCR blocks, and inject `timeout`, `rate_limit`, `invalid_secret`, and `provider_down` by fixture header. Unknown phrases return `[target] sourceText` only in local/test.

- [ ] **Step 5: Run contract suite**

Run: `npm --workspace @chingume/translation-orchestrator test -- contracts capability-catalog`

Expected: PASS for deadlines, ordered revisions, normalized error codes, billed-unit events, capability refusal, and secret-free errors.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/translation-orchestrator ChinguMe/package.json ChinguMe/package-lock.json
git commit -m "feat: define translation provider contracts"
```

### Task 3: Realtime ASR, MT, Caption, and TTS Session

**Files:**
- Create: `services/translation-orchestrator/src/domain/realtime-session.ts`
- Create: `services/translation-orchestrator/src/application/realtime-orchestrator.ts`
- Create: `services/translation-orchestrator/src/application/circuit-breaker.ts`
- Create: `services/translation-orchestrator/src/transport/websocket/realtime.gateway.ts`
- Test: `services/translation-orchestrator/test/realtime-session.spec.ts`

**Interfaces:**
- Consumes: Plan 2 `callId`, consent snapshot, participant languages, capability catalog, and secret references.
- Produces: ordered `CaptionEvent`, optional translated-audio chunks, session quality/cost events, and degradation state.

- [ ] **Step 1: Write failing ordering/degradation tests**

```typescript
expect(events.map(e => [e.utteranceId, e.revision, e.final])).toEqual([
  ["u1", 1, false], ["u1", 2, true], ["u2", 1, true]
]);
expect(await failureRun("mt_timeout")).toMatchObject({ callAudio: "original", translation: "degraded_text_retry" });
```

- [ ] **Step 2: Run the realtime test**

Run: `npm --workspace @chingume/translation-orchestrator test -- realtime-session.spec.ts`

Expected: FAIL because `RealtimeOrchestrator` is absent.

- [ ] **Step 3: Implement the state machine**

Use `created → receiving_audio → translating → draining → ended|failed`. Key ordering by `(sessionId,speakerId,utteranceId,revision)`. Drop stale interim revisions but never a final. Apply VAD boundaries, a 400ms interim translation debounce, and per-stage deadlines of ASR 1200ms, MT 800ms, TTS first-byte 1200ms.

- [ ] **Step 4: Implement fallback and circuit breaker**

Open after five failures in 30 seconds, half-open after 20 seconds, and isolate by provider/modality/region. Degrade `TTS fail → captions`, `MT fail → source captions`, `ASR fail → original audio only`; publish stable reason codes without provider secrets.

- [ ] **Step 5: Verify latency instrumentation and no-consent behavior**

Run: `npm --workspace @chingume/translation-orchestrator test -- realtime-session.spec.ts --runInBand`

Expected: PASS; private calls are rejected before audio ingress, nonconsenting recording produces no transcript persistence, and every final caption has capture/emission timestamps.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/translation-orchestrator/src ChinguMe/services/translation-orchestrator/test/realtime-session.spec.ts
git commit -m "feat: orchestrate realtime translated captions"
```

### Task 4: Four Production Adapter Shells and Routing Policy

**Files:**
- Create: `services/translation-orchestrator/src/adapters/openai/openai.adapter.ts`
- Create: `services/translation-orchestrator/src/adapters/google/google.adapter.ts`
- Create: `services/translation-orchestrator/src/adapters/azure/azure-speech.adapter.ts`
- Create: `services/translation-orchestrator/src/adapters/deepl/deepl.adapter.ts`
- Create: `services/translation-orchestrator/src/application/provider-router.ts`
- Test: `services/translation-orchestrator/test/contracts/{openai,google,azure,deepl}.contract.spec.ts`

**Interfaces:**
- Consumes: ports from Task 2, member connection metadata, capability/health/cost inputs.
- Produces: provider adapters with normalized results and a deterministic routing decision record.

- [ ] **Step 1: Write HTTP-fixture contract tests**

For each adapter, mock official HTTP/stream responses and assert request authentication stays in headers, timeouts abort sockets, rate limit maps to `PROVIDER_RATE_LIMITED`, invalid credentials map to `PROVIDER_AUTH_FAILED`, and response logs contain no body/audio/secret.

- [ ] **Step 2: Run contract tests**

Run: `npm --workspace @chingume/translation-orchestrator test -- adapters`

Expected: FAIL because production adapters are absent.

- [ ] **Step 3: Implement adapters without SDK types leaking inward**

Convert vendor payloads at adapter boundaries into the Task 2 types. Set explicit connect/read deadlines, maximum response sizes, supported-region configuration, and user-agent/request correlation. Never accept arbitrary provider base URLs from mobile input.

- [ ] **Step 4: Implement routing score and audit record**

```typescript
score = capabilityPass ? qualityWeight * quality - latencyWeight * p95Ms - costWeight * normalizedCost - healthPenalty : -Infinity;
```

Prefer the member's connected provider for BYOK, then only another provider the same member explicitly connected. Persist provider, modalities, languages, reason codes, estimated units, and health snapshot—not source content.

- [ ] **Step 5: Run adapter and router tests**

Run: `npm --workspace @chingume/translation-orchestrator test -- adapters provider-router`

Expected: PASS for all normalized fixtures, deterministic tie-breaking, capability refusal, circuit-open fallback, and no unauthorized cross-provider spending.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/translation-orchestrator/src/adapters ChinguMe/services/translation-orchestrator/src/application/provider-router.ts ChinguMe/services/translation-orchestrator/test/contracts
git commit -m "feat: add BYOK translation adapters and routing"
```

### Task 5: Text and Media Translation Jobs

**Files:**
- Create: `services/translation-orchestrator/src/domain/translation-job.ts`
- Create: `services/translation-orchestrator/src/application/job-orchestrator.ts`
- Create: `services/translation-orchestrator/src/transport/http/jobs.controller.ts`
- Create: `services/translation-orchestrator/src/adapters/queue/local-job-queue.ts`
- Test: `services/translation-orchestrator/test/jobs.e2e-spec.ts`

**Interfaces:**
- Consumes: clean Plan 2 `mediaId`, message text, authorized member, target language, and modality capability.
- Produces: idempotent jobs for `text|voice_note|image_ocr|document|video_caption|profile_intro_caption`, text contexts `message|chat_request_preview|profile_text`, progress events, structured outputs, expiry, and cancellation.

- [ ] **Step 1: Write failing job tests**

```typescript
const a = await createJob({ clientJobId: "job-1", kind: "image_ocr", mediaId, target: "ko" });
const b = await createJob({ clientJobId: "job-1", kind: "image_ocr", mediaId, target: "ko" });
expect(b.id).toBe(a.id);
expect(await createJobFor(quarantinedMedia)).toRejectCode("MEDIA_NOT_CLEAN");
```

- [ ] **Step 2: Run job tests**

Run: `npm --workspace @chingume/translation-orchestrator test -- jobs.e2e-spec.ts`

Expected: FAIL because the job model does not exist.

- [ ] **Step 3: Implement bounded job stages**

Use `queued → extracting → translating → rendering → completed|failed|cancelled|expired`. Preserve OCR block coordinates, document page/paragraph order, voice-note timestamps, and video cue timecodes. For `chat_request_preview`, read the Plan 2 original greeting by authorized request ID and return a provider-job-bound translation; never accept a client-authored translation as trusted output. For `profile_intro_caption`, require the profile owner, produce original cues plus requested translated cues, mark machine text as editable, and publish only the owner's approved revision. Outputs reference derived objects in Plan 2 storage and expire according to connection-request, conversation, or profile-showcase retention.

- [ ] **Step 4: Implement idempotency, progress, and cancellation**

Unique `(member_id,client_job_id)`, at-least-once workers, compare-and-swap stage transitions, and safe re-entry after worker death. Cancellation stops new provider calls, deletes incomplete derived objects, and retains only the audit outcome.

- [ ] **Step 5: Run all job fixtures**

Run: `npm --workspace @chingume/translation-orchestrator test -- jobs.e2e-spec.ts`

Expected: PASS for text, voice note, OCR layout, PDF order, video cues, owner-approved profile captions, duplicate delivery, cancellation, provider timeout, forbidden media, and output expiry.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/translation-orchestrator/src/domain/translation-job.ts ChinguMe/services/translation-orchestrator/src/application/job-orchestrator.ts ChinguMe/services/translation-orchestrator/src/transport/http/jobs.controller.ts ChinguMe/services/translation-orchestrator/src/adapters/queue ChinguMe/services/translation-orchestrator/test/jobs.e2e-spec.ts
git commit -m "feat: translate text and shared media jobs"
```

### Task 6: Mobile Translation Controls and Caption Overlay

**Files:**
- Create: `apps/mobile/lib/features/translation/domain/translation_capability.dart`
- Create: `apps/mobile/lib/features/translation/data/translation_api.dart`
- Create: `apps/mobile/lib/features/translation/application/translation_controller.dart`
- Create: `apps/mobile/lib/features/translation/presentation/byok_connections_screen.dart`
- Create: `apps/mobile/lib/features/translation/presentation/caption_overlay.dart`
- Modify: `apps/mobile/lib/features/calls/presentation/call_screen.dart`
- Test: `apps/mobile/test/features/translation/translation_flow_test.dart`

**Interfaces:**
- Consumes: Tasks 1–5 APIs/events and Plan 2 AI call consent.
- Produces: BYOK connection UI, capability disclosure, original/translated captions, voice mode, and degraded-state accessibility announcements.

- [ ] **Step 1: Write failing mobile journey tests**

Verify a key field is obscured and cleared after submission; the key never appears in widget diagnostics; unsupported TTS is shown before call; stale caption revisions are ignored; original and translation can both be expanded; TTS failure keeps captions and original audio.

- [ ] **Step 2: Run the widget test**

Run: `flutter test test/features/translation/translation_flow_test.dart`

Expected: FAIL because translation UI is absent.

- [ ] **Step 3: Implement controller models**

```dart
enum TranslationAudioMode { originalWithCaptions, duckedOriginalWithTranslation, translationOnly }
final class CaptionLine {
  const CaptionLine({required this.utteranceId, required this.revision, required this.source, required this.translation, required this.isFinal});
  final String utteranceId, source, translation;
  final int revision;
  final bool isFinal;
}
```

Keep only a bounded in-memory caption window unless transcript consent is true. Wipe key field controllers immediately after connect/rotate completes or fails.

- [ ] **Step 4: Integrate with call and chat screens**

Start translation only in `aiTranslation` calls. Provide language and voice selectors from server capability data, never a hard-coded promise. Display `원음 통화는 계속됩니다` for degraded states and allow immediate translation stop without ending the call.

- [ ] **Step 5: Run Flutter checks**

Run: `flutter analyze && flutter test`

Expected: PASS for both app flavors, screen-reader labels, large text, reconnect/revision ordering, and secret diagnostics.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/apps/mobile/lib/features/translation ChinguMe/apps/mobile/lib/features/calls/presentation/call_screen.dart ChinguMe/apps/mobile/test/features/translation
git commit -m "feat: add BYOK translation and live captions UI"
```

### Task 7: Five-Language Quality and Latency Gate

**Files:**
- Create: `quality/translation/fixtures/beta-five-languages.jsonl`
- Create: `quality/translation/rubrics/human-rating.md`
- Create: `quality/translation/run-beta-eval.mjs`
- Create: `services/translation-orchestrator/test/quality/beta-quality.spec.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: realtime and job interfaces, beta language list, reference-network profile.
- Produces: machine-readable per-language/modality latency, semantic checks, human-rating export, and release pass/fail report.

- [ ] **Step 1: Create representative fixtures and failing gate**

Include at least 50 licensed/synthetic utterances per direction covering greetings, names, numbers, dates, honorifics, slang, safety warnings, noisy audio, code-switching, and empty/silent input. Hash fixture audio and prohibit personal conversations.

- [ ] **Step 2: Implement the evaluator**

Emit JSON with ASR WER/CER, terminology pass rate, caption p50/p95, TTS first-byte p50/p95, provider failures, and cost units. Gate local deterministic CI on ordering/latency budgets; run paid-provider quality as an authorized scheduled/manual job.

- [ ] **Step 3: Run the beta harness**

Run: `node quality/translation/run-beta-eval.mjs --provider local --report artifacts/beta-local.json`

Expected: exit 0, five languages present, caption p50 ≤1500ms/p95 ≤3000ms, TTS p50 ≤2500ms/p95 ≤5000ms, and no missing safety fixture.

- [ ] **Step 4: Add end-to-end failure injection**

Replay a bilingual synthetic call, fail the primary MT adapter on utterance 3, confirm fallback or source-caption degradation, preserve utterance order, and scan report/log output for every test secret.

- [ ] **Step 5: Run repository verification**

```bash
npm run verify
npm --workspace @chingume/translation-orchestrator test
cd apps/mobile
flutter analyze
flutter test
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/quality/translation ChinguMe/services/translation-orchestrator/test/quality ChinguMe/.github/workflows/ci.yml ChinguMe/README.md
git commit -m "test: gate five-language translation quality"
```

---

## Plan Acceptance Gate

- [ ] BYOK connect, check, rotate, and delete never expose raw credentials.
- [ ] OpenAI, Google, Azure Speech, DeepL, and local adapters pass the same owned contracts.
- [ ] A bilingual recorded call produces ordered interim/final captions and optional TTS.
- [ ] Provider failure keeps original audio and announces the exact degraded capability.
- [ ] Private calls and nonconsenting calls reject translation/transcript persistence.
- [ ] Text, voice-note, OCR, document, and video-caption jobs are idempotent and authorized.
- [ ] Profile intro captions preserve original cues, distinguish machine translations, and cannot publish without the profile owner's approval.
- [ ] Beta capability reporting is accurate per language and modality.
- [ ] Five-language quality, latency, cost-event, security, API, and Flutter checks pass.
