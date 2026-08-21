# ChinguMe Trust, Safety, and Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide prevention, reporting, evidence isolation, human review, appeals, emergency handling, and auditable administration for social, Dating, media, community, and future Opportunities activity.

**Architecture:** Product services emit minimized risk events and call a synchronous `SafetyDecisionPort` only for high-risk boundaries. Automated detections prioritize, warn, quarantine, or temporarily limit; irreversible enforcement requires policy-defined evidence and human review except explicit zero-tolerance emergency rules. A separately protected case store and admin console enforce least privilege, strong authentication, append-only audit, retention, and appeal restoration.

**Tech Stack:** NestJS core API, separate safety worker, PostgreSQL 18.4 separated schemas/roles, Redis-compatible rate limiting, object evidence vault, moderation provider ports, React/TypeScript admin console, OpenTelemetry metrics, Flutter report/block UX.

**Spec:** `docs/superpowers/specs/2026-08-21-chingume-global-platform-design.md`

**Additional Spec:** `docs/superpowers/specs/2026-08-21-chingume-profile-showcase-discovery-design.md`

## Global Constraints

- Reporting is reachable from profile, showcase image/video, search card, short, message, call, community, event, and listing contexts within two user actions.
- Immediate block/leave is always available and does not depend on report submission.
- Automated signals do not become a public score and do not alone impose permanent account termination except explicit legally required emergency policy.
- Evidence is minimized, encrypted under separate keys, purpose-limited, access-logged, and deleted by retention policy or legal hold resolution.
- Romance scam, investment/remittance solicitation, stalking, threats, sexual exploitation, malicious files, impersonation, and unsafe recruitment have named policy reasons.
- Emergency reports enter a 24-hour safety operation queue with policy-based first-response timers.
- Appeals can restore access without deleting the original decision or audit history.
- Administrator access requires least privilege, strong authentication, reason capture, and time-limited break-glass.
- Safety providers have local deterministic adapters, deadlines, contract tests, and fail-closed quarantine where content execution/download is possible.
- Every task follows red-green-refactor and ends with a focused commit.

---

## File Structure

```text
ChinguMe/
├── services/core-api/migrations/005_trust_safety.sql
├── services/core-api/src/modules/safety/
├── services/safety-worker/src/{risk,moderation,cases,metrics}/
├── apps/admin/src/{auth,cases,evidence,appeals,audit}/
├── apps/mobile/lib/features/safety/
├── safety/fixtures/red-team/
└── services/{core-api,safety-worker}/test/
```

## Stable Interfaces

```typescript
export type ReportReason = "harassment" | "impersonation" | "romance_scam" | "financial_solicitation" | "sexual_content" | "violence_threat" | "stalking" | "unsafe_recruitment" | "copyright" | "malicious_file" | "other_safety";
export interface SafetySubjectRef { kind: "profile" | "showcase" | "message" | "call" | "media" | "community" | "event" | "listing"; id: string; }
export interface SafetyDecision { action: "allow" | "warn" | "limit" | "quarantine" | "block" | "human_review"; reasonCodes: string[]; decisionId: string; expiresAt?: string; }
export interface SafetyDecisionPort { evaluate(input: { actorId: string; subject: SafetySubjectRef; action: string; signals: string[]; now: Date }): Promise<SafetyDecision>; }
```

---

### Task 1: Unified Reports and Isolated Evidence Vault

**Files:**
- Create: `services/core-api/migrations/005_trust_safety.sql`
- Create: `services/core-api/src/modules/safety/domain/report.ts`
- Create: `services/core-api/src/modules/safety/application/report.service.ts`
- Create: `services/core-api/src/modules/safety/application/evidence-vault.ts`
- Create: `services/core-api/src/modules/safety/adapters/http/report.controller.ts`
- Test: `services/core-api/test/reports.e2e-spec.ts`

**Interfaces:**
- Consumes: authenticated reporter, `SafetySubjectRef`, Plan 2/4 authorization and block hooks.
- Produces: report/case IDs, evidence snapshot references, immediate protective actions, and reporter-safe status.

- [ ] **Step 1: Write failing report/evidence tests**

```typescript
const report = await reportMessage({ reason: "romance_scam", includeRecentContext: true }).expect(201);
expect(report.body).toMatchObject({ status: "received" });
expect(JSON.stringify(report.body)).not.toContain("evidenceObjectKey");
await readEvidenceAs(supportAgent, report.body.reportId).expect(403);
```

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/core-api test -- reports.e2e-spec.ts`

Expected: FAIL because report/evidence modules are absent.

- [ ] **Step 3: Implement report and snapshot transactions**

Report states: `received|triaged|investigating|resolved|appealed|closed`. Capture only selected subject, bounded surrounding context, reporter note, timestamps, participant IDs, content hashes, and technical correlation IDs. For a showcase, snapshot the published showcase version, safe derivative hash, caption revision, surface, and moderation decision—not unrelated profile fields or viewing history. Store evidence bytes in a separate bucket/key and only an opaque reference in the safety schema.

- [ ] **Step 4: Apply immediate protections**

Let the reporter atomically block, leave a room, end a call, or hide a listing while reporting. Reporting alone never notifies the subject of reporter identity. Duplicate reports create distinct reporter records but link to a common case when policy keys match.

- [ ] **Step 5: Verify retention/access rules**

Run: `npm --workspace @chingume/core-api test -- reports.e2e-spec.ts migration.integration.spec.ts`

Expected: PASS for ownership, bounded context, separate database role, access denial, idempotent client submission, legal hold, expiry, and subject-access redaction.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/migrations/005_trust_safety.sql ChinguMe/services/core-api/src/modules/safety ChinguMe/services/core-api/test/reports.e2e-spec.ts
git commit -m "feat: add unified safety reports and evidence vault"
```

### Task 2: Risk Events, Rate Limits, and Contact/Scam Warnings

**Files:**
- Create: `services/safety-worker/src/risk/risk-event.ts`
- Create: `services/safety-worker/src/risk/risk-engine.ts`
- Create: `services/core-api/src/modules/safety/application/safety-decision.adapter.ts`
- Create: `services/core-api/src/modules/safety/application/contact-warning.ts`
- Test: `services/safety-worker/test/risk-engine.spec.ts`
- Test: `services/core-api/test/safety-boundaries.e2e-spec.ts`

**Interfaces:**
- Consumes: minimized events for connection/message/file/call/re-registration and policy version.
- Produces: `SafetyDecision`, cooldowns, warning codes, and review-priority events.

- [ ] **Step 1: Write failing policy-table tests**

Cover burst profile-chat requests, repeated identical greetings/messages, account/device re-registration, phone/email/external messenger sharing, bank/crypto addresses, investment promises, emergency threats, and benign language-exchange context. Expected actions must be explicit for every fixture.

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/safety-worker test -- risk-engine.spec.ts`

Expected: FAIL because the risk engine package is absent.

- [ ] **Step 3: Implement versioned deterministic policy evaluation**

Use named signals and a table mapping combinations to `allow|warn|limit|human_review`; retain signal provenance and policy version. Rate limits key on privacy-preserving member/device/network risk identifiers, have bounded TTLs, and support authorized appeal overrides.

- [ ] **Step 4: Enforce synchronous boundaries**

Evaluate before bulk profile-chat requests, repeated shorts-to-request conversion, first external-contact share, first financial identifier, rapid file sends, and high-risk re-registration. On worker outage: low-risk messages continue with conservative rate limits; new public showcase media remains moderation-pending; file execution/download remains protected by Plan 2 scanning; configured high-risk boundaries return temporary restriction and a request ID.

- [ ] **Step 5: Run safety boundary tests**

Run: `npm --workspace @chingume/core-api test -- safety-boundaries.e2e-spec.ts && npm --workspace @chingume/safety-worker test`

Expected: PASS for warning acceptance, cooldown expiry, block precedence, review enqueue, outage behavior, and false-positive fixtures.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/safety-worker ChinguMe/services/core-api/src/modules/safety ChinguMe/services/core-api/test/safety-boundaries.e2e-spec.ts ChinguMe/package.json ChinguMe/package-lock.json
git commit -m "feat: add safety risk decisions and warnings"
```

### Task 3: Text, Image, and File Moderation with Quarantine

**Files:**
- Create: `services/safety-worker/src/moderation/ports.ts`
- Create: `services/safety-worker/src/moderation/moderation-orchestrator.ts`
- Create: `services/safety-worker/src/moderation/adapters/local-moderation.provider.ts`
- Create: `services/core-api/src/modules/safety/adapters/moderation-public-content-review.adapter.ts`
- Test: `services/safety-worker/test/contracts/moderation-provider.contract.ts`
- Test: `services/safety-worker/test/moderation-orchestrator.spec.ts`

**Interfaces:**
- Consumes: clean malware scan outcome, content reference, locale, surface, participant context class, and Plan 4 `PublicContentReviewPort`.
- Produces: production `PublicContentReviewPort` adapter, labeled findings with confidence, policy action, quarantine/release command, and human-review priority.

- [ ] **Step 1: Write failing provider/orchestrator tests**

Use synthetic fixtures for harassment, sexual imagery, suspected nonconsensual imagery, scam solicitations, threats, impersonation, contact details embedded in profile video/captions, precise-location backgrounds/metadata, benign anatomy/health discussion, casting portfolio swimwear context, and malicious archive. Assert labels and whether automated action or human review is permitted.

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/safety-worker test -- moderation`

Expected: FAIL because moderation ports are absent.

- [ ] **Step 3: Define provider-neutral findings**

```typescript
export interface ModerationFinding { label: string; confidence: number; spans?: Array<{ start: number; end: number }>; providerEvidenceRef?: string; }
export interface ModerationProvider {
  classifyText(input: ModerationTextInput): Promise<ModerationFinding[]>;
  classifyImage(input: ModerationMediaInput): Promise<ModerationFinding[]>;
  classifyVideo(input: ModerationMediaInput & { frameRefs: string[]; transcriptRef?: string; ocrTextRef?: string }): Promise<ModerationFinding[]>;
}
```

Normalize vendor labels; do not persist raw provider payloads unless the evidence policy explicitly requires it. Local provider uses fixture hashes so test outcomes are deterministic.

- [ ] **Step 4: Implement fail-closed release policy**

Suspected illegal/sexual exploitation and malicious executable content remain quarantined and enter emergency review. Public showcase release also requires checks over images, sampled/video frames, audio transcript/captions, OCR text, metadata, and duplicate-abuse hashes; any required provider error keeps the showcase in `moderation_pending`. Medium-confidence contextual findings enter review without permanent punishment. Benign false-positive fixtures release with an audit record.

- [ ] **Step 5: Run contracts and integration**

Run: `npm --workspace @chingume/safety-worker test && npm --workspace @chingume/core-api test -- media.e2e-spec.ts`

Expected: PASS for timeouts, retries, duplicate result idempotency, quarantine, reviewer release, and provider payload minimization.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/safety-worker/src/moderation ChinguMe/services/safety-worker/test ChinguMe/services/core-api/test/media.e2e-spec.ts
git commit -m "feat: moderate text images and files"
```

### Task 4: Case Management, Enforcement, Appeals, and Restoration

**Files:**
- Create: `services/safety-worker/src/cases/case.ts`
- Create: `services/safety-worker/src/cases/case.service.ts`
- Create: `services/safety-worker/src/cases/enforcement.service.ts`
- Create: `services/safety-worker/src/cases/appeal.service.ts`
- Test: `services/safety-worker/test/case-lifecycle.spec.ts`

**Interfaces:**
- Consumes: reports, risk/moderation findings, reviewer identity/role, policy version.
- Produces: cases, assignments, enforcement commands, notifications, appeals, restoration commands, and append-only decision log.

- [ ] **Step 1: Write failing lifecycle tests**

```typescript
const decision = await reviewer.resolve(caseId, { outcome: "temporary_suspension", days: 7, policyCode: "SCAM_SOLICITATION", rationale: "fixture rationale" });
const appeal = await member.appeal(decision.id, { statement: "context" });
await secondReviewer.overturn(appeal.id, { rationale: "false positive" });
expect(await accountAccess(memberId)).toBe("restored");
expect(await auditEvents(decision.id)).toHaveLength(3);
```

- [ ] **Step 2: Run lifecycle tests**

Run: `npm --workspace @chingume/safety-worker test -- case-lifecycle.spec.ts`

Expected: FAIL because case services are absent.

- [ ] **Step 3: Implement case/enforcement states**

Case: `open|assigned|investigating|actioned|no_violation|appealed|closed`. Enforcement: `warning|feature_limit|content_removal|temporary_suspension|permanent_termination|emergency_lock`. Require policy code, evidence references, proportional duration, reviewer, rationale, and notification template version.

- [ ] **Step 4: Implement appeal independence and restoration**

The original decision maker cannot decide the first appeal when staffing allows. Overturn emits compensating restoration events for profile exposure, messaging, community roles, listings, and account access; it does not mutate/delete original audit events.

- [ ] **Step 5: Run concurrency and idempotency tests**

Run: `npm --workspace @chingume/safety-worker test -- case-lifecycle.spec.ts --runInBand`

Expected: PASS for duplicate worker delivery, competing reviewers, expired temporary action, partial feature restoration, appeal deadline, and permanent-history preservation.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/safety-worker/src/cases ChinguMe/services/safety-worker/test/case-lifecycle.spec.ts
git commit -m "feat: add safety cases enforcement and appeals"
```

### Task 5: Least-Privilege Admin Console and Break-Glass

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/src/auth/roles.ts`
- Create: `apps/admin/src/cases/case-list.tsx`
- Create: `apps/admin/src/cases/case-detail.tsx`
- Create: `apps/admin/src/evidence/evidence-viewer.tsx`
- Create: `apps/admin/src/appeals/appeal-panel.tsx`
- Create: `apps/admin/src/audit/audit-timeline.tsx`
- Test: `apps/admin/src/cases/case-detail.test.tsx`

**Interfaces:**
- Consumes: case/evidence/appeal APIs with workforce identity and strong-auth claims.
- Produces: role-filtered queues and explicit review actions; no direct database/object-store access.

- [ ] **Step 1: Write failing role/access tests**

Roles: `triage`, `investigator`, `senior_safety`, `appeals`, `emergency_lead`, `auditor`. Verify triage cannot reveal evidence bytes, investigators cannot decide their own appeal, auditors are read-only, and break-glass requires recent MFA, incident ID, reason, ≤30-minute expiry, and emergency-lead approval/audit.

- [ ] **Step 2: Run admin tests**

Run: `npm --workspace @chingume/admin test`

Expected: FAIL because the admin app is absent.

- [ ] **Step 3: Implement safe queue/detail UI**

Default to redacted member identifiers and blurred sensitive evidence; revealing requires a purpose choice and produces an audit event. Disable copy/download unless role and case policy allow. Every enforcement form requires policy code, duration, rationale, and confirmation.

- [ ] **Step 4: Implement session protection**

Use workforce SSO/OIDC configuration, phishing-resistant MFA claim requirement for evidence/enforcement, 15-minute inactivity lock, CSRF protection, secure headers, and no third-party analytics on admin routes.

- [ ] **Step 5: Run tests and production build**

Run: `npm --workspace @chingume/admin run check && npm --workspace @chingume/admin test && npm --workspace @chingume/admin run build`

Expected: all commands exit 0 and role snapshots expose only permitted controls.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/apps/admin ChinguMe/package.json ChinguMe/package-lock.json
git commit -m "feat: add least-privilege safety console"
```

### Task 6: Mobile Two-Action Report and Protective UX

**Files:**
- Create: `apps/mobile/lib/features/safety/domain/report_reason.dart`
- Create: `apps/mobile/lib/features/safety/data/safety_api.dart`
- Create: `apps/mobile/lib/features/safety/application/report_controller.dart`
- Create: `apps/mobile/lib/features/safety/presentation/report_sheet.dart`
- Create: `apps/mobile/lib/features/safety/presentation/safety_status_screen.dart`
- Test: `apps/mobile/test/features/safety/report_flow_test.dart`

**Interfaces:**
- Consumes: Task 1 report API, Task 2 warnings, Task 4 status/appeal APIs.
- Produces: reusable report launcher, block/end/leave options, warning acknowledgements, status, and appeal submission.

- [ ] **Step 1: Write failing context tests**

From search card/short/showcase/profile/message/call/community/event, one tap opens actions and a second selects report. Verify block is available without report, block removes the member from search and shorts immediately, emergency copy does not promise police response, reporter identity is never displayed to the subject, and an appeal status is accessible.

- [ ] **Step 2: Run tests**

Run: `flutter test test/features/safety/report_flow_test.dart`

Expected: FAIL because the safety UI is absent.

- [ ] **Step 3: Implement context-aware reporting**

Pre-fill only the subject reference and bounded evidence choice; require reason, optional note, and explicit context inclusion. Immediately reflect block/leave/end locally, retry report idempotently with a client report ID, and show a request/reference ID on failure.

- [ ] **Step 4: Implement warning and appeal UX**

Explain contact/financial warnings in plain language, allow safe cancel, and record acknowledgement without coercive dark patterns. Show enforcement reason category, duration, policy link, appeal deadline, and restoration status.

- [ ] **Step 5: Run Flutter checks**

Run: `flutter analyze && flutter test`

Expected: PASS for both flavors, screen readers, large text, offline retry, and each report context.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/apps/mobile/lib/features/safety ChinguMe/apps/mobile/test/features/safety
git commit -m "feat: add report block and appeal UX"
```

### Task 7: Emergency SLA, Transparency Metrics, and Red-Team Gate

**Files:**
- Create: `services/safety-worker/src/metrics/sla-monitor.ts`
- Create: `services/safety-worker/src/metrics/transparency-aggregator.ts`
- Create: `safety/fixtures/red-team/cases.jsonl`
- Create: `services/safety-worker/test/red-team.spec.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: all safety decisions/cases and synthetic red-team fixtures.
- Produces: emergency queue timers, privacy-thresholded metrics, alerts, and release report.

- [ ] **Step 1: Write failing SLA/metric tests**

Define policy timers for imminent violence/credible threat, suspected child sexual exploitation, nonconsensual intimate imagery, stalking, romance scam, harassment, unsafe casting, and malicious file. Assert overdue cases page only authorized on-call roles and metrics suppress cells below the configured privacy threshold.

- [ ] **Step 2: Build red-team fixtures**

Create synthetic multilingual profile-video/caption/chat-request/conversation/listing/file hashes for true positives and hard negatives. Each row contains policy version, input class, expected allowed action set, forbidden action set, and maximum queue priority—never real victim data or prohibited raw imagery.

- [ ] **Step 3: Run safety release gate**

```bash
npm --workspace @chingume/safety-worker test
npm --workspace @chingume/admin test
npm --workspace @chingume/core-api test -- safety reports
cd apps/mobile
flutter test test/features/safety
```

Expected: all commands exit 0; every red-team fixture produces an allowed action and every hard negative avoids forbidden permanent enforcement.

- [ ] **Step 4: Document 24-hour operations**

Document queue ownership, escalation contacts by role, evidence-handling steps, law-enforcement/emergency policy handoff, appeal separation, outage fallback, shift handover, and aggregate transparency report fields.

- [ ] **Step 5: Commit**

```bash
git add ChinguMe/services/safety-worker/src/metrics ChinguMe/services/safety-worker/test/red-team.spec.ts ChinguMe/safety/fixtures ChinguMe/.github/workflows/ci.yml ChinguMe/README.md
git commit -m "test: gate trust and safety operations"
```

---

## Plan Acceptance Gate

- [ ] Every supported context reaches report in two actions and offers independent immediate block/leave/end.
- [ ] Risk and moderation actions are versioned, explainable, auditable, and conservative under provider outage.
- [ ] Malicious/high-risk content remains quarantined until policy-authorized release.
- [ ] Public showcase release evaluates image, video frames, audio/captions, OCR, metadata, and duplicate-abuse signals; provider failure never releases new media.
- [ ] Showcase block/report removes both search and shorts exposure while preserving minimized evidence and appeal restoration.
- [ ] Evidence is minimized, separately encrypted/authorized, retention-controlled, and access-logged.
- [ ] Cases require policy/rationale; appeals emit restoration without deleting history.
- [ ] Admin roles, strong authentication, reason capture, and break-glass expiry pass tests.
- [ ] Emergency timers and privacy-thresholded transparency metrics are operational.
- [ ] Romance-scam, harassment, unsafe-casting, malicious-file, and false-positive red-team gates pass.
