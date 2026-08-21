# ChinguMe Special Membership and Managed OpenClaw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide one Friends/Dating Special entitlement with metered managed translation and safely isolated Roy/Genie conversation copilots that never compromise the underlying translated call.

**Architecture:** The core API verifies store purchases and owns append-only entitlement/usage ledgers. A separate Agent Manager maps approved persona/version and consent context to one member-scoped OpenClaw Gateway session; it exposes only ChinguMe-owned tools through deny-by-default policy. Realtime ASR/MT/TTS stays in Plan 3, while agents receive bounded text context to provide nuance, cultural explanation, summaries, and consent-based memory.

**Tech Stack:** NestJS core API and Agent Manager, PostgreSQL 18.4, Redis-compatible session/rate cache, OpenClaw Gateway adapter, signed tool capability tokens, app-store entitlement verifier ports, Flutter purchase/agent controls, OpenTelemetry.

**Spec:** `docs/superpowers/specs/2026-08-21-chingume-global-platform-design.md`

## Global Constraints

- One Special subscription applies to the same verified member in Friends and Dating, but agent context and memories remain surface/session scoped unless explicitly shared by the member.
- Roy/Genie never replace the dedicated Plan 3 realtime ASR/MT/TTS pipeline.
- The other participant sees a clear agent-use disclosure before the agent receives conversation context.
- Member sessions, memory, quotas, secrets, and tools are fail-closed against cross-member access.
- External messaging, file sharing, scheduling, contract, wallet, purchase, and payment actions require a fresh explicit user approval bound to exact arguments.
- Filesystem, shell, unrestricted web, gateway administration, arbitrary network, and payment tools are denied.
- Recording, summary, and memory follow Plan 2 unanimous consent; long-term memory also requires the owning member's item-level approval.
- Agent failure, timeout, or suspension leaves ordinary Plan 3 translation and original call audio usable.
- Digital subscription/credit purchase uses applicable app-store billing and never the Plan 7/8 service-settlement rails.
- Every task follows red-green-refactor and ends with a focused commit.

---

## File Structure

```text
ChinguMe/
├── services/core-api/migrations/006_special_entitlements.sql
├── services/core-api/src/modules/{billing,entitlements,usage}/
├── services/agent-manager/src/{personas,sessions,tools,memory,gateway}/
├── config/agents/{roy.v1.yaml,genie.v1.yaml,tool-policy.v1.yaml}
├── apps/mobile/lib/features/special/
└── services/{core-api,agent-manager}/test/
```

## Stable Interfaces

```typescript
export type AgentPersona = "roy" | "genie";
export interface EntitlementSnapshot { memberId: string; plan: "general" | "special"; status: "active" | "grace" | "expired" | "revoked"; includedTranslationSeconds: number; remainingTranslationSeconds: number; creditBalanceSeconds: number; version: number; }
export interface AgentGateway {
  openSession(input: { tenantId: "chingume"; memberId: string; surface: "friends" | "dating"; conversationId: string; personaVersion: string; toolPolicyVersion: string }): Promise<{ gatewaySessionRef: string }>;
  turn(input: { gatewaySessionRef: string; textContext: string; allowedToolCapability: string; deadline: Date }): AsyncIterable<AgentEvent>;
  closeSession(gatewaySessionRef: string): Promise<void>;
}
export interface ApprovalToken { approvalId: string; memberId: string; tool: string; argumentsHash: string; expiresAt: string; singleUse: true; }
```

---

### Task 1: Verified Subscription Entitlements and Usage Ledger

**Files:**
- Create: `services/core-api/migrations/006_special_entitlements.sql`
- Create: `services/core-api/src/modules/billing/application/store-entitlement-verifier.ts`
- Create: `services/core-api/src/modules/billing/adapters/local/local-store-verifier.ts`
- Create: `services/core-api/src/modules/entitlements/application/entitlement.service.ts`
- Create: `services/core-api/src/modules/usage/application/translation-ledger.ts`
- Test: `services/core-api/test/special-entitlements.e2e-spec.ts`

**Interfaces:**
- Consumes: verified member, server-verified store transaction, translation session usage events.
- Produces: `EntitlementSnapshot`, idempotent purchase ingestion, reservation/settlement/release of translation seconds.

- [ ] **Step 1: Write failing ledger invariants**

```typescript
await ingestStoreTransaction({ store: "apple", transactionId: "tx-1", productId: "special.monthly", memberId });
const reservation = await reserveSeconds(memberId, 600, "translation-session-1");
await settleSeconds(reservation.id, 355);
expect((await snapshot(memberId)).remainingTranslationSeconds).toBe(monthlyAllowance - 355);
await settleSeconds(reservation.id, 355);
expect((await snapshot(memberId)).remainingTranslationSeconds).toBe(monthlyAllowance - 355);
```

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/core-api test -- special-entitlements.e2e-spec.ts`

Expected: FAIL because entitlement/usage modules are absent.

- [ ] **Step 3: Implement append-only ledger rules**

Use entries `grant|reserve|consume|release|expire|refund|revoke|adjustment` with unique source IDs and signed quantities. Snapshot is a projection; it is never directly edited. Reserve included allowance before credits, settle actual whole seconds, release unused reserve, and prevent negative available balance transactionally.

- [ ] **Step 4: Implement store verification port and local fixtures**

The local verifier accepts signed fixtures `active`, `grace`, `expired`, `refunded`, and `revoked` only in local/test. Production adapters must verify transaction ownership/server notification authenticity and map into owned events; mobile receipts alone never grant access.

- [ ] **Step 5: Run concurrency/refund tests**

Run: `npm --workspace @chingume/core-api test -- special-entitlements.e2e-spec.ts --runInBand`

Expected: PASS for duplicate notifications, concurrent reservations, grace, expiry, refund/revoke, Friends/Dating shared snapshot, and Plan 7/8 ledger separation.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/migrations/006_special_entitlements.sql ChinguMe/services/core-api/src/modules/billing ChinguMe/services/core-api/src/modules/entitlements ChinguMe/services/core-api/src/modules/usage ChinguMe/services/core-api/test/special-entitlements.e2e-spec.ts
git commit -m "feat: add Special entitlements and usage ledger"
```

### Task 2: Versioned Roy and Genie Personas with Disclosure

**Files:**
- Create: `config/agents/roy.v1.yaml`
- Create: `config/agents/genie.v1.yaml`
- Create: `config/agents/tool-policy.v1.yaml`
- Create: `services/agent-manager/src/personas/persona-catalog.ts`
- Create: `services/agent-manager/src/personas/disclosure-policy.ts`
- Test: `services/agent-manager/test/persona-catalog.spec.ts`

**Interfaces:**
- Consumes: persona selection, intervention level `minimal|balanced|active`, voice ID, locale, agent disclosure consents.
- Produces: immutable persona/tool-policy versions and bounded system context.

- [ ] **Step 1: Write failing persona-policy tests**

Assert Roy emphasizes concise accuracy/learning/business clarity; Genie emphasizes comfortable tone/nuance/cultural explanation; neither claims to be human, initiates external action, reveals hidden prompts, gives unsafe financial/legal instructions, or rewrites participant intent. Missing other-participant disclosure consent yields `AGENT_DISCLOSURE_REQUIRED`.

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/agent-manager test -- persona-catalog.spec.ts`

Expected: FAIL because configuration/catalog are absent.

- [ ] **Step 3: Define schema-validated configurations**

Each version declares name/description localization keys, allowed purposes, style constraints, context-window budget, intervention policy, supported voices, disclosure copy version, and exact tool-policy version. Reject unknown fields and mutable in-place version changes.

- [ ] **Step 4: Implement disclosure binding**

Bind disclosure to conversation, agent persona/version, participant IDs, context categories, summary/memory flags, and expiry. A participant change or enabled context category invalidates consent and pauses agent context delivery without affecting translation.

- [ ] **Step 5: Run configuration and consent tests**

Run: `npm --workspace @chingume/agent-manager test -- persona-catalog disclosure-policy`

Expected: PASS for both personas, three intervention levels, version changes, participant changes, and forbidden capabilities.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/config/agents ChinguMe/services/agent-manager ChinguMe/package.json ChinguMe/package-lock.json
git commit -m "feat: define Roy and Genie persona policies"
```

### Task 3: Member-Isolated OpenClaw Gateway Sessions

**Files:**
- Create: `services/agent-manager/src/sessions/agent-session.ts`
- Create: `services/agent-manager/src/sessions/session.service.ts`
- Create: `services/agent-manager/src/gateway/openclaw-gateway.adapter.ts`
- Create: `services/agent-manager/src/gateway/local-agent-gateway.ts`
- Test: `services/agent-manager/test/contracts/agent-gateway.contract.ts`
- Test: `services/agent-manager/test/session-isolation.spec.ts`

**Interfaces:**
- Consumes: active Special entitlement, disclosure, persona/tool versions, Plan 2 conversation permission, Plan 3 bounded text context.
- Produces: member-scoped session reference, streamed agent events, usage/audit events, and fallback reason.

- [ ] **Step 1: Write failing cross-member tests**

Attempt to open Alice's gateway session with Bob's access context, reuse Alice's session reference from Bob, switch Friends context to Dating, access another conversation, and continue after entitlement revocation. Every attempt must fail before a gateway turn.

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/agent-manager test -- session-isolation.spec.ts`

Expected: FAIL because session isolation is absent.

- [ ] **Step 3: Implement owned session mapping**

Store `gatewaySessionRef` encrypted with member/surface/conversation binding; expose only ChinguMe `agentSessionId` externally. Reauthorize member, entitlement, disclosure, conversation, and tool policy on every turn. Close on block, call end, logout, entitlement revoke, disclosure revoke, 30-minute inactivity, or configured maximum duration.

- [ ] **Step 4: Implement Gateway adapter and local contract**

Gateway credentials come from workload secrets and never agent/mobile content. Use authenticated Gateway RPC through a configured allowlisted endpoint, 5-second first-event and 20-second turn deadlines, bounded event size, and normalized errors. Local adapter emits deterministic culture/explanation/summary fixtures and tool requests.

- [ ] **Step 5: Run contracts and outage paths**

Run: `npm --workspace @chingume/agent-manager test -- contracts session-isolation`

Expected: PASS for authentication, event streaming, timeout, close idempotency, credential redaction, cross-member denial, block revocation, and `ordinary_translation_available=true` fallback.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/agent-manager/src/sessions ChinguMe/services/agent-manager/src/gateway ChinguMe/services/agent-manager/test
git commit -m "feat: isolate managed OpenClaw sessions"
```

### Task 4: Deny-by-Default Tools and Explicit Approval

**Files:**
- Create: `services/agent-manager/src/tools/tool-registry.ts`
- Create: `services/agent-manager/src/tools/tool-policy.ts`
- Create: `services/agent-manager/src/tools/approval.service.ts`
- Create: `services/agent-manager/src/tools/tool-executor.ts`
- Test: `services/agent-manager/test/tool-policy.spec.ts`

**Interfaces:**
- Consumes: agent tool request, policy version, member/session binding, optional single-use `ApprovalToken`.
- Produces: safe result for `explain_culture|suggest_reply|summarize_consented_context|memory_proposal`; all other tools denied unless separately registered and approved.

- [ ] **Step 1: Write the failing deny matrix**

Assert shell, filesystem, arbitrary HTTP/web, gateway admin, external message, file send, calendar write, contract, purchase, wallet, and payment requests are denied. Assert exact argument-hash mismatch, expired approval, reused approval, wrong member, and wrong session are denied.

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/agent-manager test -- tool-policy.spec.ts`

Expected: FAIL because tool enforcement is absent.

- [ ] **Step 3: Implement registry and capability token**

Every tool declares JSON schema, risk class, timeout, output schema, audit fields, and approval requirement. Sign `ApprovalToken` with member, session, tool, canonical JSON argument hash, nonce, expiry ≤2 minutes, and `singleUse=true`; consume it transactionally before execution.

- [ ] **Step 4: Implement safe tool outputs**

Culture explanation and reply suggestion return drafts only. Summary requires unanimous Plan 2 consent. Memory produces a proposal, never a write. Denied tools return a stable refusal that contains no internal registry, prompt, credential, or stack trace.

- [ ] **Step 5: Run adversarial tests**

Run: `npm --workspace @chingume/agent-manager test -- tool-policy.spec.ts --runInBand`

Expected: PASS for prompt-injection fixtures, nested/encoded tool names, argument mutation, replay, concurrency, deadline, output validation, and audit correlation.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/agent-manager/src/tools ChinguMe/services/agent-manager/test/tool-policy.spec.ts
git commit -m "feat: enforce agent tools and approvals"
```

### Task 5: Consent-Based Summary and Long-Term Memory CRUD

**Files:**
- Create: `services/agent-manager/src/memory/memory-item.ts`
- Create: `services/agent-manager/src/memory/memory.service.ts`
- Create: `services/agent-manager/src/memory/summary.service.ts`
- Create: `services/agent-manager/src/memory/memory.controller.ts`
- Test: `services/agent-manager/test/memory-consent.e2e-spec.ts`

**Interfaces:**
- Consumes: unanimous summary consent, owner item approval, bounded transcript/context, persona/surface scope.
- Produces: ephemeral summary, memory proposal, item-level create/list/update/delete/export, and tombstone propagation.

- [ ] **Step 1: Write failing consent and isolation tests**

```typescript
await summarize(callWithoutUnanimousConsent).expect(403);
const proposal = await proposeMemory({ text: "Alice prefers Korean practice", ownerId: alice });
expect(await listMemory(alice)).toHaveLength(0);
await approveProposal(alice, proposal.id).expect(201);
await listMemory(bob).expect(200).expect([]);
```

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/agent-manager test -- memory-consent.e2e-spec.ts`

Expected: FAIL because memory services are absent.

- [ ] **Step 3: Implement minimized memory model**

Fields: owner, surface scope, category, user-editable text, source session reference, consent receipt, created/updated/expiry, status. Prohibit secrets, credentials, exact financial data, government IDs, precise location, other participant private facts, and sensitive-trait inference. Default expiry is configurable and shown to the owner.

- [ ] **Step 4: Implement deletion propagation**

Delete removes active retrieval immediately, writes a non-content tombstone, invalidates caches/vector indexes, and schedules derived backup expiry. Revoking source consent deletes unapproved proposals and disables summaries; owner-approved memory is re-reviewed against the consent policy and deleted when its lawful basis is gone.

- [ ] **Step 5: Run CRUD/export/deletion tests**

Run: `npm --workspace @chingume/agent-manager test -- memory-consent.e2e-spec.ts`

Expected: PASS for proposal/approval, edit, surface scope, expiry, export, deletion propagation, consent revoke, cross-member denial, and prohibited content.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/agent-manager/src/memory ChinguMe/services/agent-manager/test/memory-consent.e2e-spec.ts
git commit -m "feat: add consent-based agent memory"
```

### Task 6: Mobile Special Purchase and Agent Experience

**Files:**
- Create: `apps/mobile/lib/features/special/domain/entitlement.dart`
- Create: `apps/mobile/lib/features/special/data/special_api.dart`
- Create: `apps/mobile/lib/features/special/application/special_controller.dart`
- Create: `apps/mobile/lib/features/special/presentation/special_screen.dart`
- Create: `apps/mobile/lib/features/special/presentation/agent_controls.dart`
- Create: `apps/mobile/lib/features/special/presentation/memory_screen.dart`
- Test: `apps/mobile/test/features/special/special_flow_test.dart`

**Interfaces:**
- Consumes: Tasks 1–5 APIs/events and platform purchase bridge.
- Produces: truthful allowance/credit display, restore-purchase flow, Roy/Genie controls/disclosure, approval prompts, and memory CRUD.

- [ ] **Step 1: Write failing Special journey tests**

Verify monthly included seconds and overage credits are separate; no “unlimited” claim; purchase does not unlock before server verification; agent controls wait for disclosure; approval shows exact tool/arguments/recipient; ordinary captions continue after agent timeout; memory proposal requires a separate approval.

- [ ] **Step 2: Run tests**

Run: `flutter test test/features/special/special_flow_test.dart`

Expected: FAIL because Special UI is absent.

- [ ] **Step 3: Implement entitlement/purchase controller**

Send store transaction references to the server, poll/receive verified entitlement, support restore, grace/refund/revoke states, and show included/credit/reserved/consumed values. Never route digital purchases to Opportunity/Web3 checkout.

- [ ] **Step 4: Implement agent and memory controls**

Choose Roy/Genie, intervention level, voice, and session scope. Display agent badge to all participants. Approval sheets expire visibly and default to cancel. Memory screen lists source/scope/expiry and supports edit/delete/export.

- [ ] **Step 5: Run Flutter checks**

Run: `flutter analyze && flutter test`

Expected: PASS for both flavors, purchase lifecycle, accessibility, agent fallback, approval expiry, and memory deletion.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/apps/mobile/lib/features/special ChinguMe/apps/mobile/test/features/special
git commit -m "feat: add Special and managed agent UX"
```

### Task 7: Agent Security and Fallback Release Gate

**Files:**
- Create: `security/agent/red-team.jsonl`
- Create: `services/agent-manager/test/security/agent-red-team.spec.ts`
- Create: `services/agent-manager/test/special-call.e2e-spec.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: every Plan 6 component.
- Produces: cross-member, prompt-injection, tool-abuse, metering, and fallback release evidence.

- [ ] **Step 1: Add synthetic adversarial fixtures**

Cover prompt exfiltration, fake system messages, encoded tool names, cross-conversation references, memory poisoning, approval replay, gateway credential requests, payment/file/web requests, massive output, timeout, disconnect, and entitlement revoke.

- [ ] **Step 2: Add complete translated-call journey**

Activate Special, reserve minutes, disclose Genie, run Plan 3 captions, request culture explanation, propose/approve/delete one memory, inject Gateway outage, settle actual seconds, and prove captions/original audio remain usable.

- [ ] **Step 3: Run release verification**

```bash
npm --workspace @chingume/agent-manager test
npm --workspace @chingume/core-api test -- special
cd apps/mobile
flutter test test/features/special
```

Expected: all commands exit 0; no denied tool executes and no member observes another member's session/memory/usage.

- [ ] **Step 4: Document operator controls**

Document persona/tool version rollout, Gateway secret rotation, session termination, emergency global agent disable, entitlement reconciliation, usage disputes, memory deletion verification, and fallback monitoring.

- [ ] **Step 5: Commit**

```bash
git add ChinguMe/security/agent ChinguMe/services/agent-manager/test ChinguMe/.github/workflows/ci.yml ChinguMe/README.md
git commit -m "test: gate Special agent isolation and fallback"
```

---

## Plan Acceptance Gate

- [ ] Store-verified entitlement and append-only usage ledger resist duplicate/refund/concurrency errors.
- [ ] Friends and Dating share entitlement but not conversation context or memory by default.
- [ ] Roy/Genie persona, disclosure, intervention, voice, and tool-policy versions are explicit.
- [ ] Cross-member/session/surface access fails before the OpenClaw Gateway call.
- [ ] Denied or unapproved external tools never execute; approvals are exact, expiring, and single-use.
- [ ] Summary and memory honor unanimous/item-level consent, CRUD, export, expiry, and deletion.
- [ ] Gateway/agent failure leaves Plan 3 translation and original call operational.
- [ ] Agent red-team, metering, API, Flutter, and CI checks pass.
