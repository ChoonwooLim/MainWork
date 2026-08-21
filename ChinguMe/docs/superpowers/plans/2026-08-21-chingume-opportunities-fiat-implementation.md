# ChinguMe Opportunities, Contracts, and Fiat Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable verified adults in Friends to publish compliant work opportunities, apply/interview, sign milestone contracts, and settle real-world services through a licensed fiat/escrow provider without exposing Dating or casual social data.

**Architecture:** Opportunities uses a separate work profile, search document, authorization policy, conversation purpose, contract aggregate, evidence area, and double-entry settlement ledger. Domain code owns contract/payment state while a licensed provider adapter moves funds and sends authenticated idempotent webhooks. Local Buddy is non-commercial; paid guiding requires the Professional Guide class and country eligibility.

**Tech Stack:** NestJS core API, PostgreSQL 18.4, OpenSearch-compatible listing search port, object portfolio/evidence storage, e-signature and licensed payment/escrow ports with local fakes, Flutter Friends-only Opportunities UI, admin dispute queue.

**Spec:** `docs/superpowers/specs/2026-08-21-chingume-global-platform-design.md`

**Additional Spec:** `docs/superpowers/specs/2026-08-21-chingume-profile-showcase-discovery-design.md`

## Global Constraints

- Opportunities exists only in Friends and is 18+; Dating profiles, intentions, recommendations, and conversations are never queryable here.
- Work profiles are independent of casual Friends profiles and expose only user-selected professional fields.
- Opportunities may expose a work-only image/video showcase through Friends search/shorts, but it cannot reuse or leak casual Friends/Dating showcase media or personalization.
- Local Buddy is unpaid/non-commercial; paid tourism/interpretation routes to Professional Guide and requires country/role eligibility.
- Sexual services, date-for-pay, adult content, unsafe private casting, advance-fee scams, pyramid schemes, illegal employment, impersonation, and off-platform-payment coercion are prohibited.
- Casting requires location, clothing/exposure level, use media, portrait-rights term, compensation, guardian-free adult status, and safety-contact/production details.
- Contract explicitly records scope, deliverables, schedule, milestones, amount/currency, revisions, IP/license, cancellation/refund, and evidence rules.
- ChinguMe does not custody fiat funds; licensed provider/escrow moves money and authenticated webhooks drive the owned ledger.
- Service settlement is separate from Special/AI/boost digital-purchase accounting.
- Every payment command and webhook is idempotent; ledger history is append-only.
- Every task follows red-green-refactor and ends with a focused commit.

---

## File Structure

```text
ChinguMe/
├── services/core-api/migrations/007_opportunities.sql
├── services/core-api/src/modules/opportunities/
├── services/core-api/src/modules/contracts/
├── services/core-api/src/modules/settlement/
├── services/core-api/src/modules/disputes/
├── apps/mobile/lib/features/opportunities/
├── apps/admin/src/opportunities/
└── opportunities/fixtures/policy/
```

## Stable Interfaces

```typescript
export type OpportunityKind = "local_buddy" | "professional_guide" | "freelance" | "casting" | "job" | "collaboration";
export type ContractState = "draft" | "offered" | "accepted" | "funding_pending" | "active" | "completed" | "cancelled" | "disputed";
export interface EscrowProvider {
  createFunding(input: { contractId: string; milestoneId: string; payerRef: string; amountMinor: bigint; currency: string; idempotencyKey: string; returnUrl: string }): Promise<{ providerPaymentRef: string; action: "redirect" | "none"; redirectUrl?: string }>;
  release(input: { providerPaymentRef: string; payeeRef: string; amountMinor: bigint; idempotencyKey: string }): Promise<{ providerTransferRef: string }>;
  refund(input: { providerPaymentRef: string; amountMinor: bigint; idempotencyKey: string }): Promise<{ providerRefundRef: string }>;
  verifyWebhook(headers: Record<string,string>, rawBody: Uint8Array): Promise<ProviderSettlementEvent>;
}
```

---

### Task 1: Separate Work Profiles and Compliant Listings

**Files:**
- Create: `services/core-api/migrations/007_opportunities.sql`
- Create: `services/core-api/src/modules/opportunities/domain/work-profile.ts`
- Create: `services/core-api/src/modules/opportunities/domain/listing.ts`
- Create: `services/core-api/src/modules/opportunities/application/listing-policy.ts`
- Create: `services/core-api/src/modules/opportunities/adapters/http/opportunity.controller.ts`
- Test: `services/core-api/test/opportunities-listing.e2e-spec.ts`

**Interfaces:**
- Consumes: verified adult, Friends surface authorization, safety eligibility, clean portfolio media, country capability hook.
- Produces: work profile and listing states `draft|review_pending|published|paused|filled|rejected|closed`.

- [ ] **Step 1: Write failing separation and policy tests**

Assert Dating tokens/routes cannot list Opportunities; work-profile output excludes social/Dating fields; paid `local_buddy` fails; Professional Guide without eligibility fails; casting missing any mandated field fails; prohibited phrases/actions enter rejection or human review with reason codes.

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/core-api test -- opportunities-listing.e2e-spec.ts`

Expected: FAIL because Opportunities modules are absent.

- [ ] **Step 3: Implement work profile and portfolio**

Fields: professional display name, bio, skills, languages, coarse service regions, remote/on-site, experience, credentials/references, rate range, availability, verification badges, one work hero image, up to six work gallery images, and an optional 15–60 second work-introduction video. Portfolio uses Plan 2 clean media, Plan 3 approved captions, Plan 5 public-release decisions, and explicit visibility/copyright/portrait-rights attestations. Casual Friends and Dating showcase IDs are rejected.

- [ ] **Step 4: Implement per-kind required listing schemas**

Common: deliverable, schedule, budget/currency, location/remote, language, requester verification, IP, revision, cancellation/refund. Add guide licensing/coverage; freelance skills; casting production/safety/rights/exposure; job employment type/eligibility; collaboration ownership/compensation. Store policy version and validation results.

- [ ] **Step 5: Run migration/policy tests**

Run: `npm --workspace @chingume/core-api test -- opportunities-listing migration.integration.spec.ts`

Expected: PASS for six kinds, draft/review/publish, portfolio permissions, unsafe casting, scam phrases, eligibility, and surface isolation.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/migrations/007_opportunities.sql ChinguMe/services/core-api/src/modules/opportunities ChinguMe/services/core-api/test/opportunities-listing.e2e-spec.ts
git commit -m "feat: add compliant Opportunities listings"
```

### Task 2: Search, Applications, and Translated Interviews

**Files:**
- Create: `services/core-api/src/modules/opportunities/application/listing-search.ts`
- Create: `services/core-api/src/modules/opportunities/domain/application.ts`
- Create: `services/core-api/src/modules/opportunities/application/application.service.ts`
- Create: `services/core-api/src/modules/opportunities/adapters/local/postgres-listing-search.ts`
- Test: `services/core-api/test/opportunity-application.e2e-spec.ts`

**Interfaces:**
- Consumes: published listings, work profiles, safety eligibility, Plan 2 purpose-bound conversation/calls, Plan 3 translation.
- Produces: explainable listing/candidate `search|shorts` discovery, `opportunity_inquiry|opportunity_application` states, and interview conversation/call authorization.

- [ ] **Step 1: Write failing authorization/search tests**

Verify search filters by kind, skill, language, coarse region, budget, schedule, remote, and verification; work shorts use only published work showcase video; hides blocked/rejected/unsafe listings and providers; returns reason codes; prevents owner self-application and duplicate active applications; hides unrelated social/Dating conversations and showcase signals.

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/core-api test -- opportunity-application.e2e-spec.ts`

Expected: FAIL because application/search services are absent.

- [ ] **Step 3: Implement application lifecycle**

States: `submitted|shortlisted|interview|offered|accepted|withdrawn|rejected|closed`. Application contains selected work-profile snapshot, proposal, availability, quote, and clean attachments; owner and applicant see only policy-authorized fields.

- [ ] **Step 4: Implement purpose-bound communication**

Create `opportunity_inquiry` or `opportunity_application` conversations with work profile/listing/application references, not casual relationship activation. Reuse Plan 2 messaging/files/calls, Plan 3 translation, and Plan 5 warnings/reporting. Closing/rejecting an inquiry/application removes the work candidate from the viewer's search/shorts session, revokes new calls, and preserves retention-policy evidence.

- [ ] **Step 5: Run search/application tests**

Run: `npm --workspace @chingume/core-api test -- opportunity-application.e2e-spec.ts recommendations.property.spec.ts`

Expected: PASS for pagination, explanations, block/safety recheck, translated interview grant, rejection, withdrawal, and no Dating/social leakage.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/src/modules/opportunities ChinguMe/services/core-api/test/opportunity-application.e2e-spec.ts
git commit -m "feat: add Opportunity applications and interviews"
```

### Task 3: Versioned Contracts, Signatures, and Milestones

**Files:**
- Create: `services/core-api/src/modules/contracts/domain/contract.ts`
- Create: `services/core-api/src/modules/contracts/application/contract.service.ts`
- Create: `services/core-api/src/modules/contracts/application/signature-provider.ts`
- Create: `services/core-api/src/modules/contracts/adapters/local/local-signature.provider.ts`
- Test: `services/core-api/test/contracts.e2e-spec.ts`

**Interfaces:**
- Consumes: accepted application, both verified parties, listing/work snapshots.
- Produces: immutable contract versions, signature receipts, milestones, delivery/approval windows, and `ContractState`.

- [ ] **Step 1: Write failing contract invariants**

Assert total milestone amounts equal contract total; currency cannot change after offer; both parties sign the exact canonical hash; any scope/IP/milestone change creates a new version and invalidates signatures; funding cannot start before acceptance.

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/core-api test -- contracts.e2e-spec.ts`

Expected: FAIL because contract aggregate is absent.

- [ ] **Step 3: Implement canonical contract document**

Canonical JSON includes parties, listing/application snapshots, scope/deliverables, schedule, each milestone amount/due/acceptance, revision count, IP/license/portrait rights, confidentiality, cancellation/refund, dispute venue/process, evidence/retention, and policy version. Hash using SHA-256 over RFC 8785-style canonical JSON.

- [ ] **Step 4: Implement local signature and version rules**

Local provider returns a signed fixture receipt bound to party, contract/version/hash, timestamp, and intent statement only in local/test. Store provider receipt reference, verification outcome, and minimal certificate metadata—not raw identity documents.

- [ ] **Step 5: Run lifecycle tests**

Run: `npm --workspace @chingume/core-api test -- contracts.e2e-spec.ts --runInBand`

Expected: PASS for offer, counter-version, dual acceptance, milestone validation, cancellation, signature mismatch, duplicate callbacks, and authorization.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/src/modules/contracts ChinguMe/services/core-api/test/contracts.e2e-spec.ts
git commit -m "feat: add versioned Opportunity contracts"
```

### Task 4: Licensed Fiat/Escrow Adapter and Double-Entry Ledger

**Files:**
- Create: `services/core-api/src/modules/settlement/domain/ledger.ts`
- Create: `services/core-api/src/modules/settlement/application/escrow-provider.ts`
- Create: `services/core-api/src/modules/settlement/application/settlement.service.ts`
- Create: `services/core-api/src/modules/settlement/adapters/local/local-escrow.provider.ts`
- Create: `services/core-api/src/modules/settlement/adapters/http/settlement-webhook.controller.ts`
- Test: `services/core-api/test/settlement.e2e-spec.ts`

**Interfaces:**
- Consumes: accepted contract/milestone, payer/payee provider references, licensed-provider webhook.
- Produces: funding/release/refund state, balanced ledger batches, and reconciliation records.

- [ ] **Step 1: Write failing money/idempotency tests**

```typescript
await fund(milestone, { amountMinor: 100000n, currency: "KRW", key: "fund-1" });
await deliverWebhook(fundedEvent, "event-1");
await deliverWebhook(fundedEvent, "event-1");
expect(await ledgerSumForBatch("event-1")).toBe(0n);
expect(await providerEventCount("event-1")).toBe(1);
```

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/core-api test -- settlement.e2e-spec.ts`

Expected: FAIL because settlement is absent.

- [ ] **Step 3: Implement owned state and double-entry batches**

Milestone funding states: `unfunded|funding_pending|funded|release_pending|released|refund_pending|refunded|disputed|failed`. Every provider event posts a zero-sum batch between control accounts; use integer minor units, ISO currency, immutable entries, unique provider event/command IDs, and no floating point.

- [ ] **Step 4: Implement authenticated webhook processing**

Read raw body, verify signature/timestamp before parsing, reject replay outside provider tolerance, store event hash, acknowledge duplicates idempotently, and enqueue state transition after persistence. A mobile redirect never marks funds successful.

- [ ] **Step 5: Run provider contracts/reconciliation**

Run: `npm --workspace @chingume/core-api test -- settlement.e2e-spec.ts --runInBand`

Expected: PASS for amount/currency mismatch, duplicate/out-of-order events, timeout, refund, release, webhook forgery, balanced ledger, daily reconciliation, and strict separation from digital entitlements.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/src/modules/settlement ChinguMe/services/core-api/test/settlement.e2e-spec.ts
git commit -m "feat: add licensed fiat escrow settlement"
```

### Task 5: Delivery Evidence, Approval, and Disputes

**Files:**
- Create: `services/core-api/src/modules/disputes/domain/dispute.ts`
- Create: `services/core-api/src/modules/disputes/application/delivery.service.ts`
- Create: `services/core-api/src/modules/disputes/application/dispute.service.ts`
- Create: `apps/admin/src/opportunities/dispute-queue.tsx`
- Create: `apps/admin/src/opportunities/dispute-detail.tsx`
- Test: `services/core-api/test/disputes.e2e-spec.ts`
- Test: `apps/admin/src/opportunities/dispute-detail.test.tsx`

**Interfaces:**
- Consumes: active contract/funded milestone, clean delivery media, evidence vault, settlement hold/release/refund.
- Produces: delivery revisions, approval/rejection, dispute case, proposed resolution, and settlement command.

- [ ] **Step 1: Write failing delivery/dispute tests**

Assert provider cannot deliver before funding; requester approval releases once; rejection requires contract-based reason; either party can dispute; disputed funds cannot release; reviewer cannot view Dating/social history; resolution amounts sum to funded amount.

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/core-api test -- disputes.e2e-spec.ts && npm --workspace @chingume/admin test -- dispute-detail.test.tsx`

Expected: FAIL because dispute workflow is absent.

- [ ] **Step 3: Implement delivery and evidence rules**

Store revision, artifact refs/hashes, submission time, notes, and acceptance criteria mapping. Snapshot only contract/application/payment/delivery communications selected by dispute policy into the separate evidence vault.

- [ ] **Step 4: Implement dispute states and reviewer UI**

States: `opened|response_due|under_review|resolution_proposed|resolved|appealed|closed`. Resolution supports full release, full refund, split, redo/extension, or nonfinancial outcome; financial splits use integer minor units and require senior approval over configurable threshold.

- [ ] **Step 5: Run tests**

Run: `npm --workspace @chingume/core-api test -- disputes settlement && npm --workspace @chingume/admin test`

Expected: PASS for deadlines, evidence access, duplicate decision, appeal, split arithmetic, settlement failure retry, and audit log.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/src/modules/disputes ChinguMe/services/core-api/test/disputes.e2e-spec.ts ChinguMe/apps/admin/src/opportunities
git commit -m "feat: add delivery and Opportunity disputes"
```

### Task 6: Friends Mobile Opportunities Vertical Slice

**Files:**
- Create: `apps/mobile/lib/features/opportunities/domain/work_profile.dart`
- Create: `apps/mobile/lib/features/opportunities/domain/opportunity_listing.dart`
- Create: `apps/mobile/lib/features/opportunities/domain/opportunity_contract.dart`
- Create: `apps/mobile/lib/features/opportunities/data/opportunities_api.dart`
- Create: `apps/mobile/lib/features/opportunities/application/opportunities_controller.dart`
- Create: `apps/mobile/lib/features/opportunities/application/settlement_controller.dart`
- Create: `apps/mobile/lib/features/opportunities/presentation/opportunities_home_screen.dart`
- Create: `apps/mobile/lib/features/opportunities/presentation/work_showcase_editor_screen.dart`
- Create: `apps/mobile/lib/features/opportunities/presentation/listing_editor_screen.dart`
- Create: `apps/mobile/lib/features/opportunities/presentation/contract_screen.dart`
- Create: `apps/mobile/lib/features/opportunities/presentation/delivery_dispute_screen.dart`
- Test: `apps/mobile/test/features/opportunities/opportunity_flow_test.dart`
- Test: `apps/mobile/test/features/opportunities/dating_absence_test.dart`

**Interfaces:**
- Consumes: Tasks 1–5 and Plans 2/3/5.
- Produces: Friends-only work profile, listing/search/application/interview/contract/funding/delivery/dispute screens.

- [ ] **Step 1: Write failing product-boundary tests**

Verify Friends shows Opportunities after adult verification; Dating has no tab, route, deep-link resolution, search/shorts index, or notification content. Verify work-only hero/gallery/15–60 second video editing, equal work search/shorts entry, captions, full work profile, and inquiry/application action. Paid Local Buddy is rejected; casting form requires all safety/rights fields; checkout labels provider/amount/currency and does not mark funded on redirect.

- [ ] **Step 2: Run tests**

Run: `flutter test test/features/opportunities`

Expected: FAIL because Opportunities UI is absent.

- [ ] **Step 3: Implement listing/application/contract journeys**

Use per-kind typed forms, policy reason display, work-only profile/showcase selection, translated captions/messaging/interview, equal search/shorts discovery, canonical contract diff, dual signature status, milestone timeline, and clean file uploads. Work shorts default muted and never display social/Dating interests, relationship intent, popularity, or appearance score.

- [ ] **Step 4: Implement settlement/delivery/dispute UX**

Show fiat amount, fees, provider, status source, refund/cancellation rules, and external licensed checkout. Poll/subscribe to server-verified status, support delivery approval/rejection, preserve dispute evidence, and link safety report/block.

- [ ] **Step 5: Run Flutter checks**

Run: `flutter analyze && flutter test`

Expected: PASS for Friends, explicit Dating absence, accessibility, offline idempotency, and webhook-delayed status.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/apps/mobile/lib/features/opportunities ChinguMe/apps/mobile/test/features/opportunities
git commit -m "feat: add Friends Opportunities experience"
```

### Task 7: Marketplace Separation, Safety, and Accounting Gate

**Files:**
- Create: `opportunities/fixtures/policy/listings.jsonl`
- Create: `services/core-api/test/opportunities-full-flow.e2e-spec.ts`
- Create: `services/core-api/test/contracts/ledger-separation.contract.spec.ts`
- Create: `scripts/check-opportunity-boundaries.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: all Plan 7 modules.
- Produces: full fake-escrow journey, prohibited-listing red team, and static/runtime data/accounting boundary proof.

- [ ] **Step 1: Add full vertical-slice test**

Create compliant requester/provider work profiles, publish a freelance listing, apply, translated interview, accept/hash/sign contract, fund via fake escrow webhook, deliver, approve/release, then repeat a second milestone into dispute/refund. Assert balanced batches throughout.

- [ ] **Step 2: Add policy and boundary tests**

Fixture every prohibited category plus benign hard negatives. Reject imports/DTO/index keys and media references from Dating or casual Friends showcases in Opportunities. Assert digital subscription/credit ledger accounts and settlement ledger accounts/events/providers never cross.

- [ ] **Step 3: Run release verification**

```bash
npm run check:opportunity-boundaries
npm run verify
npm --workspace @chingume/admin test
cd apps/mobile
flutter test test/features/opportunities
```

Expected: all commands exit 0 and every ledger batch sums to zero.

- [ ] **Step 4: Document operations**

Document listing review, guide/casting verification, provider onboarding, webhook keys/rotation, reconciliation, stuck payment recovery, delivery/dispute handling, prohibited listing escalation, refund authority, and Friends-only support boundaries.

- [ ] **Step 5: Commit**

```bash
git add ChinguMe/opportunities/fixtures ChinguMe/services/core-api/test/opportunities-full-flow.e2e-spec.ts ChinguMe/services/core-api/test/contracts/ledger-separation.contract.spec.ts ChinguMe/scripts/check-opportunity-boundaries.mjs ChinguMe/.github/workflows/ci.yml ChinguMe/README.md ChinguMe/package.json
git commit -m "test: gate Opportunities contracts and fiat settlement"
```

---

## Plan Acceptance Gate

- [ ] Opportunities appears only in Friends and uses a work profile/search/conversation boundary.
- [ ] Work search/shorts use only approved work showcase media and cannot read casual Friends/Dating profile, media, or personalization fields.
- [ ] Work inquiry/application conversations never activate a Friends or Dating relationship.
- [ ] All six listing classes enforce exact common/special fields and prohibited-content policy.
- [ ] Local Buddy cannot be paid; Professional Guide obeys country/role eligibility.
- [ ] Applications/interviews reuse translation/safety without activating a social/Dating relationship.
- [ ] Contract versions, hashes, signatures, milestone sums, IP, cancellation, and evidence are explicit.
- [ ] Licensed-provider webhooks—not redirects—drive balanced idempotent settlement state.
- [ ] Delivery/dispute/appeal can hold, release, refund, or split without losing audit evidence.
- [ ] Full-flow, policy red-team, boundary, accounting, admin, Flutter, and CI gates pass.
