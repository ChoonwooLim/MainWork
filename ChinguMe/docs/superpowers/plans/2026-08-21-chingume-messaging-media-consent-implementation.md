# ChinguMe Messaging, Media, and Consent Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable two verified adults to send a profile-based chat request, connect by mutual consent, exchange durable text and screened files, and enter an authorized private or AI-assisted call without bypassing a block or consent decision.

**Architecture:** The core API owns relationship, conversation, message, upload, block, and call-authorization state. A provider-neutral `MediaProvider` issues short-lived managed-WebRTC grants; clients connect only after every participant accepts the exact call mode. PostgreSQL is authoritative, WebSocket delivery is resumable, and object uploads remain quarantined until a scanner releases them.

**Tech Stack:** Existing Plan 1 stack, NestJS WebSocket gateway, PostgreSQL 18.4, Redis-compatible presence/cache, S3-compatible object storage, ClamAV-compatible scanner port, Flutter WebSocket/HTTP clients, managed WebRTC adapter.

**Spec:** `docs/superpowers/specs/2026-08-21-chingume-global-platform-design.md`

**Additional Spec:** `docs/superpowers/specs/2026-08-21-chingume-profile-showcase-discovery-design.md`

## Global Constraints

- Public Friends and Dating products are 18+ only and require the Plan 1 `adult_verified: true` access token.
- No direct message, file transfer, or call before mutual acceptance.
- A Friends/Dating chat request contains a bounded greeting, purpose, and showcase version; Opportunities inquiries use Plan 7 and do not activate a social relationship.
- A block takes precedence over relationship, conversation, presence, delivery, and call grants.
- Friends and Dating conversations use distinct `surface` values and cannot be moved between products.
- AI translation mode and end-to-end encrypted private mode are mutually exclusive per call session.
- Recording, summary, and long-term memory default to false and require every participant's explicit consent.
- Uploads are private and quarantined until scan state is `clean`; executable and policy-denied types never receive a download grant.
- Every provider has a deterministic local adapter, timeout, contract test, and degraded-mode behavior.
- All timestamps use UTC and all application-visible IDs are UUIDv7.
- Every task follows red-green-refactor and ends with a focused commit.

---

## Program Boundary

This plan implements Roadmap Plan 2. Translation content, recommendation logic, automated moderation decisions, OpenClaw, Opportunities, payments, and Web3 remain outside this plan. It emits stable hooks those plans consume.

## File Structure

```text
ChinguMe/
├── infra/local/compose.yaml
├── services/core-api/
│   ├── migrations/002_messaging_media.sql
│   ├── src/modules/
│   │   ├── relationships/{domain,application,adapters}/
│   │   ├── messaging/{domain,application,adapters}/
│   │   ├── media/{domain,application,adapters}/
│   │   └── calls/{domain,application,adapters}/
│   └── test/{relationships,messaging,media,calls}.*.spec.ts
├── apps/mobile/lib/
│   ├── platform/auth/secure_token_store.dart
│   ├── platform/realtime/realtime_client.dart
│   ├── features/connections/
│   ├── features/chat/
│   └── features/calls/
└── apps/mobile/test/features/{connections,chat,calls}/
```

## Stable Interfaces

```typescript
export type ProductSurface = "friends" | "dating";
export type CallMode = "ai_translation" | "private_e2ee";

export interface ConnectionRequestInput {
  recipientMemberId: string;
  showcaseVersion: number;
  greetingOriginal: string;
  purpose: string;
  conversationStarter?: string;
  clientRequestId: string;
}
export interface ConnectionRequestView {
  requestId: string;
  surface: ProductSurface;
  greetingOriginal: string;
  greetingTranslation?: { text: string; targetLanguage: string; providerJobId: string };
  purpose: string;
  state: "pending" | "active" | "rejected" | "blocked";
}

export interface MessageEvent {
  eventId: string;
  sequence: number;
  conversationId: string;
  messageId: string;
  senderMemberId: string;
  kind: "text" | "media" | "system";
  body: { text?: string; mediaId?: string };
  createdAt: string;
}

export interface MediaProvider {
  createRoom(input: { callId: string; region: string }): Promise<{ providerRoomId: string }>;
  issueParticipantGrant(input: {
    providerRoomId: string;
    memberId: string;
    publish: boolean;
    expiresAt: Date;
  }): Promise<{ endpoint: string; token: string }>;
  closeRoom(providerRoomId: string): Promise<void>;
}
```

```text
POST /v1/{surface}/connection-requests
POST /v1/{surface}/connection-requests/{requestId}/accept
POST /v1/conversations/{conversationId}/messages
GET  /v1/conversations/{conversationId}/messages?afterSequence={n}
POST /v1/media/uploads
POST /v1/media/{mediaId}/complete
POST /v1/conversations/{conversationId}/calls
POST /v1/calls/{callId}/consents
POST /v1/calls/{callId}/join-grant
POST /v1/members/{memberId}/block
```

---

### Task 1: Mutual-Consent Relationship Domain

**Files:**
- Create: `services/core-api/migrations/002_messaging_media.sql`
- Create: `services/core-api/src/modules/relationships/domain/relationship.ts`
- Create: `services/core-api/src/modules/relationships/application/relationship.service.ts`
- Create: `services/core-api/src/modules/relationships/adapters/persistence/postgres-relationship.repository.ts`
- Create: `services/core-api/src/modules/relationships/adapters/http/relationship.controller.ts`
- Test: `services/core-api/test/relationships.domain.spec.ts`
- Test: `services/core-api/test/relationships.e2e-spec.ts`

**Interfaces:**
- Consumes: JWT subject and `adult_verified: true` from Plan 1.
- Produces: `RelationshipService.request(ConnectionRequestInput)`, `accept`, `reject`, `block`, and an active `conversationId` scoped to `ProductSurface`.

- [ ] **Step 1: Write the failing state-transition tests**

```typescript
it("activates only after the recipient accepts", () => {
  const pending = Relationship.request({ id: id1, requesterId: alice, recipientId: bob, surface: "friends", now });
  expect(pending.state).toBe("pending");
  expect(() => pending.accept(alice, now)).toThrowCode("RELATIONSHIP_RECIPIENT_REQUIRED");
  expect(pending.accept(bob, now).state).toBe("active");
});

it("makes block terminal for messaging and calls", () => {
  const blocked = activeRelationship().block(bob, now);
  expect(blocked.permissions()).toEqual({ message: false, media: false, call: false, presence: false });
});

it("stores one bounded profile-based request without opening chat", async () => {
  const request = await service.request(alice, "friends", {
    recipientMemberId: bob,
    showcaseVersion: 3,
    greetingOriginal: "한국어와 영어를 같이 연습해요",
    purpose: "language_exchange",
    clientRequestId: "018f-request-1",
  });
  expect(request.state).toBe("pending");
  expect(request.conversationId).toBeUndefined();
});
```

- [ ] **Step 2: Run tests and verify the missing domain failure**

Run: `npm --workspace @chingume/core-api test -- relationships.domain.spec.ts`

Expected: FAIL because `Relationship` is not defined.

- [ ] **Step 3: Implement the minimal state machine and constraints**

```typescript
export type RelationshipState = "pending" | "active" | "rejected" | "blocked";

export interface RelationshipRepository {
  insert(value: RelationshipRecord): Promise<void>;
  lockByPair(surface: ProductSurface, a: string, b: string): Promise<RelationshipRecord | null>;
  save(value: RelationshipRecord): Promise<void>;
}
```

Store one canonical `member_low_id/member_high_id` pair per surface. Normalize the original greeting to Unicode NFC, cap it at 500 code points, cap purpose/starter to server-owned enum/IDs, reject a client-supplied translation field, and make `(requester,surface,clientRequestId)` idempotent. Plan 3 may attach only a server-generated translation job result to `ConnectionRequestView`. Reject self-requests, duplicates, Dating-to-Friends reuse, acceptance by the requester, and every transition out of `blocked`. Creating an active relationship creates exactly one conversation in the same transaction. Rejection writes the no-repeat exclusion consumed by Plan 4 without revealing a rejection reason to the requester.

- [ ] **Step 4: Add HTTP acceptance coverage**

Assert `201` request, `200` acceptance, `409` duplicate, `403` pre-accept message permission, `200` block, and `404` for blocked-member presence and conversation discovery. Return RFC 9457 problem details with request IDs.

- [ ] **Step 5: Run domain, migration, and E2E tests**

Run: `npm --workspace @chingume/core-api test -- relationships migration.integration.spec.ts`

Expected: PASS; unique pair and surface constraints are enforced by PostgreSQL.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/migrations/002_messaging_media.sql ChinguMe/services/core-api/src/modules/relationships ChinguMe/services/core-api/test/relationships*
git commit -m "feat: add mutual-consent relationships"
```

### Task 2: Durable Messaging and Resumable Realtime Delivery

**Files:**
- Create: `services/core-api/src/modules/messaging/domain/message.ts`
- Create: `services/core-api/src/modules/messaging/application/message.service.ts`
- Create: `services/core-api/src/modules/messaging/adapters/persistence/postgres-message.repository.ts`
- Create: `services/core-api/src/modules/messaging/adapters/http/message.controller.ts`
- Create: `services/core-api/src/modules/messaging/adapters/websocket/message.gateway.ts`
- Test: `services/core-api/test/messaging.e2e-spec.ts`

**Interfaces:**
- Consumes: active conversation permission from Task 1.
- Produces: idempotent message creation, ordered `MessageEvent`, delivery/read cursors, and `GET /v1/conversations/{conversationId}/messages?afterSequence={sequence}` replay.

- [ ] **Step 1: Write failing idempotency and authorization tests**

```typescript
const first = await send({ clientMessageId: "018f-client", text: "안녕하세요" });
const retry = await send({ clientMessageId: "018f-client", text: "안녕하세요" });
expect(retry.body.messageId).toBe(first.body.messageId);
expect(await countMessages(first.body.conversationId)).toBe(1);
await block(alice, bob);
await sendAs(bob, first.body.conversationId, "blocked").expect(403);
```

- [ ] **Step 2: Run the E2E test**

Run: `npm --workspace @chingume/core-api test -- messaging.e2e-spec.ts`

Expected: FAIL because the messaging module is absent.

- [ ] **Step 3: Implement message persistence and sequence allocation**

```typescript
export interface MessageRepository {
  append(input: { conversationId: string; senderId: string; clientMessageId: string; kind: "text" | "media"; body: unknown }): Promise<MessageEvent>;
  listAfter(conversationId: string, afterSequence: number, limit: number): Promise<MessageEvent[]>;
  advanceCursor(conversationId: string, memberId: string, kind: "delivered" | "read", sequence: number): Promise<void>;
}
```

Allocate sequence numbers under a row lock, enforce unique `(conversation_id, sender_id, client_message_id)`, cap text at 8,000 Unicode code points, and publish only after transaction commit.

- [ ] **Step 4: Implement authenticated WebSocket resume**

Require a short-lived socket ticket obtained with the access token. Client sends `resume { conversationId, afterSequence }`; server verifies membership on every subscription and replies with ordered events. Presence is coarse (`online`, `recently_active`, `offline`) and hidden across blocks.

- [ ] **Step 5: Verify replay and race behavior**

Run: `npm --workspace @chingume/core-api test -- messaging.e2e-spec.ts --runInBand`

Expected: PASS for 100 concurrent appends, reconnect replay, cursor monotonicity, duplicate retry, nonmember denial, and block revocation.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/src/modules/messaging ChinguMe/services/core-api/test/messaging.e2e-spec.ts
git commit -m "feat: add resumable realtime messaging"
```

### Task 3: Mobile Connection and Chat Vertical Slice

**Files:**
- Create: `apps/mobile/lib/platform/auth/secure_token_store.dart`
- Create: `apps/mobile/lib/platform/realtime/realtime_client.dart`
- Create: `apps/mobile/lib/features/connections/data/connections_api.dart`
- Create: `apps/mobile/lib/features/chat/domain/chat_message.dart`
- Create: `apps/mobile/lib/features/chat/application/chat_controller.dart`
- Create: `apps/mobile/lib/features/chat/presentation/chat_screen.dart`
- Test: `apps/mobile/test/features/chat/chat_screen_test.dart`

**Interfaces:**
- Consumes: Plan 1 access token and Tasks 1–2 HTTP/WebSocket contracts.
- Produces: secure token persistence, reconnect cursor, optimistic message state, and accessible connection/chat screens shared by both flavors.

- [ ] **Step 1: Add dependencies and write the failing widget test**

Add `flutter_secure_storage` and `web_socket_channel`, then test that send is disabled before acceptance, a single optimistic bubble survives an idempotent retry, reconnect requests the last sequence, and block immediately removes composer/call actions.

Run: `flutter test test/features/chat/chat_screen_test.dart`

Expected: FAIL because `ChatController` and `ChatScreen` do not exist.

- [ ] **Step 2: Define deterministic controller states**

```dart
sealed class ChatState {}
final class ChatReady extends ChatState {
  ChatReady(this.messages, this.lastSequence, this.canContact);
  final List<ChatMessage> messages;
  final int lastSequence;
  final bool canContact;
}
final class ChatDisconnected extends ChatState {
  ChatDisconnected(this.retryAt);
  final DateTime retryAt;
}
```

Generate `clientMessageId` once, retain it across retries, deduplicate by server `messageId`, and store only the refresh/access credential in platform secure storage—never message bodies.

- [ ] **Step 3: Implement HTTP and realtime adapters**

Attach request IDs, 10-second HTTP timeouts, exponential reconnect capped at 30 seconds, and `afterSequence` resume. Convert `403 relationship_blocked` into a terminal local permission state.

- [ ] **Step 4: Implement accessible UI**

Render original text only in this plan. Give send, retry, block, attachment, and call actions semantic labels; announce connection loss and restored delivery without relying on color.

- [ ] **Step 5: Run Flutter checks**

Run: `flutter analyze && flutter test`

Expected: analyzer clean and all connection/chat tests PASS for both flavors.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/apps/mobile/lib/platform ChinguMe/apps/mobile/lib/features/connections ChinguMe/apps/mobile/lib/features/chat ChinguMe/apps/mobile/test/features/chat
git commit -m "feat: add mobile connections and chat"
```

### Task 4: Quarantined Media Uploads

**Files:**
- Create: `services/core-api/src/modules/media/domain/media-asset.ts`
- Create: `services/core-api/src/modules/media/application/media.service.ts`
- Create: `services/core-api/src/modules/media/application/ports.ts`
- Create: `services/core-api/src/modules/media/adapters/local/local-object-store.ts`
- Create: `services/core-api/src/modules/media/adapters/local/local-malware-scanner.ts`
- Create: `services/core-api/src/modules/media/adapters/http/media.controller.ts`
- Test: `services/core-api/test/media.e2e-spec.ts`

**Interfaces:**
- Consumes: active conversation permission.
- Produces: `MediaAsset` states `reserved|uploaded|scanning|clean|rejected|expired`, purposes `chat_attachment|profile_image|profile_intro_video|work_portfolio|evidence`, presigned upload/download grants, and `media.scan.completed` hook.

- [ ] **Step 1: Write failing policy tests**

```typescript
expect(policy.accept({ mime: "image/jpeg", bytes: 5_000_000, extension: ".jpg" })).toBe(true);
expect(policy.accept({ mime: "application/x-msdownload", bytes: 10, extension: ".exe" })).toBe(false);
await download(quarantinedId).expect(423);
await download(cleanId).expect(200);
expect(policy.acceptProfileVideo({ mime: "video/mp4", durationSeconds: 14 })).toBe(false);
expect(policy.acceptProfileVideo({ mime: "video/mp4", durationSeconds: 60 })).toBe(true);
```

- [ ] **Step 2: Run the media test**

Run: `npm --workspace @chingume/core-api test -- media.e2e-spec.ts`

Expected: FAIL because upload reservations are not implemented.

- [ ] **Step 3: Implement ports and deterministic local adapters**

```typescript
export interface ObjectStore {
  reserve(key: string, mime: string, maxBytes: number, expiresAt: Date): Promise<{ uploadUrl: string }>;
  head(key: string): Promise<{ bytes: number; sha256: string; mime: string }>;
  downloadGrant(key: string, expiresAt: Date): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
}
export interface MalwareScanner { scan(key: string): Promise<{ verdict: "clean" | "malicious" | "error"; signature?: string }>; }
```

Local fixtures ending `.eicar` return `malicious`; `.scan-error` returns `error`; all allowed fixtures return `clean`. A scanner error stays quarantined and is retried—never fail-open.

- [ ] **Step 4: Enforce reservation and release rules**

Allow JPEG/PNG/WebP/GIF, MP4/MOV, MP3/M4A/WAV, PDF, TXT, DOCX, XLSX, PPTX, ZIP with per-class limits from configuration. Validate server-observed size, MIME, extension, duration, dimensions, codec, and SHA-256. Profile intro videos must be portrait-capable and 15–60 seconds. Always strip location/device metadata from public profile derivatives; retain originals behind owner-only access and retention policy. Generate safe thumbnails, streaming renditions, and data-saver derivatives only after malware checks, while Plan 5 content moderation remains required before public release.

- [ ] **Step 5: Run tests with local object storage**

Run: `npm --workspace @chingume/core-api test -- media.e2e-spec.ts migration.integration.spec.ts`

Expected: PASS for clean release, EICAR rejection, scan-error quarantine, oversize/MIME mismatch denial, expiry deletion, nonparticipant denial, and blocked download revocation.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/src/modules/media ChinguMe/services/core-api/test/media.e2e-spec.ts ChinguMe/infra/local/compose.yaml
git commit -m "feat: quarantine and scan shared media"
```

### Task 5: Call Authorization and Exact-Mode Consent

**Files:**
- Create: `services/core-api/src/modules/calls/domain/call-session.ts`
- Create: `services/core-api/src/modules/calls/application/call.service.ts`
- Create: `services/core-api/src/modules/calls/application/media-provider.ts`
- Create: `services/core-api/src/modules/calls/adapters/local/local-media.provider.ts`
- Create: `services/core-api/src/modules/calls/adapters/http/call.controller.ts`
- Test: `services/core-api/test/calls.e2e-spec.ts`

**Interfaces:**
- Consumes: active relationship and block permissions.
- Produces: immutable call mode/consent snapshot, short-lived participant grants, `call.started|ended` hooks, and common `callId` for Plan 3.

- [ ] **Step 1: Write the failing consent matrix test**

```typescript
const call = await createCall({ mode: "ai_translation", recording: false, summary: false, memory: false });
await consentAs(alice, call.id, call.policyVersion).expect(200);
await joinAs(alice, call.id).expect(409);
await consentAs(bob, call.id, call.policyVersion).expect(200);
await joinAs(alice, call.id).expect(200);
await changeMode(call.id, "private_e2ee").expect(409);
```

- [ ] **Step 2: Run the call test**

Run: `npm --workspace @chingume/core-api test -- calls.e2e-spec.ts`

Expected: FAIL because `CallSession` does not exist.

- [ ] **Step 3: Implement the call state machine**

Use `proposed → consent_pending → ready → active → ended|cancelled`. Bind consent to `policyHash = sha256(mode, recording, summary, memory, participantIds, disclosureVersion)`. A changed option creates a new proposal and clears every prior consent. `private_e2ee` requires recording/summary/memory false.

- [ ] **Step 4: Implement local media-provider contract**

The local adapter returns `wss://local.invalid/rooms/{callId}` and a signed test grant expiring in five minutes. Provider timeout is three seconds. If room creation fails, the call stays `ready`; messaging continues and the client receives `media_temporarily_unavailable`.

- [ ] **Step 5: Verify revocation and race paths**

Run: `npm --workspace @chingume/core-api test -- calls.e2e-spec.ts --runInBand`

Expected: PASS for exact-policy consent, join-after-all-consent, expired grants, nonparticipant denial, concurrent block/call race, block-driven room close, and private-mode AI prohibition.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/src/modules/calls ChinguMe/services/core-api/test/calls.e2e-spec.ts
git commit -m "feat: authorize calls with exact-mode consent"
```

### Task 6: Mobile Media and Call Consent Experience

**Files:**
- Create: `apps/mobile/lib/features/chat/data/media_api.dart`
- Create: `apps/mobile/lib/features/chat/presentation/media_attachment.dart`
- Create: `apps/mobile/lib/features/calls/domain/call_policy.dart`
- Create: `apps/mobile/lib/features/calls/application/call_controller.dart`
- Create: `apps/mobile/lib/features/calls/presentation/call_consent_sheet.dart`
- Create: `apps/mobile/lib/features/calls/presentation/call_screen.dart`
- Test: `apps/mobile/test/features/calls/call_consent_test.dart`

**Interfaces:**
- Consumes: Tasks 4–5 upload and call contracts.
- Produces: resumable upload UI, scan-state rendering, exact consent receipt, and a provider bridge receiving only short-lived grants.

- [ ] **Step 1: Write failing widget tests**

Verify that quarantined files cannot be opened, malicious files show a stable rejection, AI mode names external processing, private mode says translation/recording/summary are unavailable, toggling any policy option invalidates consent, and a block ends the call screen.

- [ ] **Step 2: Run the tests**

Run: `flutter test test/features/calls/call_consent_test.dart`

Expected: FAIL because call policy UI is absent.

- [ ] **Step 3: Implement call policy and controller**

```dart
enum CallMode { aiTranslation, privateE2ee }
final class CallPolicy {
  const CallPolicy({required this.mode, required this.recording, required this.summary, required this.memory, required this.policyHash});
  final CallMode mode;
  final bool recording, summary, memory;
  final String policyHash;
}
```

The controller discards grants on background, logout, block, call end, or five-minute expiry. It never stores grants in analytics, logs, or secure storage.

- [ ] **Step 4: Implement upload and call screens**

Show scan progress, retry only scanner-error states, and preserve upload idempotency. Require a separate affirmative action for call policy; do not pre-check recording/summary/memory. Render original audio/video only—the translation overlay arrives in Plan 3.

- [ ] **Step 5: Run full mobile verification**

Run: `flutter analyze && flutter test`

Expected: PASS for both flavors and all accessibility semantics.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/apps/mobile/lib/features/chat ChinguMe/apps/mobile/lib/features/calls ChinguMe/apps/mobile/test/features/calls
git commit -m "feat: add screened media and call consent UI"
```

### Task 7: Cross-Module Contract and Recovery Verification

**Files:**
- Create: `services/core-api/test/messaging-call-flow.e2e-spec.ts`
- Create: `services/core-api/test/provider-contracts/media-provider.contract.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: all Plan 2 modules.
- Produces: one repeatable two-member vertical-slice test and provider contract suite required by later plans.

- [ ] **Step 1: Write the full failing journey test**

Register Alice/Bob, request/accept Friends connection, exchange and replay messages, upload/scan an image, consent to AI call, join both users, block mid-call, and assert message, download, presence, and join-grant denial after the block.

- [ ] **Step 2: Add provider contract cases**

The shared suite asserts room creation, participant scoping, five-minute expiry, close idempotency, timeout mapping, and absence of provider tokens in serialized errors. Run it against `LocalMediaProvider` in CI.

- [ ] **Step 3: Run API and Flutter verification**

```bash
npm run verify
cd apps/mobile
flutter analyze
flutter test
```

Expected: every command exits 0 and the vertical slice passes twice without persisted state leakage.

- [ ] **Step 4: Document local operator flow**

Document two test accounts, WebSocket resume, clean/EICAR fixtures, call-mode disclosures, provider failure injection, and storage cleanup commands without embedding tokens or raw identity data.

- [ ] **Step 5: Commit**

```bash
git add ChinguMe/services/core-api/test ChinguMe/.github/workflows/ci.yml ChinguMe/README.md
git commit -m "test: verify messaging media and call consent"
```

---

## Plan Acceptance Gate

- [ ] Two verified adults cannot exchange anything before recipient acceptance.
- [ ] A block atomically revokes presence, messages, media downloads, call grants, and reconnect subscriptions.
- [ ] Message retries are idempotent and reconnect replay is strictly ordered.
- [ ] Unscanned, malicious, mismatched, expired, and forbidden files never receive download grants.
- [ ] AI and private call modes present different disclosures and cannot be combined.
- [ ] Recording, summary, and memory require unanimous exact-policy consent.
- [ ] Provider failure preserves chat and returns a documented call degraded mode.
- [ ] Friends and Dating conversation records remain surface-separated.
- [ ] A profile chat request is idempotent, bounded, does not open chat before acceptance, and writes rejection no-repeat state.
- [ ] Profile images and 15–60 second intro videos remain quarantined until all required processing and safety decisions complete.
- [ ] API, provider-contract, integration, Flutter, and build checks pass in CI.
