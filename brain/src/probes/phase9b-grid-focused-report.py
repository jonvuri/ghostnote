"""Check and summarize E304 captures. This script makes no host call."""
import json
import gzip
from collections import defaultdict
from pathlib import Path
from statistics import median
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "context/evidence/data/phase9b-focused"


def load(path):
    if path.exists():
        return json.loads(path.read_text())
    with gzip.open(str(path) + ".gz", "rt") as stream:
        return json.load(stream)


def save(name, value):
    (DATA / name).write_text(json.dumps(value, indent=2) + "\n")


def relative(path):
    return str(path.relative_to(ROOT))


def span(values):
    return {"count": len(values), "min": min(values), "median": median(values),
            "max": max(values)} if values else None


def captures(directory):
    archive = directory / "captures.zip"
    if archive.exists():
        with ZipFile(archive) as items:
            for name in items.namelist():
                yield json.loads(items.read(name))
    else:
        for path in directory.glob("*focused-capture-*.json"):
            yield load(path)


def fields(node):
    return {p["id"]: p for p in node.get("fields", node.get("properties", []))}


def scalar(node, pid):
    return fields(node)[pid]["value"]["data"]


def analyze(summary):
    owners, nodes = {}, {}
    for module in summary["modules"]:
        for atom in module.get("atoms", []):
            assert atom["managedId"] not in owners
            owners[atom["managedId"]] = {
                "moduleIndex": module["index"], "moduleName": module["name"],
                "typeUuid": module["typeUuid"], "atomIndex": atom["index"],
                "className": atom["className"],
            }
        for read in module.get("reads", []):
            for node in read.get("nodes", []):
                old = nodes.setdefault(node["managedId"], {
                    "className": node["className"], "fields": {}})
                assert old["className"] == node["className"]
                for prop in node["fields"]:
                    assert prop["id"] not in old["fields"] or old["fields"][prop["id"]] == prop, (
                        "Cross-capture field changed", node["managedId"], prop["id"])
                    old["fields"][prop["id"]] = prop

    def refs(mid, pid):
        return nodes.get(mid, {}).get("fields", {}).get(pid, {}).get("refs", [])

    mappings, arrays, resources, inputs, audio_cables = [], [], [], [], []
    for mid, node in nodes.items():
        props = node["fields"]
        if node["className"] == "audio_destination_atom" and 7125 in props:
            for source in refs(mid, 7125):
                assert nodes[source]["className"] == "audio_source_atom"
                assert mid in owners and source in owners, "Audio cable is outside module membership"
                audio_cables.append({"sourceId": source, "sourceOwner": owners[source],
                                     "destinationId": mid, "destinationOwner": owners[mid]})
        if node["className"] == "device_modulation_mapping" and 3635 in props:
            source = refs(mid, 3635)
            destination = refs(mid, 3739)
            assert len(source) == len(destination) == 1
            target = refs(destination[0], 65)
            row = {"mappingId": mid, "sourceId": source[0],
                   "sourceOwner": owners.get(source[0]), "destinationReference": destination[0],
                   "targetIds": target, "targetOwners": [owners.get(t) for t in target],
                   "amount": props[3611]["value"]["data"],
                   "enabled": props[11481]["value"]["data"],
                   "transfer": props[11338]["value"]["data"],
                   "sourceListsMapping": mid in refs(source[0], 3616),
                   "targetListsMapping": len(target) == 1 and mid in refs(target[0], 3615)}
            if row["sourceOwner"] and row["targetListsMapping"] and 3616 in nodes[source[0]]["fields"]:
                assert row["sourceListsMapping"], "Grid mapping has no source-side record"
            mappings.append(row)
        if node["className"] == "data_array_component" and 6609 in props:
            value = props[6609]["value"]
            assert value["length"] == int(props[6613]["value"]["data"]) == len(value["data"])
            arrays.append({"managedId": mid, "owner": owners.get(mid),
                           "size": value["length"], "values": [v["data"] for v in value["data"]]})
        if node["className"] in ("wavetable_reference", "file_reference", "absolute_file_reference"):
            resources.append({"managedId": mid, "className": node["className"],
                              "fields": list(props.values())})
        if node["className"] in ("modulation_source_atom", "nameable_modulation_source_atom"):
            for settings in refs(mid, 6194):
                for index, connection in enumerate(refs(settings, 614)):
                    source = refs(connection, 248)
                    cp = nodes[connection]["fields"]
                    inputs.append({"destinationId": mid, "destinationOwner": owners.get(mid),
                                   "inputIndex": index, "connectionId": connection,
                                   "sourceIds": source, "sourceOwners": [owners.get(s) for s in source],
                                   "sourcePort": cp[249]["value"]["data"]})
    return {"mappings": mappings, "arrays": arrays, "resources": resources,
            "inputConnections": inputs, "projectedAudioCables": audio_cables}


def control_check(summary):
    baseline = load(ROOT / "context/evidence/data/phase9a-grid-read/live-23-semantic-baseline/capture-0.json")["graph"]
    nodes = {n["id"]: n for n in baseline["nodes"]}
    members = fields(nodes[baseline["root"]])[6428]["refs"]
    expected_owners, actual_owners = {}, {}
    for index, mid in enumerate(members):
        body = nodes[fields(nodes[mid])[406]["refs"][0]]
        for atom_index, ref in enumerate(fields(body)[173]["refs"]):
            expected_owners[ref] = (index, atom_index)
    for module in summary["modules"]:
        for atom in module["atoms"]:
            actual_owners[atom["managedId"]] = (module["index"], atom["index"])
    checked_values, checked_cables = 0, 0
    assert len(members) == len(summary["modules"])
    for module, mid in zip(summary["modules"], members):
        expected_module = nodes[mid]
        assert module["name"] == scalar(expected_module, 404)
        body = nodes[fields(expected_module)[406]["refs"][0]]
        assert module["typeUuid"] == scalar(body, 6369)
        expected_atoms = fields(body)[173]["refs"]
        assert [nodes[a]["className"] for a in expected_atoms] == [a["className"] for a in module["atoms"]]
        for read in module["reads"]:
            assert read["complete"]
            expected = nodes[expected_atoms[read["index"]]]
            root = next(n for n in read["nodes"] if n["managedId"] == read["managedId"])
            for pid, prop in fields(root).items():
                old = fields(expected).get(pid)
                if pid != 14 and old and "value" in prop:
                    assert prop["value"] == old["value"], (module["name"], read["index"], pid)
                    checked_values += 1
                if pid == 7125:
                    assert [actual_owners[r] for r in prop["refs"]] == [
                        expected_owners[r] for r in old["refs"]]
                    checked_cables += len(prop["refs"])
    assert checked_values > 0 and checked_cables == 2
    return {"storedValuesMatch": checked_values, "audioCablesMatch": checked_cables,
            "moduleAndAtomMembershipMatch": True}


def main():
    runs, presets, schemas, aliases = [], [], {}, defaultdict(lambda: defaultdict(set))
    entry = load(DATA / "live-v15/before.json")
    all_capture_ms, all_document_ms, all_heap, complete_work = [], [], [], []
    for directory in sorted(DATA.glob("live-v15*")):
        if not (directory / "entry.json").exists():
            continue
        before = load(directory / "before.json")
        assert before == entry, ("Entry state changed", directory.name)
        after_path = directory / "after.json"
        if after_path.exists():
            assert load(after_path) == entry
        exit_state = load(directory / "exit.json")
        assert exit_state["scratch"] is None and not exit_state["uncertain"]
        calls = load(directory / "calls.json")
        summaries = sorted(directory.glob("preset-*-focused-summary.json"))
        for file in summaries:
            prefix = file.name.split("-focused-")[0]
            target = load(directory / f"{prefix}-target.json")
            summary = load(file)
            details = analyze(summary)
            result = {
                "source": relative(file), "preset": target["candidate"]["path"],
                "flavour": target["target"]["deviceName"], "moduleCount": summary["moduleCount"],
                "captures": summary["captures"], "schemas": summary["schemas"],
                "configuredAtomReads": sum(len(m.get("reads", [])) for m in summary["modules"]),
                "limits": summary["limits"], **details,
            }
            if target["candidate"]["role"] == "9a baseline control":
                result["control"] = control_check(summary)
            presets.append(result)
            for module in summary["modules"]:
                aliases[module["typeUuid"]][module["name"]].add((target["candidate"]["path"], relative(file)))
        timings, documents, heaps, work, sizes = [], [], [], [], []
        for data in captures(directory):
            documents.append(data["documentTaskNanos"] / 1e6)
            heaps.append((data["heapUsedAfter"] - data["heapUsedBefore"]) / 1048576)
            sizes.append(data["graph"]["encodedBytes"])
            if data["graph"]["complete"]:
                work.append(data["queryWork"])
        for call in calls["calls"]:
            if call["method"] == "probe.gridRead" and call["params"]["operation"] == "read":
                timings.append(call["ms"])
        schema_documents, schema_heaps = [], []
        for file in directory.glob("*focused-schema-*.json"):
            data = load(file)
            schema_documents.append(data["documentTaskNanos"] / 1e6)
            schema_heaps.append((data["heapUsedAfter"] - data["heapUsedBefore"]) / 1048576)
            s = data["schema"]
            schemas.setdefault((s["className"], s["runtimeClass"]), {**s, "source": relative(file)})
        refusals = [load(f) for f in directory.glob("*cap-refusal.json")]
        runs.append({"run": directory.name, "entryEqualsOriginal": True,
                     "exitEqualsOriginal": after_path.exists(), "exit": exit_state,
                     "wireCalls": calls["count"], "wireMsSum": calls["wireMs"],
                     "captureWireMs": span(timings), "documentMs": span(documents),
                     "schemaDocumentMs": span(schema_documents), "schemaHeapDeltaMiB": span(schema_heaps),
                     "bindWireMs": [c["ms"] for c in calls["calls"] if c["method"] == "probe.gridRead"
                                    and c["params"]["operation"] == "bind"],
                     "heapDeltaMiB": span(heaps), "completeQueryWork": span(work),
                     "graphBytes": span(sizes), "refusals": refusals,
                     "failure": load(directory / "failure.json") if (directory / "failure.json").exists() else None})
        all_capture_ms.extend(timings)
        all_document_ms.extend(documents)
        all_heap.extend(heaps)
        complete_work.extend(work)
    old = load(ROOT / "context/evidence/data/phase9b-survey/catalog-first-pass.json")
    catalog = defaultdict(lambda: defaultdict(list))
    for row in old["seenTypes"]:
        catalog[row["typeUuid"]][row["observedName"]].append({
            "evidence": "E302", "presetPaths": row["sources"]})
    for uuid, names in aliases.items():
        for name, sources in names.items():
            catalog[uuid][name].append({"evidence": "E304",
                                       "sources": [{"presetPath": p, "capture": f} for p, f in sorted(sources)]})
    final = load(DATA / "final-state.json")
    assert final["tracks"]["tracks"] == entry["tracks"]
    assert final["mixer"] == entry["mixer"]
    assert {k: final["selection"][k] for k in entry["selection"]} == entry["selection"]
    assert not any(final["survey"][k] for k in ("bound", "busy", "locked", "nativeUnfinished", "foreignOwner"))
    baseline = load(ROOT / "context/evidence/data/phase9a-grid-read/live-23-semantic-baseline/capture-0.json")["graph"]
    def normalized(graph):
        for node in graph["nodes"]:
            for prop in node["properties"]:
                if prop["id"] == 14 or (node["className"] == "module" and prop["id"] == 15):
                    prop["value"]["data"] = "<instance-id>"
        return graph["nodes"]
    for i in range(2):
        graph = load(DATA / f"preserved-v15/capture-{i}.json")["graph"]
        assert graph["complete"] and normalized(graph) == normalized(baseline)
    save("focused-report.json", {
        "evidence": "E304", "runs": runs, "presets": presets,
        "captureWireMs": span(all_capture_ms), "documentMs": span(all_document_ms),
        "heapDeltaMiB": span(all_heap), "completeQueryWork": span(complete_work),
        "finalPreservedBaselineMatches": True, "finalStateMatchesEntry": True,
        "finalReaderReleased": True,
        "scope": "Paired explicit fields. Identity-only nodes do not prove resource content or mapping semantics.",
    })
    save("observed-schemas.json", {"evidence": "E304", "classes": list(schemas.values())})
    filenames = set(old["moduleFiles"])
    matched = {name + ".bwmodule" for names in catalog.values() for name in names if name + ".bwmodule" in filenames}
    save("catalog-updated.json", {"evidence": "E304", "typeCount": len(catalog),
         "namePairCount": sum(len(names) for names in catalog.values()),
         "lexicalFilenameMatches": len(matched), "moduleFilenameCount": len(filenames),
         "scope": "Editable observed aliases with provenance. No canonical names.",
         "types": [{"typeUuid": uuid, "canonicalName": None,
                    "aliases": [{"name": name, "provenance": provenance,
                                 "filenameMatch": name + ".bwmodule" if name + ".bwmodule" in filenames else None}
                                for name, provenance in names.items()]}
                   for uuid, names in sorted(catalog.items())]})
    print(json.dumps({"runs": len(runs), "successfulPresets": len(presets),
                      "schemaClasses": len(schemas), "catalogTypes": len(catalog)}))


if __name__ == "__main__":
    main()
