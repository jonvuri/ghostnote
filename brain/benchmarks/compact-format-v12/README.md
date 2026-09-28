# Compact format fresh comparison v12

This package compares exact-object JSON, positional compact-bar v1, and
compact-bar `FIELDS` on fresh analysis, motif, and progression fixtures.

The analysis output contract is neutral. Its payload contains the eight
analysis field assignments. A leading legacy `ANALYSIS` label is optional and
does not affect scoring. This label is not part of the public music format.

The package retains the validated v11 prompt repairs:

- the `FIELDS` declaration is an exact row in its own block;
- every note row has exactly six values after `N`;
- input delimiters do not resemble output rows; and
- literal header values, including `BASE none`, are explicit.

Each provider receives eight unique cases per family and one repeated
sentinel per arm and family. The run makes at most 81 message requests per
provider and 243 in total. It makes no repair call or automatic retry.

Run the offline check from `brain/`:

```sh
npm run benchmark:compact-format-v12
```

Provider work requires an approved record that matches the exact protocol and
run-plan hashes.
