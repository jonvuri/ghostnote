#!/usr/bin/env python3
"""Compare SQLite FTS5 BM25 with deterministic local LSA retrieval."""

from __future__ import annotations

import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import resource
import sqlite3
import subprocess
import time

import numpy as np


STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "does", "for", "from",
    "how", "i", "in", "into", "is", "it", "made", "of", "on", "or", "project", "same",
    "set", "that", "the", "their", "this", "to", "use", "what", "where", "which", "with",
}
TOKEN = re.compile(r"[a-z0-9]+")
CAMEL = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")


class VisibleText(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.hidden = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "svg"}:
            self.hidden += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "svg"} and self.hidden:
            self.hidden -= 1

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            self.parts.append(data)


def visible_text(source: str) -> str:
    parser = VisibleText()
    parser.feed(source)
    return " ".join(" ".join(parser.parts).split())


def tokens(value: str) -> list[str]:
    value = CAMEL.sub(" ", value)
    return [term for term in TOKEN.findall(value.lower()) if term not in STOP_WORDS and len(term) > 1]


def searchable(value: str) -> str:
    return " ".join(tokens(value))


def timed(work):
    started = time.perf_counter_ns()
    result = work()
    return result, (time.perf_counter_ns() - started) / 1_000_000


def cache_document(cache_root: Path, product_version: str, source_id: str) -> Path:
    manifest_path = cache_root / product_version / source_id / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    path = manifest_path.parent / manifest["fileName"]
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != manifest["sha256"]:
        raise RuntimeError(f"cache hash mismatch for {source_id}")
    return path


def api_documents(resources: Path) -> list[dict[str, str]]:
    root = resources / "Documentation" / "control-surface" / "api"
    documents = []
    for path in sorted((root / "com" / "bitwig").rglob("*.html")):
        relative = path.relative_to(root).as_posix()
        documents.append({
            "id": f"api:{relative}",
            "source": "installed-api-25",
            "title": path.stem,
            "content": visible_text(path.read_text(errors="replace")),
        })
    return documents


def property_documents(resources: Path) -> list[dict[str, str]]:
    localization = resources / "localization"
    sources = [
        ("device-description", "Device-descriptions-resources.properties"),
        ("modulator-description", "Modulator-descriptions-resources.properties"),
        ("module-description", "Module-descriptions-resources.properties"),
    ]
    documents = []
    for source, name in sources:
        grouped: dict[str, list[str]] = {}
        for line in (localization / name).read_text(errors="replace").splitlines():
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            stem = key.rsplit(".", 1)[0]
            grouped.setdefault(stem, []).append(value)
        for stem, values in sorted(grouped.items()):
            documents.append({
                "id": f"{source}:{stem}",
                "source": f"installed-{source}",
                "title": stem.replace("_", " ").replace(".", " "),
                "content": " ".join(values),
            })
    return documents


def release_documents(path: Path) -> list[dict[str, str]]:
    source = path.read_text(errors="replace")
    headings = list(re.finditer(r"<h([1-3])[^>]*>(.*?)</h\1>", source, re.I | re.S))
    documents = []
    for index, match in enumerate(headings):
        title = visible_text(match.group(2))
        end = headings[index + 1].start() if index + 1 < len(headings) else len(source)
        content = visible_text(source[match.end():end])
        if content:
            documents.append({
                "id": f"release-6.0.6:{index}:{title}",
                "source": "cached-release-notes-6.0.6",
                "title": title,
                "content": content,
            })
    return documents


def guide_documents(pdf: Path, output_root: Path) -> list[dict[str, str]]:
    text_path = output_root / "guide-5.3.txt"
    subprocess.run(["pdftotext", "-layout", str(pdf), str(text_path)], check=True)
    pages = text_path.read_text(errors="replace").split("\f")
    return [
        {
            "id": f"guide-5.3:page-{index + 1}",
            "source": "cached-user-guide-5.3-general-only",
            "title": f"Bitwig Studio 5.3 guide page {index + 1}",
            "content": " ".join(page.split()),
        }
        for index, page in enumerate(pages)
        if page.strip()
    ]


def expected_id(documents: list[dict[str, str]], source: str, phrase: str) -> str:
    matches = [row["id"] for row in documents if row["source"] == source and phrase in row["content"]]
    if not matches:
        raise RuntimeError(f"expected evidence is missing: {source}: {phrase}")
    return matches[-1]


def questions(documents: list[dict[str, str]]) -> list[dict[str, str]]:
    return [
        {
            "area": "api",
            "question": "Which controller object starts and stops recording the master output?",
            "expected": next(row["id"] for row in documents if row["id"].endswith("/MasterRecorder.html")),
        },
        {
            "area": "api",
            "question": "How can an extension observe whether master capture is active?",
            "expected": next(row["id"] for row in documents if row["id"].endswith("/MasterRecorder.html")),
        },
        {
            "area": "api",
            "question": "Which API value reports a duration in milliseconds?",
            "expected": next(row["id"] for row in documents if row["id"].endswith("/MasterRecorder.html")),
        },
        {
            "area": "workflow",
            "question": "Where can I find audio made by master capture?",
            "expected": expected_id(
                documents,
                "cached-user-guide-5.3-general-only",
                "Clicking on the Show Master Recordings button points",
            ),
        },
        {
            "area": "workflow",
            "question": "How can copies of a clip share edits to their musical content?",
            "expected": expected_id(documents, "cached-release-notes-6.0.6", "Alias clips support sharing content"),
        },
        {
            "area": "workflow",
            "question": "How do I define the project tonic and scale?",
            "expected": expected_id(
                documents,
                "cached-release-notes-6.0.6",
                "The key can be defined for your project",
            ),
        },
        {
            "area": "device",
            "question": "Which effect reduces harsh ess sounds in a vocal?",
            "expected": "device-description:device.de-esser",
        },
        {
            "area": "device",
            "question": "Which device combines compression and expansion with a sidechain?",
            "expected": "device-description:device.dynamics",
        },
        {
            "area": "device",
            "question": "Which module moves a signal to the nearest pitch in the project key?",
            "expected": "module-description:module.by_scale",
        },
    ]


def build_lexical(path: Path, documents: list[dict[str, str]]) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.execute(
        "CREATE VIRTUAL TABLE docs USING fts5(id UNINDEXED, area UNINDEXED, title, content, tokenize='porter unicode61')",
    )
    connection.executemany(
        "INSERT INTO docs(id, area, title, content) VALUES (?, ?, ?, ?)",
        [
            (
                row["id"],
                "api" if row["source"].startswith("installed-api")
                else "device" if "description" in row["source"]
                else "workflow",
                searchable(row["title"]),
                searchable(row["content"]),
            )
            for row in documents
        ],
    )
    connection.commit()
    return connection


def lexical_query(connection: sqlite3.Connection, area: str, question: str, limit: int = 5) -> list[str]:
    terms = list(dict.fromkeys(tokens(question)))
    query = " OR ".join(f'"{term}"' for term in terms)
    rows = connection.execute(
        "SELECT id FROM docs WHERE docs MATCH ? AND area = ? ORDER BY bm25(docs, 0.0, 0.0, 4.0, 1.0) LIMIT ?",
        (query, area, limit),
    )
    return [row[0] for row in rows]


def build_lsa(output_path: Path, documents: list[dict[str, str]]):
    token_rows = [tokens(f'{row["title"]} {row["content"]}') for row in documents]
    document_frequency: dict[str, int] = {}
    total_frequency: dict[str, int] = {}
    for row in token_rows:
        for term in set(row):
            document_frequency[term] = document_frequency.get(term, 0) + 1
        for term in row:
            total_frequency[term] = total_frequency.get(term, 0) + 1
    terms = sorted(document_frequency, key=lambda term: (-total_frequency[term], term))[:6000]
    vocabulary = {term: index for index, term in enumerate(terms)}
    count = np.zeros((len(documents), len(terms)), dtype=np.float32)
    for row_index, row in enumerate(token_rows):
        for term in row:
            if term in vocabulary:
                count[row_index, vocabulary[term]] += 1
    count = np.log1p(count)
    df = np.count_nonzero(count, axis=0)
    idf = (np.log((len(documents) + 1) / (df + 1)) + 1).astype(np.float32)
    matrix = count * idf
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    matrix /= np.maximum(norms, 1e-12)
    rank = min(64, len(documents) - 1, len(terms) - 1)
    generator = np.random.default_rng(0)
    omega = generator.standard_normal((len(terms), rank + 8), dtype=np.float32)
    basis, _ = np.linalg.qr(matrix @ omega, mode="reduced")
    reduced = basis.T @ matrix
    left, singular, vectors = np.linalg.svd(reduced, full_matrices=False)
    doc_vectors = (basis @ left[:, :rank]) * singular[:rank]
    vectors = vectors[:rank]
    doc_vectors /= np.maximum(np.linalg.norm(doc_vectors, axis=1, keepdims=True), 1e-12)
    np.savez_compressed(
        output_path,
        terms=np.array(terms),
        idf=idf,
        vectors=vectors,
        documents=doc_vectors,
        ids=np.array([row["id"] for row in documents]),
    )
    return vocabulary, idf, vectors, doc_vectors


def semantic_query(
    model,
    documents: list[dict[str, str]],
    area: str,
    question: str,
    limit: int = 5,
) -> list[str]:
    vocabulary, idf, vectors, doc_vectors = model
    query = np.zeros(len(vocabulary), dtype=np.float32)
    for term in tokens(question):
        if term in vocabulary:
            query[vocabulary[term]] += 1
    query = np.log1p(query) * idf
    query /= max(float(np.linalg.norm(query)), 1e-12)
    latent = query @ vectors.T
    latent /= max(float(np.linalg.norm(latent)), 1e-12)
    scores = doc_vectors @ latent
    allowed = np.array([
        row["source"].startswith("installed-api") if area == "api"
        else "description" in row["source"] if area == "device"
        else row["source"].startswith("cached-")
        for row in documents
    ])
    scores[~allowed] = -np.inf
    order = np.argsort(-scores, kind="stable")[:limit]
    return [documents[index]["id"] for index in order]


def query_metrics(query, cohort: list[dict[str, str]]) -> tuple[list[dict], float]:
    rows = []
    timings = []
    for item in cohort:
        repeated = []
        for _ in range(20):
            result, elapsed = timed(lambda: query(item["area"], item["question"]))
            repeated.append(result)
            timings.append(elapsed)
        deterministic = all(result == repeated[0] for result in repeated)
        ranking = repeated[0]
        rank = ranking.index(item["expected"]) + 1 if item["expected"] in ranking else None
        rows.append({**item, "rank": rank, "top5": ranking, "deterministic": deterministic})
    return rows, float(np.median(timings))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bitwig-app-root", type=Path, required=True)
    parser.add_argument("--cache-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()
    args.output_root.mkdir(parents=True, exist_ok=True)
    resources = args.bitwig_app_root / "Contents" / "Resources"
    release = cache_document(args.cache_root, "6.0.6", "release-notes")
    guide = cache_document(args.cache_root, "6.0.6", "user-guide-5-3-en")

    def make_corpus():
        return (
            api_documents(resources)
            + property_documents(resources)
            + release_documents(release)
            + guide_documents(guide, args.output_root)
        )

    documents, corpus_ms = timed(make_corpus)
    corpus_path = args.output_root / "corpus.json"
    corpus_path.write_text(json.dumps(documents, separators=(",", ":")))
    cohort = questions(documents)

    lexical_path = args.output_root / "lexical.sqlite"
    lexical, lexical_build_ms = timed(lambda: build_lexical(lexical_path, documents))
    semantic_path = args.output_root / "semantic-lsa.npz"
    semantic, semantic_build_ms = timed(lambda: build_lsa(semantic_path, documents))
    lexical_rows, lexical_query_ms = query_metrics(
        lambda area, value: lexical_query(lexical, area, value),
        cohort,
    )
    semantic_rows, semantic_query_ms = query_metrics(
        lambda area, value: semantic_query(semantic, documents, area, value),
        cohort,
    )
    lexical.close()

    sources: dict[str, int] = {}
    for row in documents:
        sources[row["source"]] = sources.get(row["source"], 0) + 1
    result = {
        "documents": len(documents),
        "routing": "explicit api, workflow, or device source family",
        "sources": sources,
        "corpusMs": round(corpus_ms, 1),
        "corpusBytes": corpus_path.stat().st_size,
        "lexical": {
            "buildMs": round(lexical_build_ms, 1),
            "medianQueryMs": round(lexical_query_ms, 3),
            "bytes": lexical_path.stat().st_size,
            "top5Hits": sum(row["rank"] is not None for row in lexical_rows),
            "results": lexical_rows,
        },
        "semantic": {
            "method": "64-dimension randomized latent semantic analysis, seed 0",
            "buildMs": round(semantic_build_ms, 1),
            "medianQueryMs": round(semantic_query_ms, 3),
            "bytes": semantic_path.stat().st_size,
            "top5Hits": sum(row["rank"] is not None for row in semantic_rows),
            "results": semantic_rows,
        },
        "peakResidentBytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
