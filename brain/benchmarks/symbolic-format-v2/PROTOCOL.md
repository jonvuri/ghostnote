# Phase 8c3 retained protocol

The protocol uses the same generated semantic fixture for each eligible arm.
It sends one focused task per call. Each provider uses its low-effort setting,
default temperature, and a 7,000-token output limit.

The providers and requested models are:

| Provider | Model |
|---|---|
| OpenAI | `gpt-5.4-mini-2026-03-17` |
| Gemini | `gemini-3.8-flash` |
| Claude | `claude-sonnet-5` |

The run records requested and returned models, settings, prompt and response
hashes, usage, cached usage, latency, retries, stop reason, cost, and raw
response hash. It retries only rate-limit, transport, and provider-server
failures. It does not retry a valid low-scoring response.

The first response and the exact-feedback repair stay separate. A missing
provider result is unavailable. It is not a zero score. A provider run is
complete only when it has no transport error or output-limit stop.

The summary reports each provider and task family before pooled totals. Every
format delta uses paired fresh fixtures and states its denominator. Musical,
syntax, identity, preservation, size, token, latency, cost, nondeterminism,
and provider variation stay separate.

The terminal decision is:

- `proceed` when tuple JSON or the exact-object fallback passes all frozen
  gates;
- `revise` when no arm passes, but one full-capability arm misses at most three
  paired comparison gates; or
- `block` when the provider evidence is incomplete or neither full-capability
  arm supports one bounded revision.

Do not revise a format against this retained cohort.
