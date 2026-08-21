# ChinguMe Development Program Roadmap

> **For agentic workers:** This document decomposes the approved master design into independently reviewable implementation plans. Execute only a subplan whose dependencies are complete.

**Goal:** Deliver ChinguMe Friends, Dating, Opportunities, 25-language translation, managed OpenClaw agents, and later Web3/self-hosted infrastructure through testable releases rather than one high-risk big-bang build.

**Architecture:** Two Flutter app flavors share one mobile codebase and call a NestJS modular core API. Realtime media, translation, safety automation, and OpenClaw execution are isolated behind owned interfaces so managed providers can be replaced without rewriting domain code.

**Tech Stack:** Flutter 3.47, Dart, Node.js 24 LTS, NestJS 11 with Fastify 5, PostgreSQL 18, Redis-compatible cache, S3-compatible object storage, OpenAPI, Docker Compose, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-21-chingume-global-platform-design.md`

## Global Constraints

- Public Friends and Dating products are 18+ only.
- Friends and Dating share identity but keep profile, intent, recommendation, and exposure data separate.
- No anonymous/random video chat and no attractiveness ranking.
- Raw BYOK secrets must never reach mobile logs, analytics, support tools, or API responses.
- AI translation mode and end-to-end encrypted private mode must be presented as distinct modes.
- OpenClaw handles context and assistance; the realtime ASR/MT/TTS path remains a dedicated service.
- Digital subscriptions and credits remain separate from person-to-person service settlement.
- Web3 begins with non-custodial wallet connection and approved stablecoins; no ChinguMe token or key custody.
- Every provider integration has a local fake, a contract test, a timeout, and a documented degraded mode.
- Every subplan finishes with a runnable vertical slice and independent acceptance gate.

---

## Plan 1 — Platform Foundation and Adult Identity

**Plan file:** `docs/superpowers/plans/2026-08-21-chingume-foundation-identity-implementation.md`

**Delivers:**

- Repository/toolchain baseline and CI
- Friends/Dating mobile flavors
- Core API health/configuration vertical slice
- Adult phone + liveness onboarding contract with local deterministic providers
- PostgreSQL identity schema and access-token issuance
- Audit-safe logging and local infrastructure

**Exit gate:** A fresh machine can start dependencies, run API and Flutter tests, register an 18+ local test member, and receive a token containing only the member ID and age-verification status.

## Plan 2 — Messaging, Media, and Consent Sessions

**Dependencies:** Plan 1

**Plan file:** `docs/superpowers/plans/2026-08-21-chingume-messaging-media-consent-implementation.md`

**Delivers:**

- Mutual-consent relationship state machine
- Profile-based chat request with greeting/purpose and no conversation before acceptance
- 1:1 text messaging, WebSocket presence, delivery/read receipts
- Upload reservation, malware scan adapter, object-store policy, image/video/document metadata
- Call session authorization and managed WebRTC provider abstraction
- AI translation vs private call mode consent flow
- Message/block/report hooks consumed by the safety plan

**Exit gate:** Two verified test members can mutually connect, exchange messages/files, start an authorized call, and cannot bypass a block or call-mode consent.

## Plan 3 — Translation Orchestrator and BYOK

**Dependencies:** Plans 1 and 2

**Plan file:** `docs/superpowers/plans/2026-08-21-chingume-translation-byok-implementation.md`

**Delivers:**

- Encrypted BYOK secret references and deletion
- OpenAI, Google, Azure Speech, and DeepL provider ports plus local fakes
- Streaming ASR → MT → caption → optional TTS state machine
- Provider capability catalog, timeout, circuit breaker, cost and latency events
- Text, voice-note, OCR, document, and video-caption job contracts
- Five-language beta quality harness

**Exit gate:** A recorded bilingual test call produces ordered captions within the beta latency target, switches to a fallback adapter after an injected failure, and never exposes provider secrets.

## Plan 4 — Friends, Dating, Interests, and Community

**Dependencies:** Plans 1, 2, and 3

**Plan file:** `docs/superpowers/plans/2026-08-21-chingume-social-matching-community-implementation.md`

**Delivers:**

- Three-level interest taxonomy and localized labels
- Separate Friends and Dating profiles
- Surface-separated image/video profile showcases
- Equal search and shorts discovery with captions, visibility, and chat requests
- Public-content review port with a local/test-only deterministic adapter; Plan 5 supplies production moderation
- Explainable recommendation reasons and exclusion rules
- Mutual acceptance, rejection, block, and no-repeat guarantees
- Interest communities, rooms, events, and copyright-safe watch-party model
- Dating-specific intent/value fields isolated from Friends

**Exit gate:** Recommendation tests prove that blocked/rejected users do not reappear and that Dating data is never returned through Friends APIs.

## Plan 5 — Trust, Safety, and Operations

**Dependencies:** Plans 1, 2, and 4

**Plan file:** `docs/superpowers/plans/2026-08-21-chingume-trust-safety-operations-implementation.md`

**Delivers:**

- Unified report taxonomy and two-action report UX
- Public showcase image/video/caption/OCR/metadata moderation and immediate search/shorts removal
- Risk events, rate limits, re-registration defenses, scam/contact warnings
- Text/image/file moderation provider interfaces and quarantine
- Case management, evidence retention, appeal, restoration, and audit log
- Emergency queues, service-level timers, transparency metrics
- Admin console roles and break-glass access

**Exit gate:** Red-team fixtures for romance scams, harassment, unsafe casting, and malicious files are blocked or queued with auditable reasons; false-positive appeals restore access without losing the audit trail.

## Plan 6 — Special Membership and Managed OpenClaw

**Dependencies:** Plans 2, 3, and 5

**Plan file:** `docs/superpowers/plans/2026-08-21-chingume-special-openclaw-implementation.md`

**Delivers:**

- Subscription entitlement and translation-minute ledger
- Roy/Genie personas, disclosure, intervention controls, and voice selection
- Per-member OpenClaw session/memory/tool-policy isolation
- Explicit approval for external actions
- Consent-based summary and long-term memory CRUD
- Agent gateway timeout, audit, and safe fallback to ordinary translation

**Exit gate:** Cross-member access tests fail closed, denied tools never execute, and agent failure leaves the underlying translated call usable.

## Plan 7 — Opportunities, Contracts, and Fiat Payments

**Dependencies:** Plans 1, 2, 3, and 5

**Plan file:** `docs/superpowers/plans/2026-08-21-chingume-opportunities-fiat-implementation.md`

**Delivers:**

- Separate work profile, portfolio, listings, applications, and interviews
- Work-only showcase with Opportunities search/shorts and purpose-bound inquiry
- Local Buddy vs licensed Professional Guide distinction
- Casting required fields and prohibited-listing rules
- Contract scope, milestone, IP, cancellation, and evidence model
- Licensed payment/escrow provider abstraction, ledger, webhook idempotency
- Dispute case workflow and marketplace metrics

**Exit gate:** A verified requester can publish a compliant listing, select a provider, sign a contract, fund a milestone through a fake escrow adapter, approve delivery, and open a dispute without mixing social or Dating data.

## Plan 8 — Globalization, Web3, and Partial Self-Hosting

**Dependencies:** Plans 3, 5, 6, and 7

**Plan file:** `docs/superpowers/plans/2026-08-21-chingume-globalization-web3-selfhosting-implementation.md`

**Delivers:**

- Five-language beta and 25-language feature-capability matrix
- Country launch switches and legal/payment/safety readiness gates
- Non-custodial wallet connection, stablecoin quote, licensed processor, sanctions/risk checks
- Fiat fallback and strict separation from in-app digital purchases
- Managed-to-self-hosted media/AI benchmark harness
- Regional SFU/TURN and self-hosted ASR/MT/TTS migration runbooks

**Exit gate:** Unsupported country/asset combinations fail closed, wallet private keys never enter ChinguMe systems, and a provider can be replaced in the benchmark environment without changing mobile or domain contracts.

## Release Gates

| Release | Required plans | User-visible outcome |
|---|---|---|
| Technical prototype | 1 | Dual app shells and verified adult onboarding |
| Friends internal alpha | 1–4 | Safe matching, chat/calls, BYOK translation in five languages |
| Closed beta | 1–6 | Dating, safety operations, Special Roy/Genie |
| Opportunities beta | 1–7 | Global jobs/projects with contracts and fiat escrow |
| Global v1 | 1–8 globalization slice | 25-language capability reporting and country gates |
| Expansion | Plan 8 Web3/self-host slices | Stablecoin service settlement and partial owned infrastructure |

## Master Spec Coverage

| Master spec sections | Primary implementation plans |
|---|---|
| 1–4 product principles, products, users | Plans 1, 4, 7 |
| 5 interests | Plan 4 |
| 6 core journeys | Plans 1–7 |
| 7 realtime/media translation and BYOK/Special | Plans 3 and 6 |
| 8 communications and media | Plans 2 and 3 |
| 9 matching, profile showcase, equal search/shorts, communities, events | Plans 2, 3, 4, and 5 |
| 10 Opportunities trust and transaction design | Plans 5 and 7 |
| 11 identity, safety, reports, retention | Plans 1, 2, and 5 |
| 12 memberships and revenue | Plans 6 and 7 |
| 13 Web3 wallet and stablecoin settlement | Plan 8 |
| 14 architecture and provider replacement | Plans 1–3, 6, and 8 |
| 15 quality, availability, security, recovery | Acceptance gates in Plans 1–8 |
| 16 languages and countries | Plans 3 and 8 |
| 17 roadmap and budget | This program roadmap and release gates |
| 18 organization | Staffing prerequisites attached to release gates and operations runbooks |
| 19 metrics | Quality, safety, entitlement, marketplace, and global release tasks in Plans 3, 5–8 |
| 20 risks | Provider failure, safety red-team, store/payment separation, country gates, and rollback tasks in Plans 2–8 |
| 21 verification | Unit, contract, integration, language, performance, security, red-team, and recovery tasks across Plans 1–8 |
| 22 global v1 completion | Plan acceptance gates plus Plan 8 global release manifest |

## Planning and Revalidation Order

The eight detailed plans are baselined before coding so scope, dependencies, budgets, and architecture can be reviewed as one program. Immediately before implementing each plan, compare its assumed files and interfaces with the code produced by earlier plans; record any required path/signature adjustment in that plan before execution. This preserves a complete program view without allowing later execution to rely on stale contracts.
