"""Inspect pinned files offline. Keep vendor output outside the repository."""

import hashlib
import json
from pathlib import Path
import subprocess
import zipfile


ROOT = Path(__file__).resolve().parent
OUT = Path('/tmp/gn9a-observable-design')
APP = Path('/Applications/Bitwig Studio.app/Contents')
OBJDUMP = '/opt/homebrew/opt/llvm/bin/llvm-objdump'
SOURCES = {
    'jar': (APP / 'Java/bitwig.jar',
            '382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93'),
    'engine': (APP / 'MacOS/Bitwig Audio Engine ARM64-NEON.app/Contents/MacOS/BitwigAudioEngine-ARM64-NEON',
               'c83b0615dbe914ac04e5b4f9de4ff91b1cc6db2720297a4954377f9ef83ea616'),
    'jni': (APP / 'Frameworks/libbitwig-jni.jnilib',
            'ece77643d8cc95a4915231a26b0305a3f964e7a156776996a794dbcde9d354ea'),
    'app': (APP / 'MacOS/BitwigStudio',
            'ae5044db7786cd29cad544410b7eec5b2a08659be9c341d5f040cfaeb15c36c1'),
}
CLASSES = [
    'com.bitwig.base.platform.SharedMemory',
    'com.bitwig.flt.control_surface.proxy.AbstractChannelProxy',
    'com.bitwig.flt.control_surface.proxy.AbstractChannelProxy$VuMeterObserver',
    'com.bitwig.extension.controller.api.Channel',
    'Cic', 'Bsp', 'DxI', 'UoA',
]
RANGES = [
    ('jni-create-server', 0x4fff24, 0x500124),
    ('jni-get-address', 0x500350, 0x500358),
    ('jni-begin-frame', 0x533fec, 0x534058),
    ('jni-array-reader', 0x533dd4, 0x533e90),
    ('jni-scope-reader', 0x534adc, 0x534d30),
]
TYPE_NAMES = [
    'N3flt4core11VuMeterAtomE',
    'N3flt4core15VuMeterAtomNodeE',
    'N3flt4core25EngineSharedMemoryManagerE',
    'N3flt4core24EngineSharedMemoryHelperE',
    'N3flt4core28EngineSharedMemoryHelperNodeE',
    'N3flt4core24SharedMemoryAnalysisAtomE',
    'N3flt4core27LightweightOscilloscopeAtomE',
]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def inspect():
    OUT.mkdir(exist_ok=True)
    manifest = {
        'scope': 'Offline file inspection only. No host invocation, process attach, '
                 'native-memory read, subscription, fixture operation, or deployment.',
        'localOutputDirectory': str(OUT),
        'sources': [], 'outputs': [],
    }
    for name, (path, expected) in SOURCES.items():
        data = path.read_bytes()
        assert sha(data) == expected, f'Source changed: {path}'
        manifest['sources'].append({
            'name': name, 'path': str(path), 'sha256': expected, 'bytes': len(data),
        })

    def run(name, args):
        result = subprocess.run(args, capture_output=True, check=True, timeout=60)
        assert not result.stderr, result.stderr.decode()
        (OUT / name).write_bytes(result.stdout)
        manifest['outputs'].append({
            'file': name, 'command': args, 'sha256': sha(result.stdout),
            'bytes': len(result.stdout),
        })
        return result.stdout.decode()

    run('javap-version.txt', ['javap', '-version'])
    run('objdump-version.txt', [OBJDUMP, '--version'])
    for cls in CLASSES:
        run(cls + '.txt', ['javap', '-p', '-c', '-classpath',
                          str(SOURCES['jar'][0]), cls])
    for name in ('engine', 'jni', 'app'):
        path = str(SOURCES[name][0])
        run(name + '-file.txt', ['file', path])
        run(name + '-symbols.txt', ['nm', '-arch', 'arm64', '-C', path])
        run(name + '-headers.txt', ['otool', '-arch', 'arm64', '-l', path])

    thin = OUT / 'jni-arm64.bin'
    thin_args = ['lipo', str(SOURCES['jni'][0]), '-thin', 'arm64', '-output', str(thin)]
    subprocess.run(thin_args, capture_output=True, check=True, timeout=60)
    manifest['thinSlice'] = {'command': thin_args, 'sha256': sha(thin.read_bytes())}
    for label, start, stop in RANGES:
        # A thin file makes objdump honor the address range. Check each result.
        result = run(label + '.txt', [OBJDUMP, '-d', '-C',
                     f'--start-address={start}', f'--stop-address={stop}', str(thin)])
        addresses = []
        for line in result.splitlines():
            field = line.strip().split(':', 1)[0]
            if ':' in line and all(c in '0123456789abcdef' for c in field):
                addresses.append(int(field, 16))
        assert addresses and min(addresses) == start and max(addresses) < stop

    engine = SOURCES['engine'][0].read_bytes()
    leads = []
    symbols = (OUT / 'engine-symbols.txt').read_text()
    for name in TYPE_NAMES:
        value = name.encode() + b'\0'
        offsets = []
        start = 0
        while (offset := engine.find(value, start)) >= 0:
            offsets.append(hex(offset))
            start = offset + len(value)
        assert offsets, name
        leads.append({'typeName': name, 'fileOffsets': offsets})
    predicates = ['VuMeter', 'EngineSharedMemory', 'SharedMemoryAnalysis',
                  'LightweightOscilloscope']
    matches = [line for line in symbols.splitlines()
               if any(word in line for word in predicates)]
    names = ['VuMeterAtom', 'SharedMemoryAnalysisAtom',
             'LightweightOscilloscopeAtom', 'EngineSharedMemoryHelper', 'OscilloscopeAtom']
    hits = {name: [] for name in names}
    count = 0
    with zipfile.ZipFile(SOURCES['jar'][0]) as jar:
        for path in jar.namelist():
            if not path.endswith('.class'):
                continue
            count += 1
            data = jar.read(path)
            for name in names:
                if name.encode() in data:
                    hits[name].append(path)
    manifest['nativeLeads'] = {
        'scope': 'Type-name bytes and symbol text only. These are not recovered '
                 'producer functions, vtables, writer sets, or publication proof.',
        'engineTypeNames': leads,
        'engineSymbolPredicates': predicates,
        'engineSymbolMatches': matches,
        'jarAsciiNameScan': {'classCount': count, 'matches': hits},
    }
    (OUT / 'source-inspection.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    result = inspect()
    print(f"Inspected {len(result['sources'])} pinned files; "
          f"saved {len(result['outputs'])} command outputs in {OUT}.")
