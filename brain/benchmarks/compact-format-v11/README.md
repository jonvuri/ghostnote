# Compact format prompt screen v11

This package runs a small diagnostic screen after the Phase 8c4c failure
audit. It does not select a format or enter holdout.

The screen reuses four audited development cases. Two cases test input
comprehension with one shared `ANALYSIS` output. Two cases test output
serialization without an input document. Every provider runs all three arms
twice. The maximum is 24 message requests per provider and 72 in total.

The prompt removes these known ambiguities:

- `line` cannot look like a seventh `FIELDS` column;
- input delimiters do not resemble output rows;
- the literal `none` base value is explicit; and
- analysis names the input representation separately from its output grammar.

Strict results remain authoritative for public-format conformance. The report
also gives a diagnostic score after four predeclared mechanical recoveries.
The diagnostic score does not replace the strict result.

No repair call is allowed. A failed token-count or message request is not
retried without new operator approval.

Run the offline check from `brain/`:

```sh
npm run benchmark:compact-format-v11
```

Provider work requires an approved record that matches the exact protocol and
run-plan hashes.
