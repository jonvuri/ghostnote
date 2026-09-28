# Compact format local-label diagnostic v13

This package compares current compact-bar `FIELDS` with one compact variant
that repeats short labels on every note row. It runs only on Gemini.

The diagnostic reuses four audited v12 stress cases. Each arm runs four times
per case. The package makes at most 32 message requests. It makes no repair
call and no automatic retry.

The case selection is intentionally post-hoc. The result can decide whether
the local-label variant is worth its added size. It cannot estimate a fresh
family effect, select a public format, or start holdout.

Run the offline check from `brain/`:

```sh
npm run benchmark:compact-format-v13
```

Provider work requires an approved record that matches the exact protocol and
run-plan hashes.
