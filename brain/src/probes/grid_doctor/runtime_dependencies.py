"""Extract selected JDK class data. Never initialize runtime classes."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import time
from grid_symbols.scan import Refusal, parse, rss_bytes
from .explicit_variants import jdk_membership
from .ownership import method_trace, bootstraps

CLASSES = ('java/util/Collections', 'java/util/Collections$EmptyList',
           'java/util/Collections$EmptySet', 'java/util/Collections$EmptyMap',
           'java/util/AbstractList', 'java/util/AbstractCollection', 'java/util/AbstractSet',
           'java/lang/Object', 'java/lang/Number', 'java/lang/Integer', 'java/lang/Integer$IntegerCache',
           'java/lang/Long', 'java/lang/Long$LongCache',
           'java/lang/Double', 'java/lang/Float', 'java/lang/Math', 'java/lang/Boolean', 'java/util/ArrayList',
           'java/util/ArrayList$Itr',
           'java/util/Collections$UnmodifiableCollection', 'java/util/Collections$UnmodifiableList',
           'java/util/Collections$UnmodifiableRandomAccessList', 'java/util/Objects',
           'jdk/internal/util/Preconditions', 'java/lang/ref/ReferenceQueue',
           'java/lang/ref/ReferenceQueue$Null', 'java/lang/ref/ReferenceQueue$Lock',
           'java/util/LinkedHashSet', 'java/util/HashSet', 'java/util/LinkedHashMap',
           'java/util/HashMap', 'java/util/HashMap$Node', 'java/util/HashMap$TreeNode',
           'java/util/AbstractMap', 'java/util/IdentityHashMap')


def file_hash(path, limit):
    if path.stat().st_size > limit:
        raise Refusal('runtime-artifact-size')
    value = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def inspect(image, release, jimage, destination):
    """Extract class files as data. The extraction tool is a separate JDK."""
    if destination.exists():
        raise Refusal('runtime-extraction-exists')
    if release.stat().st_size > 65536:
        raise Refusal('runtime-release-size')
    image_hash = file_hash(image, 1024 * 1024**2)
    release_data = release.read_bytes()
    tool_hash = file_hash(jimage, 32 * 1024**2)
    destination.mkdir()
    patterns = ','.join('glob:**/' + name + '.class' for name in CLASSES)
    completed = subprocess.run([str(jimage), 'extract', '--include', patterns,
                                '--dir', str(destination), str(image)],
                               capture_output=True, text=True, timeout=45)
    if completed.returncode:
        raise Refusal('runtime-extraction-failed:' + completed.stderr[:1000])
    if file_hash(image, 1024 * 1024**2) != image_hash or release.read_bytes() != release_data or file_hash(jimage, 32 * 1024**2) != tool_hash:
        raise Refusal('runtime-input-changed')
    base = destination / 'java.base'
    class Reader:
        def read(self, name):
            return (base / name).read_bytes()
    jar = type('ClassData', (), {'zip': Reader()})()
    records, total = [], 0
    for name in CLASSES:
        path = base / (name + '.class')
        raw = path.read_bytes()
        total += len(raw)
        if len(raw) > 1024**2 or total > 8 * 1024**2:
            raise Refusal('runtime-extracted-size')
        cls = parse(raw, True)
        if cls.name != name:
            raise Refusal('runtime-class-identity')
        bs = bootstraps(raw, cls)
        selected = [m for m in cls.methods if m.name in ('<init>', '<clinit>', 'valueOf', 'emptyList',
                    'unmodifiableList', 'size', 'get', 'checkIndex', 'elementData',
                    'isEmpty', 'iterator', 'hasNext', 'next', 'checkForComodification',
                    'tableSizeFor', 'numberOfLeadingZeros', 'isNaN', 'min', 'max', 'floatToRawIntBits',
                    'maskNull', 'hash', 'nextKeyIndex', 'init', 'put', 'remove', 'resize',
                    'removeNode', 'afterNodeRemoval', 'getTreeNode', 'find', 'root',
                    'removeTreeNode', 'untreeify', 'replacementNode', 'balanceDeletion',
                    'rotateLeft', 'rotateRight', 'comparableClassFor', 'compareComparables',
                    'equals', 'hashCode')]
        records.append({'name': name, 'sha256': hashlib.sha256(raw).hexdigest(),
                        'methods': [method_trace(jar, cls, method, bs) for method in selected]})
    return {'image': str(image), 'imageSha256': image_hash,
            'releaseSha256': hashlib.sha256(release_data).hexdigest(),
            'release': release_data.decode(), 'jimageSha256': tool_hash,
            'classes': records, 'membership': jdk_membership(destination),
            'extractedBytes': total, 'runtimeClassesInitialized': 0,
            'boundedAdmission': False,
            'limits': ['Class initialization state is not observed.',
                       'List dispatch requires an exact backing-class guard.',
                       'Integer and Long cache initialization and VM intrinsics are separate dependencies.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ('image', 'release', 'jimage', 'extracted', 'report'):
        parser.add_argument('--' + key, type=Path, required=True)
    args = parser.parse_args()
    if args.report.exists():
        raise Refusal('runtime-report-exists')
    start = time.perf_counter()
    report = inspect(args.image, args.release, args.jimage, args.extracted)
    report.update(elapsedMs=round((time.perf_counter() - start) * 1000, 3), peakRssBytes=rss_bytes())
    raw = json.dumps(report, indent=2).encode() + b'\n'
    if len(raw) > 8 * 1024**2 or report['peakRssBytes'] > 768 * 1024**2:
        raise Refusal('runtime-report-or-memory-limit')
    with args.report.open('xb') as output:
        output.write(raw)
    print(json.dumps({'elapsedMs': report['elapsedMs'], 'peakRssBytes': report['peakRssBytes'],
                      'imageSha256': report['imageSha256'], 'bytes': len(raw)}))


if __name__ == '__main__':
    main()
