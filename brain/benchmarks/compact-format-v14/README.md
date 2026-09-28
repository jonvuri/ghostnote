# Compact format hardened holdout v14

This package freezes the corrected targeted holdout. It compares only
compact-bar `FIELDS`, compact-bar local labels, and exact-object JSON.

The package uses a fresh cohort. It does not reuse the reserved v10 holdout.
It has two decision families and one serialization guard. It runs two
predeclared repeats for each decision fixture. It makes no repair call and no
automatic retry.

The offline check makes no network or provider request. Run it from `brain/`:

```sh
npm run benchmark:compact-format-v14
```

Provider work needs a new approval record that matches the exact protocol and
run-plan hashes. No approval record is part of this package.
