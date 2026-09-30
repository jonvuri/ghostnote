---
title: Eight-arm matrix completes Gemini and retains Claude partial
kind: evidence
state: pending
updated: 2026-09-29
phase: phase-8-agent-native-live-engine
session: phase8c4f-eight-arm-matrix-claude-resume-blocked
---

# E203: Eight-arm matrix completes Gemini and retains Claude partial

The approved continuation repeated Gemini's source HTTP 503 and completed all
29 selected calls. Gemini now has 592 scored rows with no missing outcome. Its
continuation cost is USD 0.1151175.

Claude used a 24,000-token total limit with a 1,024-token thinking target. All
three source unavailable rows completed. Two later melody rows used the full
24,000 tokens in thinking and remain unavailable. Claude retained 57 scored
continuation rows at USD 1.175156.

Claude then received HTTP 503 at original sequence 195. A frozen resume
received another HTTP 503 from the token-count endpoint. A bounded retry plan
made two more resume executions. Each received three consecutive HTTP 503
responses from the token-count endpoint. They made no message call and added
no measured cost.

The current matrix has 592 scored OpenAI rows, 592 scored Gemini rows, and 192
scored Claude rows. Claude also has two unavailable rows, one failed row, and
397 unattempted rows. Do not count missing Claude rows as musical failures.

All retained prompt, task, candidate, and score identities reproduce. The
continued assessment hash is
`798ee368a704a6560e3b4202d91d632f4be3e732b6578f31668c94fc270dccad`.
Exact cost across the original run and successful continuation calls is USD
8.37863725.

The provider status page reported the Claude API as operational during the
token-count failures. The observed endpoint responses remain authoritative for
this run. A later resume must keep the retained results, use a bounded HTTP 503
policy, and receive explicit approval before a paid message call.
