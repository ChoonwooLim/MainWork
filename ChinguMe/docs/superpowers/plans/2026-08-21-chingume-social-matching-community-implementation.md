# ChinguMe Friends, Dating, Interests, and Community Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build clearly separated Friends and Dating profiles, image/video profile showcases, equal search/shorts discovery, explainable recommendations, mutual decisions, and safe interest communities/events.

**Architecture:** One account owns independent surface profiles and showcases whose tables, DTOs, search/shorts documents, and authorization policies never collapse into a generic public profile. Search and shorts query the same eligible candidate source through different presentation cursors; a deterministic pipeline applies hard safety/exclusion rules before ranking and stores reason codes instead of popularity or appearance scores. Versioned interests feed profiles, discovery, communities, events, and translation glossaries.

**Tech Stack:** Existing core API and Flutter stack, PostgreSQL 18.4, Redis-compatible candidate cache, OpenSearch-compatible search port with PostgreSQL local adapter, NestJS, Flutter localization-ready presentation.

**Spec:** `docs/superpowers/specs/2026-08-21-chingume-global-platform-design.md`

**Additional Spec:** `docs/superpowers/specs/2026-08-21-chingume-profile-showcase-discovery-design.md`

## Global Constraints

- Friends and Dating share adult identity only; profile, intent, recommendation, exposure, and search documents remain surface-separated.
- Friends optimizes language/culture/interest compatibility; Dating uses explicit relationship intent, gender/age/distance/lifestyle/value preferences.
- No attractiveness ranking, public popularity score, anonymous/random matching, or inferred-interest publication without approval.
- Search and shorts are equal top-level discovery modes; a user can disable shorts exposure/use without losing search discovery or chat requests.
- A showcase supports one hero image, up to six gallery images, and one 15–60 second portrait intro video after Plan 2/5 release decisions.
- Plan 4 defines `PublicContentReviewPort`; its deterministic adapter is local/test-only, and staging/production public showcase release stays disabled until Plan 5 supplies the production adapter.
- Rejected, blocked, already-active, suspended, and exposure-ineligible members never reappear in recommendations.
- A recommendation explains overlap with safe reason codes and never exposes sensitive filters or exact location.
- Interest model is `major category → subcategory → user-approved free tag`; onboarding asks for 3–5 majors and at most 10 subcategories.
- Copyrighted music/video is not retransmitted; watch parties coordinate discussion and translation only.
- Every public write is attributable to a verified adult and exposes report/block hooks from Plan 2.
- All timestamps use UTC and visible IDs use UUIDv7.
- Every task follows red-green-refactor and ends with a focused commit.

---

## File Structure

```text
ChinguMe/
├── services/core-api/migrations/004_social_matching_community.sql
├── services/core-api/src/modules/
│   ├── interests/
│   ├── profiles/
│   ├── showcases/
│   ├── recommendations/
│   ├── communities/
│   └── events/
├── services/core-api/test/{interests,profiles,showcases,recommendations,communities,events}.*.spec.ts
├── config/interests/v1/{taxonomy.json,ko.json,en.json,ja.json,zh-Hans.json,es.json}
└── apps/mobile/lib/features/{profile,showcase,discover,communities,events}/
```

## Stable Interfaces

```typescript
export type Surface = "friends" | "dating";
export interface RecommendationCard {
  recommendationId: string;
  surface: Surface;
  memberId: string;
  displayProfile: Record<string, unknown>;
  reasons: Array<{ code: "language_exchange" | "shared_interest" | "nearby_region" | "active_time" | "dating_preferences"; labelKey: string; value?: string }>;
  expiresAt: string;
}
export interface ProfileShowcase {
  showcaseId: string;
  memberId: string;
  surface: Surface;
  version: number;
  heroImageId: string;
  galleryMediaIds: string[];
  introVideoId?: string;
  captionState: "not_requested" | "processing" | "ready" | "unavailable";
  originalCaptionRevisionId?: string;
  translatedCaptionRevisionIds: string[];
  visibility: "discovery" | "search_only" | "connections_only" | "private";
  moderationState: "draft" | "processing" | "moderation_pending" | "published" | "rejected" | "paused" | "archived";
  publishedAt?: string;
}
export interface ExposurePolicy {
  mayExpose(input: { viewerId: string; candidateId: string; surface: Surface; now: Date }): Promise<boolean>;
}
export interface PublicContentReviewPort {
  review(input: { showcaseId: string; version: number; surface: Surface; mediaIds: string[]; captionRevisionIds: string[] }): Promise<{
    decision: "allow" | "reject" | "human_review";
    decisionId: string;
    reasonCodes: string[];
  }>;
}
```

---

### Task 1: Versioned Interest Taxonomy and Localization

**Files:**
- Create: `config/interests/v1/taxonomy.json`
- Create: `config/interests/v1/ko.json`
- Create: `config/interests/v1/en.json`
- Create: `config/interests/v1/ja.json`
- Create: `config/interests/v1/zh-Hans.json`
- Create: `config/interests/v1/es.json`
- Create: `services/core-api/src/modules/interests/application/interest-catalog.ts`
- Test: `services/core-api/test/interests.catalog.spec.ts`

**Interfaces:**
- Consumes: the 12 approved major categories from the master spec.
- Produces: immutable taxonomy IDs, localized labels, active/deprecated aliases, and `InterestCatalog.list(locale,version)`.

- [ ] **Step 1: Write failing catalog invariants**

```typescript
expect(catalog.list("ko", 1).majorCategories).toHaveLength(12);
expect(catalog.resolve("music.kpop", 1)).toMatchObject({ majorId: "music", subcategoryId: "music.kpop" });
expect(() => catalog.validateSelection({ majors: ["music", "games"], subcategories: [] })).toThrowCode("INTEREST_MAJOR_COUNT");
```

Assert unique stable IDs, 3–5 major selections, ≤10 subcategories, subcategory-parent membership, five complete beta labels, and fallback to English only when the API explicitly reports it.

- [ ] **Step 2: Run the catalog test**

Run: `npm --workspace @chingume/core-api test -- interests.catalog.spec.ts`

Expected: FAIL because taxonomy files and catalog are absent.

- [ ] **Step 3: Create the 12-category taxonomy**

Use stable IDs for music; film/drama/anime; games; photo/video/creative; travel/culture; food/cafe; sports/health; books/learning; fashion/beauty; tech/business; pets/nature; daily/lifestyle. Add the approved subcategories from spec section 5 without embedding translated display strings in IDs.

- [ ] **Step 4: Implement selection/free-tag rules**

Normalize free tags to Unicode NFC, trim/collapse whitespace, preserve user display casing, cap at 30 code points and 20 tags, prohibit URLs/contact fields, and store `visibility=pending_user_approval|public|private`. Machine suggestions default to `pending_user_approval`.

- [ ] **Step 5: Run tests and JSON schema validation**

Run: `npm --workspace @chingume/core-api test -- interests.catalog.spec.ts && npm run check:interests`

Expected: PASS for every locale and taxonomy invariant.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/config/interests ChinguMe/services/core-api/src/modules/interests ChinguMe/services/core-api/test/interests.catalog.spec.ts ChinguMe/package.json
git commit -m "feat: add localized interest taxonomy"
```

### Task 2: Surface-Separated Friends and Dating Profiles

**Files:**
- Create: `services/core-api/migrations/004_social_matching_community.sql`
- Create: `services/core-api/src/modules/profiles/domain/friends-profile.ts`
- Create: `services/core-api/src/modules/profiles/domain/dating-profile.ts`
- Create: `services/core-api/src/modules/profiles/application/profile.service.ts`
- Create: `services/core-api/src/modules/profiles/adapters/http/profile.controller.ts`
- Test: `services/core-api/test/profiles.isolation.e2e-spec.ts`

**Interfaces:**
- Consumes: verified member and Task 1 interests.
- Produces: `/v1/friends/profile` and `/v1/dating/profile` CRUD with independent activation/exposure state and response DTOs.

- [ ] **Step 1: Write the failing isolation tests**

```typescript
await saveDating({ relationshipIntent: "long_term", values: ["family"] }).expect(200);
const friends = await getFriendsProfile().expect(200);
expect(JSON.stringify(friends.body)).not.toContain("long_term");
expect(JSON.stringify(friends.body)).not.toContain("family");
```

Add database/schema and API serialization checks proving Dating columns cannot be selected by the Friends repository.

- [ ] **Step 2: Run isolation tests**

Run: `npm --workspace @chingume/core-api test -- profiles.isolation.e2e-spec.ts`

Expected: FAIL because profile modules are absent.

- [ ] **Step 3: Implement independent aggregates and tables**

Friends fields: languages used/learning with proficiency, culture goals, interests, region band, availability, friendship activities. Dating fields: gender identity, interested genders, age range, distance band, relationship intent, lifestyle/value choices, visibility controls. Both share only safe account display data through an explicit `PublicIdentityView` mapper.

- [ ] **Step 4: Implement activation and exposure**

Require completed surface-specific fields and guideline acceptance version. Deactivation removes search/recommendation documents but preserves the other profile. Exact coordinates never leave the location service; return coarse distance bands only.

- [ ] **Step 5: Run migration and cross-surface tests**

Run: `npm --workspace @chingume/core-api test -- profiles migration.integration.spec.ts`

Expected: PASS for activate/deactivate, owner reads, public DTO minimization, location bands, and bidirectional isolation.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/migrations/004_social_matching_community.sql ChinguMe/services/core-api/src/modules/profiles ChinguMe/services/core-api/test/profiles.isolation.e2e-spec.ts
git commit -m "feat: separate Friends and Dating profiles"
```

### Task 3: Profile Showcase Publishing and Surface Indexes

**Files:**
- Create: `services/core-api/src/modules/showcases/domain/profile-showcase.ts`
- Create: `services/core-api/src/modules/showcases/application/showcase.service.ts`
- Create: `services/core-api/src/modules/showcases/application/showcase-index.ts`
- Create: `services/core-api/src/modules/showcases/application/public-content-review.port.ts`
- Create: `services/core-api/src/modules/showcases/adapters/local/postgres-showcase-index.ts`
- Create: `services/core-api/src/modules/showcases/adapters/local/local-public-content-review.ts`
- Create: `services/core-api/src/modules/showcases/adapters/http/showcase.controller.ts`
- Test: `services/core-api/test/showcases.e2e-spec.ts`

**Interfaces:**
- Consumes: active Friends/Dating profile, Plan 2 clean/processed profile media, and Plan 3 approved captions.
- Produces: `ProfileShowcase`, `PublicContentReviewPort`, local/test-only deterministic review, surface-separated search/shorts documents, publish/pause/archive, and cache/index invalidation events.

- [ ] **Step 1: Write failing lifecycle and media-cardinality tests**

```typescript
await publish({ heroImageId: cleanHero, galleryMediaIds: sixCleanImages, introVideoId: clean60sVideo }).expect(200);
await publish({ heroImageId: cleanHero, galleryMediaIds: sevenCleanImages }).expect(422);
await publish({ heroImageId: datingImage }, { routeSurface: "friends" }).expect(403);
await shortsQuery(memberWithSearchOnlyVisibility).expectBodyNotContaining(memberId);
await searchQuery(memberWithSearchOnlyVisibility).expectBodyContaining(memberId);
```

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/core-api test -- showcases.e2e-spec.ts`

Expected: FAIL because showcase publishing and indexes are absent.

- [ ] **Step 3: Implement exact showcase lifecycle**

Use `draft → processing → moderation_pending → published|rejected|paused|archived`. Require exactly one hero image, zero-to-six gallery images, and at most one 15–60 second intro video. Bind every media asset to owner and surface; only Plan 2 `clean` plus `PublicContentReviewPort.decision="allow"` can reach `published`. The deterministic adapter accepts fixture hash `local-showcase-safe`, rejects `local-showcase-reject`, queues `local-showcase-review`, and throws during construction outside `APP_ENV=local|test`. Staging/production configuration must refuse public showcase release until Plan 5 registers a production adapter. Caption failure may publish with an explicit unavailable state, but safety scanning/review failure cannot.

- [ ] **Step 4: Implement public derivatives and visibility**

Expose only metadata-stripped derivatives, safe thumbnail/stream URLs, original and approved translation cue references, and user-approved profile fields. `search_only` omits the shorts document; `connections_only|private` omit both. Dating deactivation invalidates Dating documents only. Pause/archive/block/deletion publishes an immediate invalidation event before asynchronous index removal.

- [ ] **Step 5: Implement owner CRUD and idempotent versioning**

Use `If-Match` showcase version for updates, create a new immutable published version, and retire prior public derivatives after cache invalidation. Reject cross-owner assets, processing/quarantined media, stale versions, and client-supplied surface changes.

- [ ] **Step 6: Run lifecycle/index tests**

Run: `npm --workspace @chingume/core-api test -- showcases.e2e-spec.ts profiles.isolation.e2e-spec.ts`

Expected: PASS for cardinality, duration, ownership, visibility, moderation, caption failure, stale update, surface isolation, pause, deletion, and index/cache invalidation.

- [ ] **Step 7: Commit**

```bash
git add ChinguMe/services/core-api/src/modules/showcases ChinguMe/services/core-api/test/showcases.e2e-spec.ts
git commit -m "feat: publish surface-separated profile showcases"
```

### Task 4: Explainable Search and Shorts Recommendation Pipeline

**Files:**
- Create: `services/core-api/src/modules/recommendations/domain/recommendation.ts`
- Create: `services/core-api/src/modules/recommendations/application/candidate-source.ts`
- Create: `services/core-api/src/modules/recommendations/application/recommendation.service.ts`
- Create: `services/core-api/src/modules/recommendations/adapters/local/postgres-candidate-source.ts`
- Create: `services/core-api/src/modules/recommendations/adapters/http/recommendation.controller.ts`
- Test: `services/core-api/test/recommendations.property.spec.ts`

**Interfaces:**
- Consumes: surface profiles, Plan 2 blocks/relationships, safety eligibility hook, and coarse activity/location signals.
- Produces: ordered `RecommendationCard[]` for `mode=search|shorts`, opaque decision IDs/cursors, reason codes, interest feedback, and accept/reject recording.

- [ ] **Step 1: Write failing hard-exclusion property tests**

Generate candidate sets containing self, block in either direction, rejected, active relationship, inactive profile, wrong surface, outside hard Dating preferences, search-only visibility, and eligible candidates. Assert only eligible candidates survive regardless of scoring inputs or cache contents; search-only candidates survive search but never shorts.

- [ ] **Step 2: Run recommendation tests**

Run: `npm --workspace @chingume/core-api test -- recommendations.property.spec.ts`

Expected: FAIL because the pipeline is absent.

- [ ] **Step 3: Implement filter-before-rank**

```typescript
const eligible = candidates.filter(hardEligibility);
const ranked = eligible.map(scoreFeatures).sort(byScoreThenStableId);
return ranked.map(toExplanationCard);
```

Friends score uses reciprocal language, approved interest overlap, compatible activity time, region band, and recent healthy activity. Dating score uses mutual hard preferences first, then explicit intent/value/lifestyle compatibility. Shorts may use the viewer's completion/profile-open/not-interested signals only as private interaction features with bounded weight and creator-diversity caps. Do not use beauty, public likes, message-volume popularity, spending, or rejection rate as desirability signals.

- [ ] **Step 4: Implement reason minimization and decision durability**

Return at most three reasons. Never reveal which sensitive Dating preference excluded someone. A reject writes a permanent pair/surface exclusion unless the rejecting member explicitly resets it; a block is never reset through recommendation APIs.

- [ ] **Step 5: Run property, cache-staleness, and E2E tests**

Run: `npm --workspace @chingume/core-api test -- recommendations`

Expected: PASS for 10,000 generated candidate sets, stale-cache recheck, deterministic pagination, no-repeat, and surface isolation.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/src/modules/recommendations ChinguMe/services/core-api/test/recommendations*
git commit -m "feat: add explainable surface recommendations"
```

### Task 5: Communities, Rooms, and Community Messages

**Files:**
- Create: `services/core-api/src/modules/communities/domain/community.ts`
- Create: `services/core-api/src/modules/communities/application/community.service.ts`
- Create: `services/core-api/src/modules/communities/adapters/http/community.controller.ts`
- Test: `services/core-api/test/communities.e2e-spec.ts`

**Interfaces:**
- Consumes: interest catalog, Plan 2 messaging/media/block/report hooks, and verified member.
- Produces: official/verified-host communities, membership roles, text/voice/video room authorization, and community conversation IDs.

- [ ] **Step 1: Write failing membership/role tests**

```typescript
await createCommunityAs(unverifiedMember).expect(403);
await joinCommunity(member, officialCommunity).expect(201);
await openVideoRoomAs(member).expect(403);
await openVideoRoomAs(moderator).expect(201);
```

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/core-api test -- communities.e2e-spec.ts`

Expected: FAIL because community authorization is absent.

- [ ] **Step 3: Implement community lifecycle and roles**

States are `draft|active|frozen|archived`; roles are `owner|moderator|member`. Bind each community to one major interest and optional subcategory. Official communities are seeded; member-created communities require the configurable verified-host eligibility hook.

- [ ] **Step 4: Reuse messaging/call permissions safely**

Create community conversation permissions through adapters rather than bypassing Plan 2. Blocks suppress direct interaction and mentions. Room grants require active membership and exact AI/private call consent for all participants; maximum room size comes from server capability.

- [ ] **Step 5: Run authorization and lifecycle tests**

Run: `npm --workspace @chingume/core-api test -- communities.e2e-spec.ts calls.e2e-spec.ts`

Expected: PASS for role changes, frozen writes, archived discovery, block behavior, room membership changes, and report-hook IDs.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/src/modules/communities ChinguMe/services/core-api/test/communities.e2e-spec.ts
git commit -m "feat: add interest communities and rooms"
```

### Task 6: Events and Copyright-Safe Watch Parties

**Files:**
- Create: `services/core-api/src/modules/events/domain/event.ts`
- Create: `services/core-api/src/modules/events/application/event.service.ts`
- Create: `services/core-api/src/modules/events/adapters/http/event.controller.ts`
- Test: `services/core-api/test/events.e2e-spec.ts`

**Interfaces:**
- Consumes: community membership, call authorization, interest IDs, coarse region/time zone.
- Produces: online/offline event listings, RSVP/waitlist, host controls, and coordination-only watch-party metadata.

- [ ] **Step 1: Write failing event policy tests**

Assert an event can link a lawful external title/service name but cannot accept a media stream URL, uploaded copyrighted movie/music, DRM token, or rebroadcast endpoint. Assert private exact addresses are released only to confirmed attendees at the configured time.

- [ ] **Step 2: Run tests**

Run: `npm --workspace @chingume/core-api test -- events.e2e-spec.ts`

Expected: FAIL because event policy is absent.

- [ ] **Step 3: Implement event/RSVP states**

Event states: `draft|published|cancelled|completed`; RSVP: `going|waitlisted|cancelled|attended`. Store time in UTC with IANA timezone, capacity, online/offline type, coarse public location, safety notes, and community/interest association.

- [ ] **Step 4: Implement watch-party coordination**

Store only service name, content title/identifier, planned start time, discussion room, and legal-access notice. ChinguMe provides synchronized countdown, chat, and translation; it never proxies or uploads the content.

- [ ] **Step 5: Run tests**

Run: `npm --workspace @chingume/core-api test -- events.e2e-spec.ts`

Expected: PASS for capacity races, waitlist promotion, cancellation notifications, address authorization, and prohibited-media fields.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/services/core-api/src/modules/events ChinguMe/services/core-api/test/events.e2e-spec.ts
git commit -m "feat: add safe community events"
```

### Task 7: Mobile Profiles, Equal Search/Shorts Discovery, Communities, and Events

**Files:**
- Create: `apps/mobile/lib/features/profile/data/profile_api.dart`
- Create: `apps/mobile/lib/features/profile/presentation/profile_editor_screen.dart`
- Create: `apps/mobile/lib/features/showcase/domain/profile_showcase.dart`
- Create: `apps/mobile/lib/features/showcase/application/showcase_controller.dart`
- Create: `apps/mobile/lib/features/showcase/presentation/showcase_editor_screen.dart`
- Create: `apps/mobile/lib/features/discover/domain/recommendation_card.dart`
- Create: `apps/mobile/lib/features/discover/application/discovery_controller.dart`
- Create: `apps/mobile/lib/features/discover/presentation/discovery_screen.dart`
- Create: `apps/mobile/lib/features/discover/presentation/shorts_page.dart`
- Create: `apps/mobile/lib/features/communities/data/community_api.dart`
- Create: `apps/mobile/lib/features/communities/presentation/community_screen.dart`
- Create: `apps/mobile/lib/features/events/data/event_api.dart`
- Create: `apps/mobile/lib/features/events/presentation/event_screen.dart`
- Test: `apps/mobile/test/features/discover/surface_isolation_test.dart`
- Test: `apps/mobile/test/features/communities/community_event_flow_test.dart`

**Interfaces:**
- Consumes: Tasks 1–5 APIs and existing connection/chat/call flows.
- Produces: surface-specific profile editors/discovery cards and shared interest/community/event UX.

- [ ] **Step 1: Write failing flavor and isolation widget tests**

Verify Friends asks languages and friendship activities but never renders Dating intent/values; Dating renders explicit intent/safety copy but never Friends learning goals. Verify equal top-level `검색|쇼츠` tabs, search-only visibility, 15–60 second upload limits, default-muted autoplay, caption/original toggle, data saver, full-profile open, and chat request. Recommendation cards show up to three reason labels and no score; reject removes the candidate from both modes and block clears both immediately.

- [ ] **Step 2: Run widget tests**

Run: `flutter test test/features/discover test/features/communities`

Expected: FAIL because the screens are absent.

- [ ] **Step 3: Implement editors and discovery controllers**

Use different typed DTOs and repositories for Friends/Dating so fields cannot be accidentally serialized across surfaces. Require 3–5 major interests, support at most 10 subcategories, and ask before publishing suggested free tags. `ShowcaseController` supports hero/gallery/video editing, processing/moderation state, visibility, caption review, pause, and archive without exposing original media URLs.

- [ ] **Step 4: Implement community/event journeys**

Search filters language, safe country/region band, interest, purpose, active time, and permitted surface fields. Shorts renders one portrait video at a time with pause/mute, approved translated captions, reduced-motion/static fallback, no forced high-resolution cellular preload, profile/report/block/chat-request actions, and a non-shorts path with feature parity. Support translated community/event text, join/leave, role-aware rooms, RSVP/waitlist, safe location disclosure, report/block entry points, and watch-party legal notice. Never display an in-app copyrighted stream player from event metadata.

- [ ] **Step 5: Run full checks**

Run: `flutter analyze && flutter test`

Expected: PASS in Friends and Dating flavors with large text, keyboard navigation, screen-reader labels, and locale fallback tests.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/apps/mobile/lib/features/profile ChinguMe/apps/mobile/lib/features/showcase ChinguMe/apps/mobile/lib/features/discover ChinguMe/apps/mobile/lib/features/communities ChinguMe/apps/mobile/lib/features/events ChinguMe/apps/mobile/test/features/discover ChinguMe/apps/mobile/test/features/communities
git commit -m "feat: add social discovery and communities UI"
```

### Task 8: Privacy Boundary and Discovery Release Gate

**Files:**
- Create: `services/core-api/test/contracts/surface-boundary.contract.spec.ts`
- Create: `services/core-api/test/social-full-flow.e2e-spec.ts`
- Create: `scripts/check-surface-boundaries.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: all Plan 4 interfaces.
- Produces: static import boundary, runtime serialization contract, and a complete discovery-to-community journey.

- [ ] **Step 1: Add the failing boundary checker**

Reject imports from `profiles/domain/dating-*` in Friends controllers/mappers/search/shorts documents and the inverse. Serialize every Friends response fixture and assert Dating-only keys are absent; serialize Dating responses and assert Friends learning-goal keys are absent. Assert Opportunities showcase documents are unavailable from both social indexes.

- [ ] **Step 2: Add the end-to-end journey**

Activate Alice/Bob Friends profiles, publish processed/moderated image/video showcases, find Bob through both search and shorts, submit/accept one chat request, reject another candidate, join a music community, RSVP to a discussion event, and prove rejected/blocked/paused candidates never return across either cursor or cache refresh.

- [ ] **Step 3: Run repository verification**

```bash
npm run check:surface-boundaries
npm run verify
cd apps/mobile
flutter analyze
flutter test
```

Expected: all commands exit 0.

- [ ] **Step 4: Commit**

```bash
git add ChinguMe/services/core-api/test/contracts/surface-boundary.contract.spec.ts ChinguMe/services/core-api/test/social-full-flow.e2e-spec.ts ChinguMe/scripts/check-surface-boundaries.mjs ChinguMe/.github/workflows/ci.yml ChinguMe/README.md ChinguMe/package.json
git commit -m "test: enforce social surface boundaries"
```

---

## Plan Acceptance Gate

- [ ] The 12-category taxonomy is versioned and fully labeled for five beta languages.
- [ ] Friends and Dating profile/storage/API/search boundaries prevent cross-surface leakage.
- [ ] Profile showcase cardinality, 15–60 second video, media/caption/moderation lifecycle, visibility, and cache invalidation match the additional spec.
- [ ] The local public-content reviewer cannot start outside local/test; production exposure remains fail-closed until Plan 5 wiring exists.
- [ ] Search and shorts are equal entry points with identical hard exclusions and feature-complete non-shorts discovery.
- [ ] Shorts uses no appearance/public-like/popularity score and obeys default mute, data saver, reduced motion, and creator diversity.
- [ ] Hard exclusions run after cache retrieval and before every ranking response.
- [ ] Rejected and blocked members do not reappear until an explicitly allowed reset; blocks cannot be reset here.
- [ ] Recommendation explanations are useful but reveal no sensitive exclusion criteria or popularity score.
- [ ] Communities and events reuse Plan 2 authorization/reporting and support translated discussion.
- [ ] Watch parties provide coordination only and do not retransmit copyrighted media.
- [ ] Static boundary, property, E2E, Flutter, and CI checks pass.
