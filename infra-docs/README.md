# Infra Docs

Cross-project infrastructure documentation for all Steven Lim projects.

## Contents

- **[ai-shared-registry.md](ai-shared-registry.md)** — Single Source of Truth (SSOT) for all AI
  resources (open-source models, API keys, shared GPU server, ports) used by TwinverseAI,
  SodamFN, and any future projects.

## Scope

This repository is **infrastructure-only** — it does not belong to any single application.
It captures decisions and state that span multiple projects:

- Shared servers (twinverse-ai, GPU PC, Orbitron)
- Shared AI models and API providers
- Port assignments across the LAN
- Cross-project conventions (env var naming, fallback cascades)

## Update Rule

When you change anything in `ai-shared-registry.md`, you **must** also update the affected
projects' `.env` / `Orbitron.yaml` / docs in the same session. Never let this repo drift
from the projects that depend on it.

See `ai-shared-registry.md` section 9 ("변경 절차") for the full procedure.

## References From

- `c:\WORK\TwinverseAI\CLAUDE.md` — "AI 리소스 공유 규칙" section
- `c:\WORK\SodamFN\CLAUDE.md` — "AI 리소스 공유 규칙" section
