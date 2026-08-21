# ChinguMe Platform Foundation and Adult Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible ChinguMe monorepo with dual Friends/Dating mobile flavors, a production-shaped core API, PostgreSQL persistence, and a complete local adult phone-plus-liveness onboarding vertical slice.

**Architecture:** One Flutter project produces separate Friends and Dating apps from flavors while sharing design and networking code. A NestJS 11 modular API owns the identity domain and exposes provider-neutral OTP/liveness ports; deterministic local adapters make the vertical slice runnable without choosing production vendors.

**Tech Stack:** Flutter 3.47.0, Dart bundled with Flutter, Node.js 24.19.0 LTS, npm workspaces, NestJS 11, Fastify 5, TypeScript strict mode, PostgreSQL 18.4, node-postgres, Jest, Supertest, Docker Compose, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-21-chingume-global-platform-design.md`

## Global Constraints

- Public Friends and Dating products are 18+ only.
- Friends and Dating share identity but keep profile, intent, recommendation, and exposure data separate.
- No anonymous/random video chat and no attractiveness ranking.
- Store only a keyed phone hash and last four digits; never persist a plaintext phone number after challenge completion.
- Local OTP/liveness adapters may run only when `APP_ENV` is `local` or `test`.
- Access tokens contain member identity and adult-verification state, not raw phone, birth date, selfie, or provider secrets.
- Raw selfies and liveness artifacts never enter PostgreSQL; store only the external reference, result, confidence, and timestamps.
- Every endpoint emits a request ID and RFC 9457-style problem details without sensitive request bodies.
- All timestamps use UTC. Application-visible identifiers use `uuid.v7()` and database-only identifiers default to PostgreSQL 18 `uuidv7()`.
- Every task follows red-green-refactor and ends with a focused commit.

---

## Program Boundary

This plan implements only Program Roadmap Plan 1. Messaging, media, translation, matching, safety case management, OpenClaw, Opportunities, payments, localization, and Web3 are explicitly outside this plan. The plan creates the interfaces those later plans consume.

## File Structure

```text
ChinguMe/
├── .editorconfig
├── .gitignore
├── .nvmrc
├── package.json
├── package-lock.json
├── README.md
├── apps/
│   └── mobile/
│       ├── android/app/build.gradle.kts
│       ├── ios/Flutter/friends.xcconfig
│       ├── ios/Flutter/dating.xcconfig
│       ├── lib/
│       │   ├── main_friends.dart
│       │   ├── main_dating.dart
│       │   ├── app/chingume_app.dart
│       │   ├── config/app_config.dart
│       │   └── features/onboarding/
│       │       ├── application/onboarding_controller.dart
│       │       ├── data/http_identity_api.dart
│       │       ├── domain/identity_api.dart
│       │       └── presentation/onboarding_screen.dart
│       ├── test/
│       │   ├── config/app_config_test.dart
│       │   └── features/onboarding/onboarding_screen_test.dart
│       └── pubspec.yaml
├── infra/
│   └── local/compose.yaml
├── scripts/
│   └── verify-layout.mjs
├── services/
│   └── core-api/
│       ├── migrations/001_identity.sql
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── platform/
│       │   │   ├── config/env.ts
│       │   │   ├── database/database.ts
│       │   │   ├── http/problem-details.filter.ts
│       │   │   ├── logging/redact.ts
│       │   │   ├── security/hmac.ts
│       │   │   └── security/jwt-access-token.issuer.ts
│       │   └── modules/
│       │       ├── health/health.controller.ts
│       │       └── identity/
│       │           ├── domain/member.ts
│       │           ├── domain/registration.ts
│       │           ├── application/identity.service.ts
│       │           ├── application/ports.ts
│       │           ├── adapters/http/identity.controller.ts
│       │           ├── adapters/local/local-liveness.provider.ts
│       │           ├── adapters/local/local-otp.provider.ts
│       │           ├── adapters/persistence/postgres-identity.repository.ts
│       │           └── identity.module.ts
│       ├── test/
│       │   ├── health.e2e-spec.ts
│       │   ├── identity.domain.spec.ts
│       │   ├── identity.service.spec.ts
│       │   ├── identity.e2e-spec.ts
│       │   └── migration.integration.spec.ts
│       ├── package.json
│       └── tsconfig.json
└── .github/workflows/ci.yml
```

## Stable Interfaces

Later plans may depend on these signatures and HTTP contracts.

```typescript
export type RegistrationState =
  | "phone_pending"
  | "liveness_pending"
  | "completed"
  | "rejected"
  | "expired";

export interface OtpProvider {
  send(phoneE164: string): Promise<{
    providerChallengeId: string;
    expiresAt: Date;
  }>;
  verify(providerChallengeId: string, code: string): Promise<boolean>;
}

export interface LivenessProvider {
  start(registrationId: string): Promise<{
    providerSessionId: string;
    expiresAt: Date;
  }>;
  verify(providerSessionId: string, artifactToken: string): Promise<{
    live: boolean;
    adultLikely: boolean;
    adultConfidence: number;
    providerReference: string;
  }>;
}

export interface AccessTokenIssuer {
  issue(input: {
    memberId: string;
    adultVerified: true;
  }): Promise<string>;
}
```

```text
POST /v1/identity/registrations
Request:  { "phoneE164": "+821012345678", "declaredBirthDate": "1990-01-02" }
Response: 201 { "registrationId": "<uuid>", "state": "phone_pending", "otpExpiresAt": "<ISO-8601>" }

POST /v1/identity/registrations/{registrationId}/phone-verification
Request:  { "code": "246810" }
Response: 200 { "registrationId": "<uuid>", "state": "liveness_pending", "livenessSessionId": "local-live-<uuid>", "expiresAt": "<ISO-8601>" }

POST /v1/identity/registrations/{registrationId}/completion
Request:  { "livenessArtifactToken": "local-live-adult" }
Response: 201 { "accessToken": "<jwt>", "member": { "id": "<uuid>", "adultVerified": true } }
```

---

### Task 1: Reproducible Monorepo and Architecture Guard

**Files:**
- Create: `.nvmrc`
- Create: `.editorconfig`
- Create: `package.json`
- Create: `scripts/verify-layout.mjs`
- Modify: `.gitignore`
- Create: `README.md`

**Interfaces:**
- Consumes: None.
- Produces: root commands `npm run check:layout`, `npm run check`, and workspace location `services/core-api`.

- [ ] **Step 1: Write the failing repository layout guard**

Create `scripts/verify-layout.mjs`:

```javascript
import { access } from "node:fs/promises";

const required = [
  "apps",
  "services",
  "infra",
  "docs/superpowers/specs/2026-08-21-chingume-global-platform-design.md",
];

const failures = [];
for (const path of required) {
  try {
    await access(new URL("../" + path, import.meta.url));
  } catch {
    failures.push(path);
  }
}

if (failures.length > 0) {
  console.error("Missing required paths: " + failures.join(", "));
  process.exit(1);
}
```

- [ ] **Step 2: Run the guard and verify it fails**

Run: `node scripts/verify-layout.mjs`

Expected: exit code 1 with `Missing required paths: apps, services, infra`.

- [ ] **Step 3: Create the root toolchain files**

Create `.nvmrc`:

```text
24.19.0
```

Create `package.json`:

```json
{
  "name": "chingume",
  "version": "0.0.0",
  "private": true,
  "engines": {
    "node": "24.19.0"
  },
  "workspaces": [
    "services/*"
  ],
  "scripts": {
    "check:layout": "node scripts/verify-layout.mjs",
    "check:api": "npm --workspace @chingume/core-api run check",
    "test:api": "npm --workspace @chingume/core-api test",
    "check": "npm run check:layout && npm run check:api && npm run test:api"
  }
}
```

Create `.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.dart]
indent_size = 2
```

Append to `.gitignore`:

```gitignore
node_modules/
coverage/
dist/
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
build/
*.iml
.env
.env.*
!.env.example
```

Create the empty directories `apps`, `services`, and `infra` with a tracked `.gitkeep` in each. Add a `README.md` containing the Node/Flutter prerequisites and the commands from this plan.

- [ ] **Step 4: Run the guard and verify it passes**

Run: `node scripts/verify-layout.mjs`

Expected: exit code 0 and no output.

- [ ] **Step 5: Commit**

```bash
git add ChinguMe/.nvmrc ChinguMe/.editorconfig ChinguMe/.gitignore ChinguMe/package.json ChinguMe/README.md ChinguMe/scripts ChinguMe/apps ChinguMe/services ChinguMe/infra
git commit -m "chore: initialize ChinguMe monorepo"
```

---

### Task 2: Core API Health, Configuration, and Safe Errors

**Files:**
- Create: `services/core-api/package.json`
- Create: `services/core-api/tsconfig.json`
- Create: `services/core-api/jest.config.cjs`
- Create: `services/core-api/src/main.ts`
- Create: `services/core-api/src/app.module.ts`
- Create: `services/core-api/src/platform/config/env.ts`
- Create: `services/core-api/src/platform/http/problem-details.filter.ts`
- Create: `services/core-api/src/platform/logging/redact.ts`
- Create: `services/core-api/src/modules/health/health.controller.ts`
- Test: `services/core-api/test/health.e2e-spec.ts`

**Interfaces:**
- Consumes: root npm workspace.
- Produces: `GET /health/live` and `GET /health/ready` returning `{ status, service }`; `loadEnv(input)`; global problem-details responses.

- [ ] **Step 1: Scaffold the API workspace and install locked dependencies**

Create `services/core-api/package.json`:

```json
{
  "name": "@chingume/core-api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start:dev": "nest start --watch",
    "check": "tsc --noEmit",
    "test": "jest --runInBand",
    "test:e2e": "jest --runInBand --testMatch='**/*.e2e-spec.ts'"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-fastify": "^11.0.0",
    "fastify": "^5.0.0",
    "jose": "^6.0.0",
    "pg": "^8.0.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.0",
    "uuid": "^11.0.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/jest": "^30.0.0",
    "@types/node": "^24.0.0",
    "@types/pg": "^8.0.0",
    "@types/supertest": "^6.0.0",
    "jest": "^30.0.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.9.0"
  }
}
```

Create `services/core-api/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "commonjs",
    "moduleResolution": "node",
    "rootDir": ".",
    "outDir": "dist",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

Create `services/core-api/jest.config.cjs`:

```javascript
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
  collectCoverageFrom: ["src/**/*.ts"],
  coverageDirectory: "coverage",
  testEnvironment: "node",
};
```

Run `npm install` from the ChinguMe root to produce `package-lock.json`.

- [ ] **Step 2: Write the failing health endpoint test**

Create `services/core-api/test/health.e2e-spec.ts`:

```typescript
import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("health endpoints", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => app.close());

  it.each(["/health/live", "/health/ready"])("GET %s", async (path) => {
    const response = await request(app.getHttpServer()).get(path).expect(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "chingume-core-api",
    });
    expect(response.headers["x-request-id"]).toBeDefined();
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `npm --workspace @chingume/core-api run test:e2e -- health.e2e-spec.ts`

Expected: FAIL because `AppModule` does not exist.

- [ ] **Step 4: Implement the minimal health vertical slice**

Create `health.controller.ts`:

```typescript
import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get("live")
  live() {
    return { status: "ok", service: "chingume-core-api" };
  }

  @Get("ready")
  ready() {
    return { status: "ok", service: "chingume-core-api" };
  }
}
```

Create `app.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { HealthController } from "./modules/health/health.controller";

@Module({
  controllers: [HealthController],
})
export class AppModule {}
```

Create `env.ts`:

```typescript
import { z } from "zod";

const schema = z.object({
  APP_ENV: z.enum(["local", "test", "staging", "production"]),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  PHONE_HMAC_SECRET: z.string().min(32),
  JWT_SIGNING_SECRET: z.string().min(32),
  IDENTITY_PROVIDER_MODE: z.enum(["local", "managed"]),
});

export type AppEnv = z.infer<typeof schema>;

export function loadEnv(input: NodeJS.ProcessEnv): AppEnv {
  const value = schema.parse(input);
  if (
    value.IDENTITY_PROVIDER_MODE === "local" &&
    !["local", "test"].includes(value.APP_ENV)
  ) {
    throw new Error("local identity providers are forbidden outside local/test");
  }
  return value;
}
```

Create `main.ts` with Fastify, a request-ID hook, global validation, and the problem-details filter. The filter must return `type`, `title`, `status`, `detail`, `instance`, and `requestId` and must never include stack traces or request bodies.

- [ ] **Step 5: Test redaction explicitly**

Create `redact.ts` with a recursive redactor for keys matching `phoneE164`, `code`, `livenessArtifactToken`, `authorization`, `apiKey`, and `secret`. Add unit cases proving nested arrays and mixed-case keys are replaced with `[REDACTED]`.

Run: `npm --workspace @chingume/core-api test`

Expected: all health and redaction tests PASS.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/package-lock.json ChinguMe/services/core-api
git commit -m "feat: add core API health and safe error foundation"
```

---

### Task 3: Adult Identity Domain Rules

**Files:**
- Create: `services/core-api/src/modules/identity/domain/member.ts`
- Create: `services/core-api/src/modules/identity/domain/registration.ts`
- Test: `services/core-api/test/identity.domain.spec.ts`

**Interfaces:**
- Consumes: UTC `Date` values.
- Produces: `isAtLeast18(birthDate, now): boolean`, `Registration` state transitions, and `AdultMember`.

- [ ] **Step 1: Write failing age-boundary and state-transition tests**

Create `identity.domain.spec.ts`:

```typescript
import {
  isAtLeast18,
  startRegistration,
  markPhoneVerified,
  completeRegistration,
} from "../src/modules/identity/domain/registration";

describe("adult registration domain", () => {
  const now = new Date("2026-08-21T00:00:00.000Z");

  it("accepts the exact eighteenth birthday", () => {
    expect(isAtLeast18("2008-08-21", now)).toBe(true);
  });

  it("rejects a person one day short of eighteen", () => {
    expect(isAtLeast18("2008-08-22", now)).toBe(false);
  });

  it("requires phone verification before liveness completion", () => {
    const registration = startRegistration({
      id: "0198c000-0000-7000-8000-000000000001",
      phoneHash: "a".repeat(64),
      phoneLast4: "5678",
      declaredBirthDate: "1990-01-02",
      otpExpiresAt: new Date("2026-08-21T00:05:00.000Z"),
      now,
    });
    expect(() =>
      completeRegistration(registration, {
        providerReference: "live-1",
        adultConfidence: 0.99,
        now,
      }),
    ).toThrow("phone verification required");
  });

  it("completes after phone and adult-liveness checks", () => {
    const registration = startRegistration({
      id: "0198c000-0000-7000-8000-000000000001",
      phoneHash: "a".repeat(64),
      phoneLast4: "5678",
      declaredBirthDate: "1990-01-02",
      otpExpiresAt: new Date("2026-08-21T00:05:00.000Z"),
      now,
    });
    const verified = markPhoneVerified(registration, now);
    const completed = completeRegistration(verified, {
      providerReference: "live-1",
      adultConfidence: 0.99,
      now,
    });
    expect(completed.state).toBe("completed");
    expect(completed.adultVerifiedAt).toEqual(now);
  });
});
```

- [ ] **Step 2: Run the domain test and verify it fails**

Run: `npm --workspace @chingume/core-api test -- identity.domain.spec.ts`

Expected: FAIL because the registration domain functions do not exist.

- [ ] **Step 3: Implement UTC age calculation and immutable transitions**

Implement `isAtLeast18` by parsing `YYYY-MM-DD` into UTC year/month/day and comparing the eighteenth birthday to `now`. Reject invalid calendar dates. Implement transitions that return new objects and throw domain errors for expired, reordered, repeated, non-live, or non-adult completion.

Use these exact exported shapes:

```typescript
export type Registration = {
  id: string;
  phoneHash: string;
  phoneLast4: string;
  declaredBirthDate: string;
  state: "phone_pending" | "liveness_pending" | "completed" | "rejected" | "expired";
  otpExpiresAt: Date;
  phoneVerifiedAt?: Date;
  livenessProviderReference?: string;
  adultConfidence?: number;
  adultVerifiedAt?: Date;
};

export type AdultMember = {
  id: string;
  adultVerified: true;
  adultVerifiedAt: Date;
  status: "active";
};
```

- [ ] **Step 4: Run domain tests**

Run: `npm --workspace @chingume/core-api test -- identity.domain.spec.ts`

Expected: PASS for exact birthday, one-day-underage, transition ordering, expiration, duplicate completion, and non-adult rejection.

- [ ] **Step 5: Commit**

```bash
git add ChinguMe/services/core-api/src/modules/identity/domain ChinguMe/services/core-api/test/identity.domain.spec.ts
git commit -m "feat: define adult identity domain rules"
```

---

### Task 4: PostgreSQL Identity Schema and Repository

**Files:**
- Create: `infra/local/compose.yaml`
- Create: `services/core-api/migrations/001_identity.sql`
- Create: `services/core-api/src/platform/database/database.ts`
- Create: `services/core-api/src/modules/identity/application/ports.ts`
- Create: `services/core-api/src/modules/identity/adapters/persistence/postgres-identity.repository.ts`
- Test: `services/core-api/test/migration.integration.spec.ts`

**Interfaces:**
- Consumes: `Registration` and `AdultMember` domain values.
- Produces: `IdentityRepository` with registration and member transactions.

- [ ] **Step 1: Write the repository port**

Create `application/ports.ts`:

```typescript
import { AdultMember } from "../domain/member";
import { Registration } from "../domain/registration";

export interface IdentityRepository {
  createRegistration(input: Registration & {
    otpProviderChallengeId: string;
  }): Promise<void>;
  findRegistration(id: string): Promise<
    | (Registration & {
        otpProviderChallengeId: string;
        livenessProviderSessionId?: string;
      })
    | null
  >;
  savePhoneVerified(input: {
    registration: Registration;
    livenessProviderSessionId: string;
    livenessExpiresAt: Date;
  }): Promise<void>;
  completeRegistration(input: {
    registration: Registration;
    member: AdultMember;
  }): Promise<void>;
  findMemberByPhoneHash(phoneHash: string): Promise<AdultMember | null>;
}
```

- [ ] **Step 2: Write the failing migration integration test**

The test starts from a clean database, applies `001_identity.sql`, and asserts that these tables exist: `identity_registrations`, `members`, and `identity_audit_events`. It inserts two registrations with the same phone hash and expects the second active registration to fail with a unique constraint.

Run:

```bash
docker compose -f infra/local/compose.yaml up -d postgres
npm --workspace @chingume/core-api test -- migration.integration.spec.ts
```

Expected: FAIL because the compose file and migration are absent.

- [ ] **Step 3: Create the local PostgreSQL service**

Create `infra/local/compose.yaml`:

```yaml
services:
  postgres:
    image: postgres:18.4-alpine
    environment:
      POSTGRES_DB: chingume
      POSTGRES_USER: chingume
      POSTGRES_PASSWORD: local-only-password
    ports:
      - "54329:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chingume -d chingume"]
      interval: 2s
      timeout: 2s
      retries: 20
    volumes:
      - chingume-postgres:/var/lib/postgresql/data

volumes:
  chingume-postgres:
```

- [ ] **Step 4: Create the identity migration**

Create `001_identity.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE identity_registration_state AS ENUM (
  'phone_pending',
  'liveness_pending',
  'completed',
  'rejected',
  'expired'
);

CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  phone_hash char(64) NOT NULL UNIQUE,
  phone_last4 char(4) NOT NULL CHECK (phone_last4 ~ '^[0-9]{4}$'),
  adult_verified boolean NOT NULL CHECK (adult_verified),
  adult_verified_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'suspended', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE identity_registrations (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  phone_hash char(64) NOT NULL,
  phone_last4 char(4) NOT NULL CHECK (phone_last4 ~ '^[0-9]{4}$'),
  declared_birth_date date NOT NULL,
  state identity_registration_state NOT NULL,
  otp_provider_challenge_id text NOT NULL,
  otp_expires_at timestamptz NOT NULL,
  otp_attempts smallint NOT NULL DEFAULT 0 CHECK (otp_attempts BETWEEN 0 AND 6),
  phone_verified_at timestamptz,
  liveness_provider_session_id text,
  liveness_expires_at timestamptz,
  liveness_provider_reference text,
  adult_confidence numeric(5,4) CHECK (
    adult_confidence IS NULL OR adult_confidence BETWEEN 0 AND 1
  ),
  adult_verified_at timestamptz,
  completed_member_id uuid REFERENCES members(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX identity_registrations_one_active_phone
ON identity_registrations (phone_hash)
WHERE state IN ('phone_pending', 'liveness_pending');

CREATE TABLE identity_audit_events (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  registration_id uuid REFERENCES identity_registrations(id),
  member_id uuid REFERENCES members(id),
  event_type text NOT NULL,
  request_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX identity_audit_events_registration_time
ON identity_audit_events (registration_id, occurred_at);

REVOKE UPDATE, DELETE ON identity_audit_events FROM PUBLIC;
```

The migration contains no phone, OTP, selfie, or liveness artifact columns.

- [ ] **Step 5: Implement the transaction-safe repository**

Create a `Database` wrapper around `pg.Pool` with `transaction<T>(work)`. Implement `completeRegistration` in one transaction that:

1. selects the registration `FOR UPDATE`;
2. rejects non-`liveness_pending` state;
3. inserts the member;
4. updates the registration to `completed`;
5. inserts an `identity.registration_completed` audit event.

Map PostgreSQL unique violation `23505` to a domain-level `identity_already_exists` error.

Implement `savePhoneVerified` as a compare-and-swap update with `WHERE id = $1 AND state = 'phone_pending'`. Require exactly one updated row so two concurrent OTP submissions cannot create two liveness sessions. `findRegistration` performs a normal read; state-changing methods own their transaction and locking boundary.

- [ ] **Step 6: Run migration and repository tests**

Run:

```bash
npm --workspace @chingume/core-api test -- migration.integration.spec.ts
npm --workspace @chingume/core-api test
```

Expected: all tests PASS and no test output contains `+821012345678` or `local-live-adult`.

- [ ] **Step 7: Commit**

```bash
git add ChinguMe/infra/local/compose.yaml ChinguMe/services/core-api/migrations ChinguMe/services/core-api/src/platform/database ChinguMe/services/core-api/src/modules/identity ChinguMe/services/core-api/test/migration.integration.spec.ts
git commit -m "feat: persist adult identity registrations"
```

---

### Task 5: Provider-Neutral Onboarding API and Local Adapters

**Files:**
- Create: `services/core-api/src/platform/security/hmac.ts`
- Create: `services/core-api/src/platform/security/jwt-access-token.issuer.ts`
- Create: `services/core-api/src/modules/identity/application/identity.service.ts`
- Create: `services/core-api/src/modules/identity/adapters/local/local-otp.provider.ts`
- Create: `services/core-api/src/modules/identity/adapters/local/local-liveness.provider.ts`
- Create: `services/core-api/src/modules/identity/adapters/http/identity.controller.ts`
- Create: `services/core-api/src/modules/identity/identity.module.ts`
- Test: `services/core-api/test/identity.service.spec.ts`
- Test: `services/core-api/test/identity.e2e-spec.ts`

**Interfaces:**
- Consumes: `OtpProvider`, `LivenessProvider`, `IdentityRepository`, `AccessTokenIssuer`.
- Produces: the three stable identity HTTP endpoints and JWT claims `sub`, `adult_verified`, `iss`, `aud`, `exp`.

- [ ] **Step 1: Write failing application-service tests**

Use an in-memory repository and spies to prove:

- under-18 birth dates fail before `OtpProvider.send`;
- E.164-invalid phone values fail before hashing;
- the persisted value is a 64-character HMAC and not the input phone;
- wrong OTP increments attempts and rejects the sixth attempt;
- expired OTP never starts liveness;
- non-live or non-adult liveness marks registration rejected;
- successful completion creates one member; a retry returns that member with a new short-lived token;
- existing phone hash returns `identity_already_exists`.

Run: `npm --workspace @chingume/core-api test -- identity.service.spec.ts`

Expected: FAIL because `IdentityService` does not exist.

- [ ] **Step 2: Implement keyed phone hashing**

Create `hmac.ts`:

```typescript
import { createHmac } from "node:crypto";

export function phoneHash(phoneE164: string, secret: string): string {
  return createHmac("sha256", secret).update(phoneE164, "utf8").digest("hex");
}
```

Normalize only strict E.164 input matching `^\\+[1-9]\\d{7,14}$`. Do not attempt country-specific guessing on the server.

Generate registration and member identifiers with `v7()` from the `uuid` package before applying domain transitions. Tests must assert UUID version 7 and inject an ID generator so fixtures remain deterministic.

- [ ] **Step 3: Implement deterministic local providers**

`LocalOtpProvider` uses code `246810` and a five-minute expiry. `LocalLivenessProvider` accepts only:

- `local-live-adult` → live, adultLikely, confidence 0.99;
- `local-live-underage` → live, not adultLikely, confidence 0.99;
- `local-spoof` → not live, not adultLikely, confidence 0.99.

Both adapters throw during construction when `APP_ENV` is not `local` or `test`.

- [ ] **Step 4: Implement IdentityService**

Expose these methods:

```typescript
startRegistration(input: {
  phoneE164: string;
  declaredBirthDate: string;
  now: Date;
}): Promise<{
  registrationId: string;
  state: "phone_pending";
  otpExpiresAt: Date;
}>;

verifyPhone(input: {
  registrationId: string;
  code: string;
  now: Date;
}): Promise<{
  registrationId: string;
  state: "liveness_pending";
  livenessSessionId: string;
  expiresAt: Date;
}>;

completeRegistration(input: {
  registrationId: string;
  livenessArtifactToken: string;
  now: Date;
}): Promise<{
  accessToken: string;
  member: { id: string; adultVerified: true };
}>;
```

Require an adult-confidence threshold of 0.90 for the local contract. Return the same member result for a completed-registration retry and never create a second member.

- [ ] **Step 5: Write the failing HTTP acceptance test**

Create `identity.e2e-spec.ts` and run the exact local sequence:

```typescript
const started = await request(server)
  .post("/v1/identity/registrations")
  .send({
    phoneE164: "+821012345678",
    declaredBirthDate: "1990-01-02",
  })
  .expect(201);

const phoneVerified = await request(server)
  .post(
    "/v1/identity/registrations/" +
      started.body.registrationId +
      "/phone-verification",
  )
  .send({ code: "246810" })
  .expect(200);

expect(phoneVerified.body.state).toBe("liveness_pending");

const completed = await request(server)
  .post(
    "/v1/identity/registrations/" +
      started.body.registrationId +
      "/completion",
  )
  .send({ livenessArtifactToken: "local-live-adult" })
  .expect(201);

expect(completed.body.member.adultVerified).toBe(true);
expect(completed.body.accessToken.split(".")).toHaveLength(3);
```

Add negative HTTP cases for underage `422`, wrong OTP `401`, expired registration `410`, spoof `422`, duplicate identity `409`, and unknown registration `404`. Assert problem-details content type and request ID.

- [ ] **Step 6: Implement the minimal access-token issuer**

Create `jwt-access-token.issuer.ts` with `jose`. Sign HS256 tokens with a 15-minute expiry, issuer `https://api.chingume.app`, audience `chingume-mobile`, subject `memberId`, and boolean claim `adult_verified: true`. Unit tests decode the token and prove that phone hash, phone suffix, birth date, liveness reference, and registration ID are absent.

- [ ] **Step 7: Implement controller and dependency wiring**

Use DTO schemas at the HTTP boundary and map domain error codes to stable problem types such as `https://chingume.app/problems/identity/underage`. Register local provider adapters only in local/test configuration. Register development HMAC/JWT secrets through environment variables, never source constants.

- [ ] **Step 8: Run all API tests**

Run:

```bash
npm --workspace @chingume/core-api run check
npm --workspace @chingume/core-api test
```

Expected: typecheck PASS and all identity tests PASS.

- [ ] **Step 9: Commit**

```bash
git add ChinguMe/services/core-api/src ChinguMe/services/core-api/test
git commit -m "feat: add adult onboarding API"
```

---

### Task 6: Dual Friends/Dating Flutter App Shell

**Files:**
- Create: `apps/mobile/pubspec.yaml`
- Create: `apps/mobile/lib/main_friends.dart`
- Create: `apps/mobile/lib/main_dating.dart`
- Create: `apps/mobile/lib/config/app_config.dart`
- Create: `apps/mobile/lib/app/chingume_app.dart`
- Modify: `apps/mobile/android/app/build.gradle.kts`
- Create: `apps/mobile/ios/Flutter/friends.xcconfig`
- Create: `apps/mobile/ios/Flutter/dating.xcconfig`
- Test: `apps/mobile/test/config/app_config_test.dart`

**Interfaces:**
- Consumes: compile-time `APP_FLAVOR` and `API_BASE_URL`.
- Produces: `AppConfig.fromEnvironment()` and bundle IDs `app.chingume.friends` / `app.chingume.dating`.

- [ ] **Step 1: Generate the Flutter project**

Run from `apps`:

```bash
flutter create --platforms=android,ios --org app.chingume --project-name chingume_mobile mobile
```

Pin the SDK expectation in `pubspec.yaml` to Dart bundled with Flutter 3.47 and commit `pubspec.lock` after `flutter pub get`.

- [ ] **Step 2: Write the failing flavor configuration test**

```dart
import "package:flutter_test/flutter_test.dart";
import "package:chingume_mobile/config/app_config.dart";

void main() {
  test("friends and dating never share a bundle identifier", () {
    expect(AppConfig.friends.bundleId, "app.chingume.friends");
    expect(AppConfig.dating.bundleId, "app.chingume.dating");
    expect(AppConfig.friends.bundleId, isNot(AppConfig.dating.bundleId));
  });

  test("production refuses an insecure API URL", () {
    expect(
      () => AppConfig(
        flavor: AppFlavor.friends,
        apiBaseUrl: Uri.parse("http://api.chingume.app"),
        production: true,
      ),
      throwsArgumentError,
    );
  });
}
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `flutter test test/config/app_config_test.dart` from `apps/mobile`.

Expected: FAIL because `AppConfig` does not exist.

- [ ] **Step 4: Implement AppConfig and entrypoints**

```dart
enum AppFlavor { friends, dating }

final class AppConfig {
  AppConfig({
    required this.flavor,
    required this.apiBaseUrl,
    required this.production,
  }) {
    if (production && apiBaseUrl.scheme != "https") {
      throw ArgumentError("production API_BASE_URL must use https");
    }
  }

  final AppFlavor flavor;
  final Uri apiBaseUrl;
  final bool production;

  String get bundleId => switch (flavor) {
        AppFlavor.friends => "app.chingume.friends",
        AppFlavor.dating => "app.chingume.dating",
      };

  static final friends = AppConfig(
    flavor: AppFlavor.friends,
    apiBaseUrl: Uri.parse("http://127.0.0.1:3000"),
    production: false,
  );

  static final dating = AppConfig(
    flavor: AppFlavor.dating,
    apiBaseUrl: Uri.parse("http://127.0.0.1:3000"),
    production: false,
  );
}
```

`main_friends.dart` and `main_dating.dart` each pass the explicit flavor to `ChinguMeApp`. The app title and initial semantic label must identify Friends or Dating without relying on color alone.

- [ ] **Step 5: Configure native flavors**

Add Android product flavors `friends` and `dating` with matching `applicationId` values. Add iOS schemes/configurations whose `PRODUCT_BUNDLE_IDENTIFIER` values match the same IDs. Verify:

Add to the Android `android` block:

```kotlin
flavorDimensions += "product"
productFlavors {
    create("friends") {
        dimension = "product"
        applicationId = "app.chingume.friends"
        resValue("string", "app_name", "ChinguMe Friends")
    }
    create("dating") {
        dimension = "product"
        applicationId = "app.chingume.dating"
        resValue("string", "app_name", "ChinguMe Dating")
    }
}
```

Create `ios/Flutter/friends.xcconfig`:

```xcconfig
#include "Generated.xcconfig"
PRODUCT_BUNDLE_IDENTIFIER=app.chingume.friends
FLUTTER_TARGET=lib/main_friends.dart
PRODUCT_NAME=ChinguMe Friends
```

Create `ios/Flutter/dating.xcconfig`:

```xcconfig
#include "Generated.xcconfig"
PRODUCT_BUNDLE_IDENTIFIER=app.chingume.dating
FLUTTER_TARGET=lib/main_dating.dart
PRODUCT_NAME=ChinguMe Dating
```

Create Xcode schemes `friends` and `dating` that select these configurations for Run, Test, Profile, and Archive.

```bash
flutter build apk --debug --flavor friends -t lib/main_friends.dart
flutter build apk --debug --flavor dating -t lib/main_dating.dart
```

Expected: both APKs build and have different application IDs.

- [ ] **Step 6: Run Flutter checks**

Run:

```bash
flutter analyze
flutter test
```

Expected: no analyzer findings and all flavor tests PASS.

- [ ] **Step 7: Commit**

```bash
git add ChinguMe/apps/mobile
git commit -m "feat: add Friends and Dating mobile flavors"
```

---

### Task 7: Mobile Adult Onboarding Vertical Slice

**Files:**
- Create: `apps/mobile/lib/features/onboarding/domain/identity_api.dart`
- Create: `apps/mobile/lib/features/onboarding/data/http_identity_api.dart`
- Create: `apps/mobile/lib/features/onboarding/application/onboarding_controller.dart`
- Create: `apps/mobile/lib/features/onboarding/presentation/onboarding_screen.dart`
- Modify: `apps/mobile/lib/app/chingume_app.dart`
- Test: `apps/mobile/test/features/onboarding/onboarding_screen_test.dart`

**Interfaces:**
- Consumes: the three identity HTTP endpoints from Task 5.
- Produces: `IdentityApi`, `OnboardingController`, and a reusable adult onboarding screen shared by both flavors.

- [ ] **Step 1: Define the Dart API port**

Run `flutter pub add http` and commit the updated `pubspec.yaml` and `pubspec.lock` with this task.

```dart
abstract interface class IdentityApi {
  Future<RegistrationStarted> startRegistration({
    required String phoneE164,
    required DateTime declaredBirthDate,
  });

  Future<LivenessStarted> verifyPhone({
    required String registrationId,
    required String code,
  });

  Future<RegistrationCompleted> completeRegistration({
    required String registrationId,
    required String livenessArtifactToken,
  });
}
```

Define immutable response records with exactly the JSON fields in Stable Interfaces. `HttpIdentityApi` must attach `X-Request-ID`, use a 10-second timeout, parse problem-details, and never log request bodies.

- [ ] **Step 2: Write the failing widget journey test**

Use a fake `IdentityApi` and verify:

1. phone and birth date submission calls `startRegistration`;
2. an API underage problem shows the Korean message `만 18세 이상만 가입할 수 있습니다.`;
3. OTP `246810` advances to liveness;
4. completing with the fake local artifact shows the verified state;
5. Friends and Dating render the same safety copy but different product titles;
6. every text field has a semantic label and errors receive accessibility announcements.

Run: `flutter test test/features/onboarding/onboarding_screen_test.dart`

Expected: FAIL because the onboarding UI does not exist.

- [ ] **Step 3: Implement a deterministic state machine**

`OnboardingController` states are:

```dart
sealed class OnboardingState {}
final class EnteringIdentity extends OnboardingState {}
final class SendingOtp extends OnboardingState {}
final class EnteringOtp extends OnboardingState {
  EnteringOtp(this.registrationId);
  final String registrationId;
}
final class CheckingLiveness extends OnboardingState {
  CheckingLiveness(this.registrationId);
  final String registrationId;
}
final class VerifiedAdult extends OnboardingState {
  VerifiedAdult(this.accessToken, this.memberId);
  final String accessToken;
  final String memberId;
}
final class OnboardingFailure extends OnboardingState {
  OnboardingFailure(this.message, this.recoverable);
  final String message;
  final bool recoverable;
}
```

Reject concurrent submissions, preserve `registrationId` across recoverable failures, and clear phone/OTP controller text after successful completion.

- [ ] **Step 4: Implement the screen and local liveness bridge**

For this plan, the liveness button sends `local-live-adult` only in debug builds. In profile/release builds, the button must be disabled with the message `관리형 생체활성 공급자가 구성되지 않았습니다.` so a production build cannot silently use the fake.

Do not persist the access token yet. Pass it to an in-memory authenticated app state; secure storage is added when authenticated messaging begins in Plan 2.

- [ ] **Step 5: Run mobile tests and local manual smoke**

Run:

```bash
flutter analyze
flutter test
flutter run --flavor friends -t lib/main_friends.dart --dart-define=API_BASE_URL=http://127.0.0.1:3000
```

Expected manual path: adult test user + OTP `246810` + local live artifact reaches `VerifiedAdult`. An underage date never receives OTP. Dating flavor follows the same identity flow with Dating branding.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/apps/mobile/lib ChinguMe/apps/mobile/test
git commit -m "feat: add mobile adult onboarding flow"
```

---

### Task 8: CI, Security Checks, and Fresh-Clone Verification

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `services/core-api/.env.example`
- Modify: `package.json`
- Modify: `README.md`
- Test: all existing API and mobile tests

**Interfaces:**
- Consumes: all outputs from Tasks 1–7.
- Produces: one reproducible `npm run verify` entrypoint and CI status required before later plans.

- [ ] **Step 1: Add a root verification command**

Update root `package.json` to expose these scripts:

```json
{
  "scripts": {
    "check:layout": "node scripts/verify-layout.mjs",
    "check:api": "npm --workspace @chingume/core-api run check",
    "test:api": "npm --workspace @chingume/core-api test",
    "verify": "npm run check:layout && npm run check:api && npm run test:api"
  }
}
```

Keep only one copy of each script key when merging.

- [ ] **Step 2: Add CI with separate API and Flutter jobs**

Create `ci.yml`:

```yaml
name: ChinguMe CI

on:
  push:
    paths:
      - "ChinguMe/**"
  pull_request:
    paths:
      - "ChinguMe/**"

concurrency:
  group: chingume-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  api:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ChinguMe
    services:
      postgres:
        image: postgres:18.4-alpine
        env:
          POSTGRES_DB: chingume
          POSTGRES_USER: chingume
          POSTGRES_PASSWORD: ci-only-password
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U chingume -d chingume"
          --health-interval 2s
          --health-timeout 2s
          --health-retries 20
    env:
      APP_ENV: test
      DATABASE_URL: postgresql://chingume:ci-only-password@127.0.0.1:5432/chingume
      PHONE_HMAC_SECRET: ci-phone-hmac-secret-at-least-32-characters
      JWT_SIGNING_SECRET: ci-jwt-signing-secret-at-least-32-characters
      IDENTITY_PROVIDER_MODE: local
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24.19.0
          cache: npm
          cache-dependency-path: ChinguMe/package-lock.json
      - run: npm ci
      - run: npm run check:api
      - run: npm run test:api

  mobile-android:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ChinguMe/apps/mobile
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: 3.47.0
          channel: stable
          cache: true
      - run: flutter pub get
      - run: flutter analyze
      - run: flutter test
      - run: flutter build apk --debug --flavor friends -t lib/main_friends.dart
      - run: flutter build apk --debug --flavor dating -t lib/main_dating.dart

  mobile-ios:
    runs-on: macos-15
    defaults:
      run:
        working-directory: ChinguMe/apps/mobile
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: 3.47.0
          channel: stable
          cache: true
      - run: flutter pub get
      - run: flutter build ios --simulator --debug --flavor friends -t lib/main_friends.dart
      - run: flutter build ios --simulator --debug --flavor dating -t lib/main_dating.dart
```

Do not upload `.env`, database dumps, tokens, screenshots, raw request logs, or mobile build artifacts from identity tests.

- [ ] **Step 3: Add secret-leak assertions**

Add an API test that serializes all problem responses from identity negative cases and asserts none contain:

```text
+821012345678
246810
local-live-adult
PHONE_HMAC_SECRET
JWT_SIGNING_SECRET
```

Add a repository scan command using `git grep` over tracked files to reject private-key headers and assignments to production-looking API-key names.

- [ ] **Step 4: Verify from a clean local state**

Run:

```bash
docker compose -f infra/local/compose.yaml up -d postgres
npm ci
npm run verify
cd apps/mobile
flutter pub get
flutter analyze
flutter test
flutter build apk --debug --flavor friends -t lib/main_friends.dart
flutter build apk --debug --flavor dating -t lib/main_dating.dart
```

Expected: every command exits 0. No generated build output is tracked.

- [ ] **Step 5: Update README with exact operator commands**

Document:

- prerequisite versions;
- local PostgreSQL start/stop;
- required local environment variables;
- API start and health checks;
- Friends/Dating run commands;
- local OTP/liveness values and the warning that they are forbidden outside local/test;
- full verification command;
- link to the master spec and program roadmap.

- [ ] **Step 6: Commit**

```bash
git add ChinguMe/.github ChinguMe/package.json ChinguMe/services/core-api/.env.example ChinguMe/README.md ChinguMe/services/core-api/test
git commit -m "ci: verify ChinguMe foundation and identity"
```

---

## Plan Acceptance Gate

Before starting Program Roadmap Plan 2, verify all of the following:

- [ ] A clean checkout passes `npm ci` and Flutter dependency resolution with locked files.
- [ ] PostgreSQL migration creates only hashed/minimized identity data.
- [ ] Exact eighteenth birthday succeeds and one-day-underage fails.
- [ ] Local providers cannot start in staging or production configuration.
- [ ] Successful registration returns a minimal adult-verified token.
- [ ] Duplicate, expired, spoof, wrong-code, and underage paths return stable problem details.
- [ ] No negative response or log fixture contains phone, OTP, liveness artifact, HMAC secret, or JWT secret.
- [ ] Friends and Dating Android builds use different application IDs.
- [ ] Friends and Dating iOS builds use different bundle identifiers.
- [ ] Both mobile flavors complete the same local verified-adult flow.
- [ ] API typecheck/tests and Flutter analyze/tests/builds pass in CI.

## Source Notes

- Node.js 24 is the current LTS line as of 2026-08-21: https://nodejs.org/en/blog/release
- NestJS 11 requires Node.js 20 or newer and supports Fastify 5: https://docs.nestjs.com/migration-guide
- Flutter 3.47 is the August 2026 stable release: https://docs.flutter.dev/release/release-notes
- PostgreSQL 18 is the current supported major version: https://www.postgresql.org/docs/18/
