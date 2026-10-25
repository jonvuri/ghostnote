---
title: E346 — Browser proxy bindings and open discovery routes
kind: evidence
state: active
updated: 2026-10-25
---

# E346 — Browser proxy bindings and open discovery routes

## Finding

Read-only bytecode inspection of the installed Bitwig 6.1.4 jar explains the
content-type guard failure in [E345](e345-browser-content-type-readback-remains-unconfirmed.md).
`PopupBrowserProxy.connectToTarget(aXu)` explicitly sets the selected content
type name to an empty string. Its content-type index proxy is constructed but
never bound to a target in this class; the only other field references are
the getter and disconnect cleanup. `SettableIntegerValueProxy` defaults to
zero and its `doSet(int)` does nothing when its target is null.

This is static evidence for disconnected content-type controls in this build,
not a timing measurement or a claim about every Bitwig version. E345's live
observations remain unchanged. Its driver stopped before testing the available
filters, so that guard failure does not exhaust Bitwig-native discovery.
No host connection, live write, deployment, or new capability acceptance was
performed for this assessment.

## Public filter route and external references

The same connection method binds location, category, tags, device type, file
type, creator, and results to the native search session. It explicitly clears
the device filter and does not bind smart collections. E345's recorded
`contentType-second` snapshot already contains an `Instrument` device-type
choice and locations including `My Library` and `Presets`. Availability is
observed; filter effects and complete discovery remain untested.

The local [Control Deck controller](../../../reference/bitwig-control-deck/controller/ControlDeck.control.js)
at commit `45933855dcbfd1bd130beea18dd3f02bf794a838` sets the content index,
then continues without checking its selected name or index. For `Devices`,
`prepareBrowser` resets filters, waits 1,000 ms, applies named filters, and
pages results. R05 stopped before this part of the reference sequence.
This is an implementation lead, not proof that Control Deck succeeds on the
installed host. A follow-up can use observed, bound filters and independently
verify their selection and result effects without depending on the disconnected
content-type control. Missing filter proxies must be handled explicitly.

The local [Gig Maestro browser handler](../../../reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/BrowserHandler.java)
at commit `de79a747a62b50e1488cc9ef49617d129804e3ff` also exposes filter and
result navigation. It opens preset browsing through the selected device's
replacement insertion point, providing another context to assess. Its
content-index setter and associated RPC checks do not establish successful
content switching or complete discovery on this host.

## Internal identity and search-session route

`BrowserResultsItemProxy` binds a native `tn` target. The inheritance chain
`tn -> tq -> wt` exposes `Grk(): java.io.File` and `MIO(): java.net.URI`.
The underlying proxy base exposes `getTarget()`, and browser item/result
proxies expose `getSearchSession(): wz`. These are concrete entry points for
examining native result identities and the search session beyond the public
API's names and selections.

The next useful internal check is read-only inspection of matched result
targets, including nullability and concrete implementation semantics, with
correct host-thread access. File-backed `.bwpreset` entries may yield exact
paths; stock devices and plug-ins may require different metadata. Neither
live path values nor reusable plug-in IDs are established here. Obfuscated
method signatures alone do not establish query semantics, and no internal
search mutator is admitted by this finding.

## Native registry/index route

[E102](e102-clap-discovered-h2p-is-an-indexed-direct-route.md) records Bitwig's
CLAP device-ID index containing `com.u-he.Repro-5` and `com.u-he.Diva`.
Inspecting the native registry/index schema is another candidate for resolving
installed plug-in identities without implementing a separate plug-in scanner.
Coverage, freshness, name matching, and current-build schema remain unproved.
Its vendor-preset observations do not reopen vendor-preset loading, excluded
by [D22](../../decisions/d22-non-native-plugin-preset-loading-is-out-of-scope.md).

## Reproduction and scope

Installed jar SHA-256:
`5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`.
Inspect bytecode and signatures without loading host classes:

```sh
javap -p -c -classpath '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' com.bitwig.flt.control_surface.proxy.PopupBrowserProxy com.bitwig.flt.control_surface.values.SettableIntegerValueProxy
javap -p -classpath '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' com.bitwig.flt.control_surface.proxy.BrowserResultsItemProxy com.bitwig.flt.control_surface.proxy.BrowserItemProxy com.bitwig.flt.control_surface.proxy.BrowserResultsColumnProxy com.bitwig.flt.control_surface.proxy.ControlSurfaceProxy tn tq wt wz wA
```

The recommended follow-up starts with filter-driven discovery, then examines
native identity metadata for the resulting matches. Preserve ambiguity and
incomplete-scan results explicitly. Discovery alone does not authorize or
prove insertion. The bounded R05 experiment is complete; these routes remain
research candidates, and normal controller restoration is still pending.
