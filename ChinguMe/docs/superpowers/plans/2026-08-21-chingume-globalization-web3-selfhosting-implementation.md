# ChinguMe Globalization, Web3, and Partial Self-Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch truthful 25-language/country-gated capabilities, add optional non-custodial stablecoin settlement for eligible real-world Opportunities services, and prove managed media/AI components can be replaced without changing mobile or domain contracts.

**Architecture:** A signed release catalog combines language-modality quality, UI/support readiness, and country legal/payment/safety approvals into fail-closed server gates consumed by both apps. Wallet ownership is proven by a one-time domain-bound signature; licensed processor/risk adapters handle quotes, screening, payment, refund, and settlement while ChinguMe never receives private keys or seed phrases. A replayable benchmark harness tests managed and self-hosted providers against the same Plan 2/3 ports before regional canary migration.

**Tech Stack:** Existing Flutter/NestJS/PostgreSQL stack, ICU/ARB localization, signed configuration catalog, WalletConnect-compatible external-wallet port, CAIP-style chain/account identifiers, licensed crypto payment/risk provider ports, Kubernetes/Terraform deployment manifests, SFU/TURN and ASR/MT/TTS provider contracts, k6-style load/replay harness, OpenTelemetry.

**Spec:** `docs/superpowers/specs/2026-08-21-chingume-global-platform-design.md`

## Global Constraints

- Beta languages are Korean, English, Japanese, Simplified Chinese, and Spanish; global v1 reports actual capability for all 25 approved languages per UI, ASR, MT, TTS, safety, and support modality.
- A country is enabled only when privacy, communications, Dating, UGC, employment/marketplace, payments, virtual assets, safety operations, app-store, and support gates are approved.
- Unsupported country/language/modality/asset/network combinations fail closed and user copy names what remains available.
- Web3 applies only to eligible real-world person-to-person Opportunities service settlement after country approval.
- Special subscription, AI credits, boosts, and other digital features never use Web3/service-settlement checkout to bypass app-store billing.
- Wallets are external/non-custodial; ChinguMe never requests, transmits, logs, stores, backs up, or recovers a seed phrase/private key.
- Approved stablecoins and networks come from signed remote policy; no ChinguMe token, ICO, investment return, mining, exchange, or speculative promotion.
- Fiat/card/account alternatives remain available whenever a service checkout is offered.
- Provider replacement preserves Plan 2 Media and Plan 3 translation contracts, session IDs, consent, authorization, quality, cost, and degradation semantics.
- Every task follows red-green-refactor and ends with a focused commit.

---

## File Structure

```text
ChinguMe/
├── config/global/{languages.v1.json,countries.v1.json,assets.v1.json}
├── apps/mobile/lib/l10n/
├── services/core-api/migrations/008_global_web3.sql
├── services/core-api/src/modules/{capabilities,country-gates,wallets,crypto-settlement}/
├── services/benchmark-harness/src/{media,translation,replay,report}/
├── infra/{regional,self-hosted,runbooks}/
├── quality/global/
└── services/core-api/test/{global-capabilities,wallet,crypto-settlement}.*.spec.ts
```

## Stable Interfaces

```typescript
export interface FeatureCapability {
  locale: string;
  ui: "supported" | "fallback" | "unavailable";
  asr: "ga" | "beta" | "unavailable";
  mt: "ga" | "beta" | "unavailable";
  tts: "ga" | "beta" | "unavailable";
  safetyLexicon: "ready" | "limited" | "unavailable";
  customerSupport: "native" | "translated" | "unavailable";
  measuredAt: string;
  catalogVersion: string;
}
export interface CountryGateDecision { country: string; feature: string; enabled: boolean; reasonCodes: string[]; policyVersion: string; }
export interface CryptoPaymentProcessor {
  quote(input: { contractId: string; milestoneId: string; payerAccount: string; payeeCountry: string; assetId: string; networkId: string; fiatAmountMinor: bigint; fiatCurrency: string }): Promise<CryptoQuote>;
  createPayment(input: { quoteId: string; walletAccount: string; idempotencyKey: string }): Promise<{ processorPaymentRef: string; walletRequest: unknown; expiresAt: Date }>;
  verifyWebhook(headers: Record<string,string>, rawBody: Uint8Array): Promise<CryptoSettlementEvent>;
  refund(input: { processorPaymentRef: string; amountMinor: bigint; idempotencyKey: string }): Promise<{ processorRefundRef: string }>;
}
```

---

### Task 1: Twenty-Five-Language Capability and Localization Catalog

**Files:**
- Create: `config/global/languages.v1.json`
- Create: `quality/global/language-capability.schema.json`
- Create: `services/core-api/src/modules/capabilities/application/capability-catalog.ts`
- Create: `services/core-api/src/modules/capabilities/adapters/http/capability.controller.ts`
- Create: `apps/mobile/lib/l10n/app_ko.arb`
- Create: `apps/mobile/lib/l10n/app_en.arb`
- Test: `services/core-api/test/global-capabilities.spec.ts`
- Test: `apps/mobile/test/l10n/localization_contract_test.dart`

**Interfaces:**
- Consumes: Plan 3 measured provider/language quality and localization/support readiness evidence.
- Produces: signed/versioned `FeatureCapability[]`, locale resolution, and `/v1/capabilities?locale=&country=`.

- [ ] **Step 1: Write failing exact-language tests**

Assert catalog entries for `ko,en,ja,zh-Hans,zh-Hant,es,fr,de,pt,it,ru,ar,hi,id,vi,th,fil,ms,tr,nl,pl,uk,mn,uz,ne,km`; Chinese variants are separate entries while the product count follows the approved 25-language convention. Assert every entry explicitly declares six readiness dimensions and evidence timestamps.

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/core-api test -- global-capabilities.spec.ts && flutter test test/l10n/localization_contract_test.dart`

Expected: FAIL because capability/localization catalogs are absent.

- [ ] **Step 3: Implement signed catalog loading**

Validate JSON schema, canonical hash, signature, version monotonicity, timestamps, and allowed enum values at startup. Invalid/expired signature keeps the last-known-good catalog; if none exists, expose only configured safe beta capabilities and emit a critical operational alert.

- [ ] **Step 4: Implement locale and truthful-copy rules**

Resolve exact locale, language fallback, then English; surface fallback visibly for legal/safety copy. Server capability—not app strings—controls whether text/captions/voice buttons are enabled. `unavailable` must never be rendered as generic “25개 언어 지원”.

- [ ] **Step 5: Expand ARB contracts incrementally**

Require identical message keys, ICU placeholders, plural/select shapes, semantic labels, legal/safety key review, and no untranslated critical key before a locale's UI status becomes `supported`. Machine-assisted drafts remain `fallback` until human review evidence is attached.

- [ ] **Step 6: Run catalog/localization verification**

Run: `npm run check:global-catalog && npm --workspace @chingume/core-api test -- global-capabilities && cd apps/mobile && flutter gen-l10n && flutter analyze && flutter test test/l10n`

Expected: all commands exit 0; beta five are complete and remaining entries report precise staged status.

- [ ] **Step 7: Commit**

```bash
git add ChinguMe/config/global/languages.v1.json ChinguMe/quality/global/language-capability.schema.json ChinguMe/services/core-api/src/modules/capabilities ChinguMe/services/core-api/test/global-capabilities.spec.ts ChinguMe/apps/mobile/lib/l10n ChinguMe/apps/mobile/test/l10n ChinguMe/package.json
git commit -m "feat: add truthful 25-language capability catalog"
```

### Task 2: Country Launch Gates and Remote Feature Enforcement

**Files:**
- Create: `config/global/countries.v1.json`
- Create: `services/core-api/src/modules/country-gates/domain/country-readiness.ts`
- Create: `services/core-api/src/modules/country-gates/application/country-gate.service.ts`
- Create: `services/core-api/src/modules/country-gates/adapters/http/country-gate.controller.ts`
- Test: `services/core-api/test/country-gates.property.spec.ts`

**Interfaces:**
- Consumes: signed country approvals and request/account/store/billing country signals.
- Produces: `CountryGateDecision`, effective-country conflict handling, emergency disable, and audit history.

- [ ] **Step 1: Write failing country matrix tests**

Cover the 25 candidates: Korea, US, Canada, UK, Australia, Japan, China, Taiwan, Singapore, Spain, Mexico, Brazil, France, Germany, Italy, UAE, India, Indonesia, Vietnam, Thailand, Philippines, Malaysia, Türkiye, Mongolia, Uzbekistan. Each needs named readiness states for ten legal/operational domains.

- [ ] **Step 2: Run property tests**

Run: `npm --workspace @chingume/core-api test -- country-gates.property.spec.ts`

Expected: FAIL because country gates are absent.

- [ ] **Step 3: Implement fail-closed decision evaluation**

Use effective country from verified account residency/service location/store/payment evidence with policy-defined conflict review; never trust a client country parameter alone. A feature is enabled only when every required gate is `approved` and catalog signature/version are valid. Return safe reason codes, not legal-review details.

- [ ] **Step 4: Implement emergency kill switches**

Support global/country/feature/provider/asset/network disables signed by two authorized operator roles, effective within five minutes, with expiry/review time and append-only audit. Previously created contracts remain viewable; new prohibited actions fail closed and settlement operations follow legal/provider recovery policy.

- [ ] **Step 5: Run generated combinations**

Run: `npm --workspace @chingume/core-api test -- country-gates.property.spec.ts --runInBand`

Expected: PASS for all feature/country combinations, conflicting country signals, stale/invalid catalog, emergency disable/expiry, and user-facing alternatives.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/config/global/countries.v1.json ChinguMe/services/core-api/src/modules/country-gates ChinguMe/services/core-api/test/country-gates.property.spec.ts
git commit -m "feat: enforce country launch gates"
```

### Task 3: Non-Custodial Wallet Connection and Ownership Proof

**Files:**
- Create: `services/core-api/migrations/008_global_web3.sql`
- Create: `services/core-api/src/modules/wallets/domain/wallet-connection.ts`
- Create: `services/core-api/src/modules/wallets/application/wallet.service.ts`
- Create: `services/core-api/src/modules/wallets/application/signature-verifier.ts`
- Create: `services/core-api/src/modules/wallets/adapters/local/local-signature.verifier.ts`
- Create: `services/core-api/src/modules/wallets/adapters/http/wallet.controller.ts`
- Test: `services/core-api/test/wallet.e2e-spec.ts`

**Interfaces:**
- Consumes: verified member, country gate, allowed network, external wallet address/signature.
- Produces: challenge, verified CAIP-style account binding, disconnect/revoke, and zero key-custody proof.

- [ ] **Step 1: Write failing replay/domain-binding tests**

```typescript
const challenge = await startWalletChallenge(memberId, "eip155:1:0x1111111111111111111111111111111111111111");
await verifyWallet({ challengeId: challenge.id, signature: validFixture }).expect(201);
await verifyWallet({ challengeId: challenge.id, signature: validFixture }).expect(409);
await verifyOnOtherDomain(validFixture).expect(401);
```

Scan every request/DTO/log schema for fields matching `privateKey|seed|mnemonic|recoveryPhrase`; server must reject such fields with a safety warning and never echo the value.

- [ ] **Step 2: Run wallet tests**

Run: `npm --workspace @chingume/core-api test -- wallet.e2e-spec.ts`

Expected: FAIL because wallet connections are absent.

- [ ] **Step 3: Implement one-time challenge**

Challenge contains domain, URI, account, chain/network, nonce, issued/expiry (five minutes), request ID, human statement, and member/session binding. Store nonce hash, consume atomically, verify chain-aware signature and address normalization, and prevent the same account from silently binding to another member.

- [ ] **Step 4: Minimize wallet records**

Persist member, normalized public account, network, verification method, risk-status reference, timestamps, and revoked state. Do not store balances, unrelated assets, full transaction history, wallet contacts, private material, or recovery secrets.

- [ ] **Step 5: Run migration/security tests**

Run: `npm --workspace @chingume/core-api test -- wallet migration.integration.spec.ts && npm run check:private-key-fields`

Expected: PASS for replay, expiry, wrong domain/member/chain, malformed signature, duplicate account, country/network disable, disconnect, logs, and database minimization.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/migrations/008_global_web3.sql ChinguMe/services/core-api/src/modules/wallets ChinguMe/services/core-api/test/wallet.e2e-spec.ts ChinguMe/scripts ChinguMe/package.json
git commit -m "feat: connect non-custodial wallets safely"
```

### Task 4: Stablecoin Quote, Risk Screening, and Licensed Processing

**Files:**
- Create: `config/global/assets.v1.json`
- Create: `services/core-api/src/modules/crypto-settlement/domain/crypto-quote.ts`
- Create: `services/core-api/src/modules/crypto-settlement/application/crypto-payment-processor.ts`
- Create: `services/core-api/src/modules/crypto-settlement/application/wallet-risk-provider.ts`
- Create: `services/core-api/src/modules/crypto-settlement/application/crypto-settlement.service.ts`
- Create: `services/core-api/src/modules/crypto-settlement/adapters/local/local-crypto-processor.ts`
- Create: `services/core-api/src/modules/crypto-settlement/adapters/local/local-wallet-risk.provider.ts`
- Test: `services/core-api/test/crypto-settlement.e2e-spec.ts`

**Interfaces:**
- Consumes: active Plan 7 contract/milestone, verified wallet, allowed asset/network/countries, licensed processor and wallet-risk decisions.
- Produces: expiring quote, wallet request, processor-webhook-driven settlement, risk hold, refund, and Plan 7 balanced ledger postings.

- [ ] **Step 1: Write failing eligibility/quote tests**

Assert digital products fail with `SETTLEMENT_RAIL_NOT_ALLOWED`; unsupported country/asset/network fail closed; risk-blocked wallet cannot quote/pay; quote displays fiat amount, stablecoin amount/decimals, rate source/time, network fee estimate, processor fee, slippage/rounding, expiry, and fiat alternative.

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/core-api test -- crypto-settlement.e2e-spec.ts`

Expected: FAIL because crypto settlement is absent.

- [ ] **Step 3: Implement signed asset/network policy**

Entries use stable IDs, contract address/issuer, decimals, network, processor support, allowed payer/payee countries, min/max, confirmation/finality policy, refund support, and effective dates. Only approved stablecoins; unknown/unverified assets never appear or map by ticker alone.

- [ ] **Step 4: Implement risk and processor contracts**

Normalize screening to `allow|review|deny` with reason category/reference and timestamp. Quote expiry ≤10 minutes. Payment success requires verified processor webhook/finality—not wallet callback or transaction hash from mobile. Reorg/reversal moves to hold/reconciliation, never a silent negative balance.

- [ ] **Step 5: Reuse Plan 7 ledger safely**

Post fiat-denominated control entries plus asset/network/quantity/provider references in settlement metadata. Keep exchange-rate variance/fees in named accounts; every batch sums to zero. Refund through processor policy and show asset/fiat implications before confirmation.

- [ ] **Step 6: Run provider/security/accounting tests**

Run: `npm --workspace @chingume/core-api test -- crypto-settlement ledger-separation --runInBand`

Expected: PASS for duplicate/out-of-order webhooks, forged events, expiry, under/overpayment, wrong asset/network, risk review/deny, finality, reorg hold, refund, and zero-sum batches.

- [ ] **Step 7: Commit**

```bash
git add ChinguMe/config/global/assets.v1.json ChinguMe/services/core-api/src/modules/crypto-settlement ChinguMe/services/core-api/test/crypto-settlement.e2e-spec.ts
git commit -m "feat: add licensed stablecoin service settlement"
```

### Task 5: Mobile Wallet and Strict Checkout Separation

**Files:**
- Create: `apps/mobile/lib/features/wallet/domain/wallet_connection.dart`
- Create: `apps/mobile/lib/features/wallet/data/wallet_api.dart`
- Create: `apps/mobile/lib/features/wallet/application/wallet_controller.dart`
- Create: `apps/mobile/lib/features/wallet/presentation/wallet_screen.dart`
- Create: `apps/mobile/lib/features/opportunities/presentation/settlement_method_screen.dart`
- Test: `apps/mobile/test/features/wallet/wallet_checkout_test.dart`
- Test: `apps/mobile/test/features/special/digital_checkout_separation_test.dart`

**Interfaces:**
- Consumes: Tasks 2–4 and external-wallet deep-link/session bridge.
- Produces: external wallet connect/sign, eligible service quote/payment, fiat fallback, and no digital-product route to wallet.

- [ ] **Step 1: Write failing checkout-separation tests**

Verify seed/private-key input never exists; wallet connection happens in an external wallet; Special/credits/boost screens expose only store billing; an eligible funded Opportunities milestone may offer fiat and approved stablecoin; quote expiry forces refresh; unsupported country displays fiat-only or unavailable reason.

- [ ] **Step 2: Run tests**

Run: `flutter test test/features/wallet test/features/special/digital_checkout_separation_test.dart`

Expected: FAIL because wallet UI is absent.

- [ ] **Step 3: Implement external-wallet connection**

Request server challenge, pass exact human-readable payload to external wallet, return only public account/signature, verify on server, and show connected network/account in abbreviated form. Add prominent instruction never to share seed/recovery phrase; reject pasted private material locally and server-side without analytics.

- [ ] **Step 4: Implement transparent service checkout**

Show contract/milestone, fiat value, asset/network quantity, rate timestamp/expiry, processor/network fees, finality estimate, refund limits, risk-review possibility, and fiat alternative. Deep-link return shows `processing` until authenticated server event confirms state.

- [ ] **Step 5: Run Flutter/security checks**

Run: `flutter analyze && flutter test && rg -n "seed phrase|mnemonic|privateKey" lib test`

Expected: Flutter commands pass; matches occur only in prohibitive safety copy/tests, never input models, persistence, or analytics.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/apps/mobile/lib/features/wallet ChinguMe/apps/mobile/lib/features/opportunities/presentation/settlement_method_screen.dart ChinguMe/apps/mobile/test/features/wallet ChinguMe/apps/mobile/test/features/special/digital_checkout_separation_test.dart
git commit -m "feat: add external-wallet service checkout"
```

### Task 6: Provider-Neutral Media and Translation Benchmark Harness

**Files:**
- Create: `services/benchmark-harness/package.json`
- Create: `services/benchmark-harness/src/replay/session-fixture.ts`
- Create: `services/benchmark-harness/src/media/media-benchmark.ts`
- Create: `services/benchmark-harness/src/translation/translation-benchmark.ts`
- Create: `services/benchmark-harness/src/report/benchmark-report.ts`
- Create: `quality/global/reference-sessions/manifest.json`
- Test: `services/benchmark-harness/test/provider-parity.spec.ts`

**Interfaces:**
- Consumes: Plan 2 `MediaProvider`, Plan 3 ASR/MT/TTS ports, consent-safe synthetic/licensed fixtures.
- Produces: comparable quality/latency/cost/capacity/failure reports and contract-parity result for managed/self-hosted candidates.

- [ ] **Step 1: Write failing parity tests**

Run the same reference session against local managed and local self-host candidates; assert identical authorization, session/event schemas, ordered captions, degraded reason codes, usage events, and no app/domain/provider-specific branching.

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/benchmark-harness test -- provider-parity.spec.ts`

Expected: FAIL because the harness is absent.

- [ ] **Step 3: Implement consent-safe replay**

Manifest references synthetic/licensed audio/video, languages, network impairment profile, participant count, expected semantic checkpoints, safety phrases, and hashes. No production calls, member identifiers, API keys, or report evidence may enter benchmark fixtures.

- [ ] **Step 4: Implement comparable metrics**

Media: join success, time-to-first-media, packet loss/jitter recovery, CPU/bandwidth, regional capacity, reconnect, room close. Translation: ASR WER/CER, MT human rubric export, TTS intelligibility rating export, caption/TTS p50/p95, ordered revisions, cost/minute, circuit/fallback behavior.

- [ ] **Step 5: Implement pass criteria**

Candidate must pass owned contract tests, security/consent/degradation equivalence, target latency/quality, configured headroom, and cost model. Report marks `pass|conditional|fail` with metric evidence; it cannot promote/deploy automatically.

- [ ] **Step 6: Run local benchmark**

Run: `npm --workspace @chingume/benchmark-harness run benchmark -- --suite reference --providers local-managed,local-selfhost --output artifacts/provider-parity.json`

Expected: exit 0 and both local fixtures pass schema/contract parity.

- [ ] **Step 7: Commit**

```bash
git add ChinguMe/services/benchmark-harness ChinguMe/quality/global/reference-sessions ChinguMe/package.json ChinguMe/package-lock.json
git commit -m "test: benchmark replaceable media and translation providers"
```

### Task 7: Regional Self-Hosted Media/AI Canary and Recovery Runbooks

**Files:**
- Create: `infra/self-hosted/media/README.md`
- Create: `infra/self-hosted/translation/README.md`
- Create: `infra/regional/provider-routing.yaml`
- Create: `infra/runbooks/media-provider-migration.md`
- Create: `infra/runbooks/translation-provider-migration.md`
- Create: `infra/runbooks/region-failover.md`
- Create: `infra/runbooks/data-recovery.md`
- Test: `services/benchmark-harness/test/canary-routing.spec.ts`

**Interfaces:**
- Consumes: Task 6 passing candidate, signed routing policy, regional health/capacity, Plan 2/3 adapters.
- Produces: shadow/canary/rollback routing, regional SFU/TURN and ASR/MT/TTS deployment requirements, RPO/RTO drill evidence.

- [ ] **Step 1: Write failing routing safety tests**

Assert `0%→shadow→1%→5%→25%→50%→100%` requires explicit metric gates and operator approval; private/AI consent semantics remain identical; unhealthy candidate or error/latency/quality budget breach rolls new sessions back; active calls are not midstream-migrated unless provider contract proves safe handoff.

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/benchmark-harness test -- canary-routing.spec.ts`

Expected: FAIL because routing policy/runbook contracts are absent.

- [ ] **Step 3: Document deployable component requirements**

Media requires regional SFU/TURN, TLS/DTLS/SRTP, credentials, autoscaling, capacity, abuse protection, egress metrics, recording-off default, and multi-AZ. Translation requires model registry/checksums, GPU/CPU sizing, batching limits, language routing, warm capacity, safety glossary, content-retention controls, and external-provider fallback.

- [ ] **Step 4: Define objective canary/rollback gates**

Use join/error, translation latency, quality sample, crash, CPU/GPU saturation, packet loss, cost, safety events, and privacy/security alerts. Rollback is one signed routing change; provider endpoints/credentials are workload-only. Preserve common session IDs and event schemas across routes.

- [ ] **Step 5: Define recovery drills**

Quarterly exercises cover provider outage, region loss, Redis/cache loss, message/ledger restore, encrypted object restore, key rotation, and corrupted routing catalog. Target core-data RPO ≤5 minutes and RTO ≤60 minutes; record actual results and unresolved risks.

- [ ] **Step 6: Run routing/recovery tabletop checks**

Run: `npm --workspace @chingume/benchmark-harness test -- canary-routing.spec.ts && npm run check:runbooks`

Expected: PASS for promotion authorization, automatic rollback trigger, signed routing, session-ID parity, and required RPO/RTO drill fields.

- [ ] **Step 7: Commit**

```bash
git add ChinguMe/infra/self-hosted ChinguMe/infra/regional ChinguMe/infra/runbooks ChinguMe/services/benchmark-harness/test/canary-routing.spec.ts ChinguMe/package.json
git commit -m "docs: add regional self-hosting migration controls"
```

### Task 8: Global Release, Compliance, and Failure-Mode Gate

**Files:**
- Create: `quality/global/release-gate.ts`
- Create: `quality/global/checklists/country-readiness.schema.json`
- Create: `quality/global/checklists/language-readiness.schema.json`
- Create: `services/core-api/test/global-release.e2e-spec.ts`
- Create: `security/web3/red-team.jsonl`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: all Plan 8 catalogs/evidence plus prior-plan release gates.
- Produces: signed release manifest listing enabled countries/features/languages/modalities/assets/networks/providers and exact blocking reasons.

- [ ] **Step 1: Write the failing release gate**

Require 25 language entries, approved-country evidence, app-store/payment/legal/privacy/safety/support signoffs, current provider benchmarks, emergency disable drill, Web3 private-key scan, ledger separation, fiat fallback, and prior Plan 1–7 CI results. Missing/expired evidence blocks only the affected scope and cannot be overridden from mobile.

- [ ] **Step 2: Add global/Web3 red-team fixtures**

Cover VPN/country mismatch, unsupported network/asset spoof, malicious token with same ticker, seed request, signature replay/phishing domain, sanctioned/high-risk wallet, quote manipulation, fake transaction hash, webhook forgery, reorg, app-store digital-payment bypass, provider outage, stale catalogs, and admin emergency disable.

- [ ] **Step 3: Run complete release verification**

```bash
npm run verify
npm run check:global-release
npm --workspace @chingume/benchmark-harness test
npm --workspace @chingume/core-api test -- global wallet crypto
cd apps/mobile
flutter analyze
flutter test
```

Expected: all commands exit 0 for the configured eligible test scope; disabled combinations return named fail-closed decisions and fiat/original-audio/text alternatives where applicable.

- [ ] **Step 4: Generate release manifest**

Run: `node quality/global/release-gate.ts --catalog config/global --evidence artifacts/release-evidence --out artifacts/global-release-manifest.json`

Expected: signed manifest includes no secrets/member data and exactly identifies each language modality, country feature, stablecoin/network, payment rail, media route, and translation route.

- [ ] **Step 5: Document rollout ownership**

Document approver roles, evidence freshness, catalog signing/rotation, country/legal review cadence, language human QA, customer-support readiness, wallet/payment incident response, provider migration authority, and public capability/status communication.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/quality/global ChinguMe/security/web3 ChinguMe/services/core-api/test/global-release.e2e-spec.ts ChinguMe/.github/workflows/ci.yml ChinguMe/README.md ChinguMe/package.json
git commit -m "test: gate global Web3 and self-hosted rollout"
```

---

## Plan Acceptance Gate

- [ ] All 25 approved languages have measured, truthful per-modality capability and localization/support state.
- [ ] Only countries with current ten-domain readiness evidence expose each regulated feature.
- [ ] Invalid/stale catalog and emergency disable combinations fail closed within the target window.
- [ ] Wallet connection proves public-account ownership without any private-key/seed custody path.
- [ ] Only approved stablecoin/network/country/service combinations reach a licensed processor.
- [ ] Web3/service settlement cannot purchase Special, AI credits, boosts, or other digital goods.
- [ ] Fiat fallback and transparent quote/fee/risk/refund status remain available.
- [ ] Managed and self-hosted candidates pass the same mobile/domain/provider contracts and benchmark schema.
- [ ] Canary, rollback, regional failure, RPO, and RTO runbooks pass tabletop/automated checks.
- [ ] Global release, Web3 red-team, accounting separation, Flutter, API, and CI gates pass.
