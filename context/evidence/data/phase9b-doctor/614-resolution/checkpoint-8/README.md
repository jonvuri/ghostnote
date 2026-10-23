# 9b.6g checkpoint 8

This is an intermediate checkpoint. Session 9b.6g remains active. No complete
table, bounded admission, candidate, attempt, cache, or deployment exists.
All work is offline. No vendor class is initialized.

## Descriptor coverage

Constructor selection follows explicit parent calls. It excludes the unused
constructor that caused duplicate managed-ID witnesses. All 454 captured
properties now bind on both builds. The compact report is 3,539,009 bytes.
The check takes 9,888.404 ms and peaks at 345,440,256 bytes RSS. Six new tests
cover constructor selection; one test covers its property-census filter.

The generated registration check accepts fixed parent calls, getter or
field registrations, and an explicit `not_engine=true` attribute call.
Seven tests cover its accepted forms and refusals. All 49 descriptors in
the combined capture and factory catalog pass on both builds. The latest
check takes 9,302.445 ms and peaks at 328,630,272 bytes RSS. It records 41
attribute calls per build. Attribute effects remain a separate dependency.

The old build has 1,137 registrations. The new build has 1,139. The only
added label is `displayed_device_name_changed`, ID 17266, on `module` and
`native_device`. Each registration has one allocation witness. The witness
alone does not prove the complete getter or constructor path.

All 1,137 source registrations bind on both builds. The first target check
hits the 512-trace limit. Bounded groups complete the target check without
raising that limit. The final group run takes 10,506.701 ms and peaks at
365,789,184 bytes RSS. Its inputs include the earlier successful group of
501 registrations. Member bindings are now retained so that groups can
check each other's aliases. The failed development runs remain archived.

## Invariant dependencies

All 205 relationship collectors in the combined catalog pass on both
builds. Their 271 local method contracts match. The paths use 10,477 states
and instructions per build. Call counts are 1,756 and 1,847. The latest
two-build check takes 9,940.245 ms and peaks at 353,091,584 bytes RSS.

The 13 property wrapper factories each allocate one wrapper. Their
conditional constructor bounds are 32 to 44 vendor instructions and five
to seven vendor constructor calls. Each concrete wrapper invariant method
returns without work. Of 63 local contracts, 62 match directly through the
separate local comparator. The remaining scalar invariant matches only
under the recorded initialized-true assertion condition. This does not
bound the surrounding descriptor invariant traversal.

All 364 scalar reads used by these invariant paths pass on both builds.
All 447 associated local contracts match. Each build uses 15,719 analysis
states and instructions, with 2,802 analysis calls. The guard report retains
214 assertion fields per build. No runtime flag is observed.

The read interpreter now computes normal-path costs on its acyclic state
graph. Repeated calls count even when their analysis results are cached.
Six tests cover repeated calls, branch maxima, graph merges, long paths,
external calls, and refusal limits. Across both builds, the largest scalar
read bound is 52 vendor instructions, eight vendor calls, and one external
call. The largest collector bound is 63 vendor instructions, ten vendor
calls, and two external calls. Each component is an upper bound. These
counts exclude class initialization, external method bodies, and exception
paths. They are not host timings or complete command bounds.

The descriptor expression list has one assignment to a fresh `ArrayList`
and two ordinary reads on each build: `isEmpty` and `iterator`. Eight tests
cover the reference check. It requires complete scan coverage, private final
storage, exact initialization, and no reference escape or unresolved field
handle. Initialization, exact empty runtime storage, and reflective or
native mutation remain separate conditions. The check does not infer live
emptiness from the field name or constructor alone.

The fixed JDK check now extracts 31 classes. It includes `Long`, its cache,
`Number`, and the `ArrayList` iterator. ARM64 and x64 class hashes match
within each build. Only `ReferenceQueue` differs between builds in this
set, as before. The new boxing and iterator data match. VM initialization,
cache state, exception paths, and collection mutation still need guards.

## Verification and continuation

The full offline suite runs 264 tests: 234 pass and 30 integration tests
skip. There are 166 new unit tests. `git diff --check` passes. Complete
resilience and driver integration remain pending.

Continue the same work list. Use these registration, read, collector, and
storage results to bound descriptor invariants. Complete factory compiler
and clone growth, recursive disposal, command closure, ping exclusion, and
history bounds. Runtime provenance and enforceable guards remain required.
No external blocker or safe warm-cache exclusion is proved. Probe
preparation remains gated.

The development archive retains 146 new or changed files and 46,148,283 raw
bytes. The archive is 2,752,391 bytes. The source inventory and source
archive record the diagnostic code. The original entry inventory remains
the preservation baseline. No final preservation check is claimed.
