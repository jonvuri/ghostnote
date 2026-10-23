"""Check the exact 6.1.4 history-helper bodies and state their growth costs.

The checks read class bytes as data. They do not load, initialize, or run
vendor code. A passing check is a conditional local result, not admission.
"""
import hashlib
import json
import re

from grid_symbols.scan import Refusal, instructions
from .ownership import constant

# Original 6.1.4 class names and their roles. A renamed fixture supplies the
# same roles through its class map. Every other vendor class is refused.
ROLES = {
    'dfI': 'document', 'dgJ': 'helper', 'dgI': 'helper-interface', 'dfT': 'edit',
    'com/bitwig/ramona/core/oDc': 'object', 'com/bitwig/ramona/core/AVL': 'object-base',
    'com/bitwig/ramona/core/OLR': 'object-interface', 'com/bitwig/ramona/core/zjj': 'relations',
    'cQi': 'assertions', 'cQy': 'identity-set', 'cQz': 'identity-strategy',
    'eTi': 'open-set', 'eOM': 'abstract-set', 'eOD': 'abstract-collection',
    'eOF': 'abstract-list', 'eTk': 'set-iterator', 'eTj': 'iterator-tag',
    'eSY': 'object-iterator', 'epU': 'strategy', 'epV': 'hash-common', 'eSw': 'wrapped-list',
}

# (label, original owner, original name, original descriptor), in check order.
# The order also fixes the labels that the binder gives to other vendor members.
TARGETS = (
    ('helper.init', 'dgJ', '<init>', '(Lcom/bitwig/ramona/core/oDc;)V'),
    ('helper.add', 'dgJ', 'cfM', '(Lcom/bitwig/ramona/core/oDc;)V'),
    ('helper.attach', 'dgJ', 'cfM', '(Lcom/bitwig/ramona/core/oDc;LdfT;)Z'),
    ('helper.match', 'dgJ', 'IwV', '(Lcom/bitwig/ramona/core/oDc;)Z'),
    ('helper.inserted', 'dgJ', 'MRY', '(Lcom/bitwig/ramona/core/oDc;)V'),
    ('helper.removed', 'dgJ', 'Hnt', '(Lcom/bitwig/ramona/core/oDc;)V'),
    ('helper.prune', 'dgJ', 'FzB', '(Lcom/bitwig/ramona/core/oDc;)V'),
    ('helper.related', 'dgJ', 'cfM',
     '(Lcom/bitwig/ramona/core/oDc;Lcom/bitwig/ramona/core/oDc;)Z'),
    ('helper.empty', 'dgJ', 'cfM', '()Z'),
    ('helper.append', 'dgJ', 'appendChanges', '(Ljava/lang/Runnable;)V'),
    ('helper.clinit', 'dgJ', '<clinit>', '()V'),
    ('document.edit-match', 'dfI', 'cfM', '(Lcom/bitwig/ramona/core/oDc;LdfT;)V'),
    ('document.inserted', 'dfI', 'UNj', '(Lcom/bitwig/ramona/core/oDc;)V'),
    ('document.removed', 'dfI', 'hUR', '(Lcom/bitwig/ramona/core/oDc;)V'),
    ('document.pending', 'dfI', 'IwV', '(Lcom/bitwig/ramona/core/oDc;)LdgI;'),
    ('object.ancestor', 'com/bitwig/ramona/core/AVL', 'LaE', '(Lcom/bitwig/ramona/core/OLR;)Z'),
    ('object.parent', 'com/bitwig/ramona/core/oDc', 'J_', '()Lcom/bitwig/ramona/core/oDc;'),
    ('identity-set.init0', 'cQy', '<init>', '()V'),
    ('identity-set.init1', 'cQy', '<init>', '(I)V'),
    ('identity-strategy.init', 'cQz', '<init>', '()V'),
    ('identity-strategy.hash', 'cQz', 'cfM', '(Ljava/lang/Object;)I'),
    ('identity-strategy.equal', 'cQz', 'cfM', '(Ljava/lang/Object;Ljava/lang/Object;)Z'),
    ('open-set.init2', 'eTi', '<init>', '(ILepU;)V'),
    ('open-set.init3', 'eTi', '<init>', '(IFLepU;)V'),
    ('abstract-set.init', 'eOM', '<init>', '()V'),
    ('abstract-collection.init', 'eOD', '<init>', '()V'),
    ('hash.array-size', 'epV', 'MRY', '(IF)I'),
    ('hash.max-fill', 'epV', 'cfM', '(IF)I'),
    ('hash.mix', 'epV', 'cfM', '(I)I'),
    ('hash.next-power', 'epV', 'Hnt', '(J)J'),
    ('open-set.add', 'eTi', 'add', '(Ljava/lang/Object;)Z'),
    ('open-set.is-empty', 'eTi', 'isEmpty', '()Z'),
    ('open-set.iterator-bridge', 'eTi', 'iterator', '()Ljava/util/Iterator;'),
    ('open-set.iterator', 'eTi', 'cfM', '()LeSY;'),
    ('open-set.remove', 'eTi', 'remove', '(Ljava/lang/Object;)Z'),
    ('open-set.remove-entry', 'eTi', 'FzB', '(I)Z'),
    ('open-set.remove-null', 'eTi', 'IwV', '()Z'),
    ('open-set.shift', 'eTi', 'MRY', '(I)V'),
    ('open-set.rehash', 'eTi', 'Hnt', '(I)V'),
    ('open-set.real-size', 'eTi', 'FzB', '()I'),
    ('set-iterator.init-bridge', 'eTk', '<init>', '(LeTi;LeTj;)V'),
    ('set-iterator.init', 'eTk', '<init>', '(LeTi;)V'),
    ('set-iterator.has-next', 'eTk', 'hasNext', '()Z'),
    ('set-iterator.next', 'eTk', 'next', '()Ljava/lang/Object;'),
    ('set-iterator.remove', 'eTk', 'remove', '()V'),
    ('set-iterator.shift', 'eTk', 'cfM', '(I)V'),
    ('wrapped-list.init', 'eSw', '<init>', '(I)V'),
    ('wrapped-list.add', 'eSw', 'add', '(Ljava/lang/Object;)Z'),
    ('wrapped-list.get', 'eSw', 'get', '(I)Ljava/lang/Object;'),
    ('wrapped-list.set', 'eSw', 'set', '(ILjava/lang/Object;)Ljava/lang/Object;'),
)

# SHA-256 of the canonical token list of each target on 6.1.4. Labels replace
# vendor class and member names, so a renamed fixture has the same digests.
PINNED = {
    'helper.init':
        'c5236db2291867e209beb5d380b3b6f1f8badc7986713c07479faac1b594985a',
    'helper.add':
        'e245249e09ba6e47807c8bc5f470477bbb339af63b1420a228f0c88b86b34bbe',
    'helper.attach':
        'f63f6b542f36dc31d0d4c042f9b2b5612b0f4ce61f390e917d1c96f6507347e6',
    'helper.match':
        'db5a891d52a25d20985e832aead7071a9e7fb3507e320482fcf97cfda91dfe43',
    'helper.inserted':
        '5db159fc5859a44b10472007e09143fab136bcc70ed1f270ea3230aa125f9c2b',
    'helper.removed':
        '5db159fc5859a44b10472007e09143fab136bcc70ed1f270ea3230aa125f9c2b',
    'helper.prune':
        'eca44a0510ea3dc4f9cb1f2627d4cfcb45a8b265ad8f963681242b62788b0009',
    'helper.related':
        'f23a3c7b92ec7eabde2de8f82bb8c68dd06cd631ff36a73dc819827d04ac7713',
    'helper.empty':
        '840abb2a0ed5487eb899b159f5790cf76d2f2e2a11f8afb8ca747b4eef0392d1',
    'helper.append':
        '32615f12b7390119acf16c09c33c1df100e65be9ce6cb4a089ea1c460f9c3f54',
    'helper.clinit':
        'cc2efb0d9f9bf257d58554dcaed6115243875ee0bb3fe9d103a413ed47989cb9',
    'document.edit-match':
        '50edd89850187f3d9a4fb62d7fb3c360f90f1ebe4961e370f5ae06b3bcd9a27f',
    'document.inserted':
        'e3afa446072c95352b8e6d20b0b8443c5a59fbfe099a4816c711aefea942b60f',
    'document.removed':
        '88bf5369b57c5b0fbb17f6f0fde99dfca8a3e354bee976819691b0357f7eaf37',
    'document.pending':
        '969673cd0f94f98bc64d572d1cca95ce9388a20fb6a13d50f5f4ceb1919cc148',
    'object.ancestor':
        'fe105743a579210591dfb39fc8d4aec466988f0d5b78512b88c54ac52f34f229',
    'object.parent':
        '1d1aab736d897907689e52f556b9c5740a29d3e0d84c12d7d7e4a36fcba2ac6f',
    'identity-set.init0':
        'f170d9edbd055a40a3465a0e35cb5c168ec151c2adca94d369d955a8f6ac702f',
    'identity-set.init1':
        '20f9b1f9fad661a99a3d0ffbfbdb923914782b540a926895650b0d776bf3517c',
    'identity-strategy.init':
        '162ad02002f72ad69867d84dd6f35ef7a9fdd6e4551ebafd38d768cb798c6d66',
    'identity-strategy.hash':
        '263645887f4b9bb7063e9d451c32eb48b456132e92b3b02fb859c8b9e2dff7a3',
    'identity-strategy.equal':
        '5153eac829fcddb318327cff5684269dc643d24f3cbfd41c69a7250cba572462',
    'open-set.init2':
        '9470c739d9f5553ac9f4494ea052e0cddd4c2479c01711c5bb0820ee6e0efce1',
    'open-set.init3':
        'd4aad390280591eb4832269ce62c134abf52c26655f275a6173409f09f4c45fc',
    'abstract-set.init':
        '4344f79878e71c93559435d79dd9bbf8f5ea59e33af911a313a0b6541fbb66ea',
    'abstract-collection.init':
        'd5968ef33db48fb5abdd17e0ac14ac307720585aa778662c17184ca2fd7666b6',
    'hash.array-size':
        'f50632f2d98bfb4fc43d6d43abd4cdbec7a5e23bf9e0daf28d6424411492f8f6',
    'hash.max-fill':
        'f70593ad5508e60f5e902fd6747ffc01e06b55286154257e6bb7ffeed5f13011',
    'hash.mix':
        '8955b431073ae87ab2acc2d3d89b593745d10d3846ef837257c40500a990b8b7',
    'hash.next-power':
        '5af6c10186e1f44e47f4d0189b4f2c65f26581bf9b02ca4cf6f3ab4e7f7e3da0',
    'open-set.add':
        '735582f85675b3fa601d614191bfa547d94adf9e557bfc0b68f8c34f84db4181',
    'open-set.is-empty':
        '06aed45ca99d015da631af0ccbce78576fc0b59efaeab86e1cef71a3732f390d',
    'open-set.iterator-bridge':
        '80f589a4651189add7e2c8d4a457560be8657ceedcdf1d48985a6b3953f31434',
    'open-set.iterator':
        '6d8d5396bef19cb57f1fd9c74a05b1ff85a87ee46746874bcfdfa30692f77926',
    'open-set.remove':
        'fd82c6aae7f5f37eb0b67dacc86461408651b07a73cf8b09d66d77f0898ff47d',
    'open-set.remove-entry':
        'dde5699039130e307c52575a7a23bba22d1f28259e9091c8e3b4d306eaa66dc0',
    'open-set.remove-null':
        '59021137e2dc24a8062a8246b730c21a6873810e525d4f811e069a46e228df02',
    'open-set.shift':
        '49e284c0402267f7dfdfe454db0a0714d07ee1bc3cb9e63333c5b597568c2901',
    'open-set.rehash':
        '8ad58194d689d2a5eb7952596187914353f51e39d58de304d8471a65e55d6d05',
    'open-set.real-size':
        '293743a66666b436b7bb254bb04d08bc9233987743400e81405b5dcb6898369d',
    'set-iterator.init-bridge':
        'b8fd5042e39dba037c5b7b97cf45f3e1f4190a790fafa4a4032a6f84446d1847',
    'set-iterator.init':
        '04acf59c3e93e7241daf40f7463929725e82a2f4fc8796882f62f5368bd0aa06',
    'set-iterator.has-next':
        '9d9f0ff2bd9794c35d1ee73033ef53157ce179fd6c23f99f1109966ead4dccad',
    'set-iterator.next':
        '9435def72d34347332ea630cac8ea446b517439d758cab9902194fa5d456a55e',
    'set-iterator.remove':
        'a66a6d8334b415b8da3744fb1d5eaca52a9680da0b106496b6ce62d25f37e604',
    'set-iterator.shift':
        'f7c5576a60e9f4db24e46ee3a912fe54acdfb24e7a342447a6a567701599469e',
    'wrapped-list.init':
        '17f42f171d2ee6dcab67da6cfe6acc13fd84ac222e0ff3361057d6b20e86b2ad',
    'wrapped-list.add':
        'd9d4d03c7caea3b52f0fb29716374a89a4a0515ca32103ea4e359c76277017ca',
    'wrapped-list.get':
        'a92bf5c98145d50594355fc550480ddd3c6b579cbf29e82a2eeea96ff99c38a7',
    'wrapped-list.set':
        'b969ed03a79d71b9083cde79ee19e8a6b4bb4c37b4733df31735c9147f290ecb',
}

BRANCHES = set(range(153, 169)) | {198, 199}
WIDE_BRANCHES = {200, 201}
REFERENCES = {178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 189, 192, 193, 197}
CONSTANTS = {18, 19, 20}


class Binder:
    """Give each vendor member one label. Keep the mapping one to one."""

    def __init__(self, types):
        self.types, self.labels, self.reverse, self.count = types, {}, {}, 0

    def role(self, name):
        if name.startswith('['):
            return self.desc(name)
        if name.startswith(('java/', 'jdk/')):
            return name
        role = self.types.get(name)
        if role is None:
            raise Refusal('history-growth-unbound-type:' + name)
        return '@' + role

    def desc(self, value):
        return re.sub(r'L([^;]+);', lambda m: 'L' + self.role(m[1]) + ';', value)

    def member(self, owner, name, desc, label=None):
        role, canonical = self.role(owner), self.desc(desc)
        if not role.startswith('@'):
            return [role, name, canonical]
        key = (role, name, canonical)
        if key not in self.labels:
            label = label or 'm%d' % self.count
            if label in self.reverse:
                raise Refusal('history-growth-label-collision:' + label)
            self.count += label.startswith('m')
            self.labels[key], self.reverse[label] = label, key
        elif label is not None and self.labels[key] != label:
            raise Refusal('history-growth-label-conflict:' + label)
        return [role, self.labels[key], canonical]


def symbolic(binder, value, boot):
    tag = value.get('tag')
    if tag in (9, 10, 11):
        return [tag, *binder.member(value['owner'], value['name'], value['descriptor'])]
    if tag == 7:
        return [7, binder.role(value['value'])]
    if tag == 16:
        return [16, binder.desc(value['value'])]
    if tag == 15:
        return [15, value['kind'], symbolic(binder, value['target'], boot)]
    if tag in (3, 4, 5, 6, 8):
        return [tag, value['value']]
    if tag == 18:
        if value['bootstrapIndex'] >= len(boot):
            raise Refusal('history-growth-bootstrap-index')
        entry = boot[value['bootstrapIndex']]
        return [18, value['name'], binder.desc(value['descriptor']),
                symbolic(binder, entry['handle'], boot),
                [symbolic(binder, a, boot) for a in entry['arguments']]]
    raise Refusal('history-growth-constant-tag:' + str(tag))


def canonical(cls, method, binder, boot):
    """Return name-independent tokens with instruction-index branch targets."""
    raw = instructions(method.code)
    if not raw or len(raw) > 4096:
        raise Refusal('history-growth-body-limit')
    index = {r[0]: i for i, r in enumerate(raw)}
    tokens = []
    for offset, op, args in raw:
        if op in (170, 171, 168, 169) or op in WIDE_BRANCHES:
            raise Refusal('history-growth-control-form')
        if op in BRANCHES:
            target = offset + int.from_bytes(bytes(args), 'big', signed=True)
            if target not in index:
                raise Refusal('history-growth-branch-target')
            tokens.append([op, 'to', index[target]])
        elif op in REFERENCES or op in CONSTANTS:
            width = 1 if op == 18 else 2
            value = constant(cls, int.from_bytes(bytes(args[:width]), 'big'))
            tokens.append([op, symbolic(binder, value, boot), list(args[width:])])
        else:
            tokens.append([op, list(args)])
    handlers = []
    for start, end, handler, kind in method.handlers:
        if start not in index or handler not in index or (end not in index and end != len(method.code)):
            raise Refusal('history-growth-handler-range')
        caught = binder.role(constant(cls, kind)['value']) if kind else None
        handlers.append([index[start], index.get(end, len(raw)), index[handler], caught])
    return {'flags': method.flags, 'tokens': tokens, 'handlers': handlers}


def token_digest(value):
    return hashlib.sha256(json.dumps(value, separators=(',', ':')).encode()).hexdigest()


def find(cls, name, desc):
    hits = [m for m in cls.methods if m.name == name and m.desc == desc]
    if len(hits) != 1:
        raise Refusal('history-growth-method-count:' + cls.name + '.' + name)
    return hits[0]


def check_bodies(load, rename_class=lambda n: n, rename_member=lambda n: n, pinned=None):
    """Check every target against its pinned digest. Refuse any deviation.

    load(name) returns (Class, bootstrap list). The rename functions map an
    original 6.1.4 name to the name in the jar under test.
    """
    pinned = PINNED if pinned is None else pinned
    types = {rename_class(k): v for k, v in ROLES.items()}
    if len(set(types)) != len(ROLES):
        raise Refusal('history-growth-role-collision')
    binder = Binder(types)
    for label, owner, name, desc in TARGETS:
        binder.member(rename_class(owner), rename_member(name), retype(desc, rename_class), label)
    rows, classes = {}, {}
    for label, owner, name, desc in TARGETS:
        actual = rename_class(owner)
        if actual not in classes:
            classes[actual] = load(actual)
        cls, boot = classes[actual]
        method = find(cls, rename_member(name), retype(desc, rename_class))
        body = canonical(cls, method, binder, boot)
        value = token_digest(body)
        if label in pinned and pinned[label] != value:
            raise Refusal('history-growth-body:' + label)
        rows[label] = {'digest': value, 'instructions': len(body['tokens']),
                       'flags': method.flags, 'handlers': len(body['handlers'])}
    missing = [label for label, *_ in TARGETS if label not in pinned]
    if pinned and missing:
        raise Refusal('history-growth-unpinned:' + missing[0])
    check_storage(classes, rename_class, rename_member)
    check_lambdas(classes, rename_class, rename_member)
    return {'targets': rows, 'labels': {k: list(v) for k, v in binder.reverse.items()},
            'runtimeClassesInitialized': 0, 'boundedAdmission': False}


def retype(desc, rename_class):
    return re.sub(r'L([^;]+);', lambda m: 'L' + rename_class(m[1]) + ';', desc)


def check_storage(classes, rename_class, rename_member):
    """Require private final storage fields with the expected declared types."""
    expected = {
        ('helper', 'MRY', 'Ljava/util/Set;', 18), ('helper', 'Hnt', 'LdfT;', 2),
        ('document', 'Z1C', 'Ljava/util/List;', 18), ('document', 'dnz', 'Ljava/util/Set;', 18),
        ('document', 'dEI', 'LdgJ;', 2),
    }
    owners = {'helper': rename_class('dgJ'), 'document': rename_class('dfI')}
    for role, name, desc, flags in expected:
        cls = classes[owners[role]][0]
        hits = [f for f in cls.fields if f.name == rename_member(name)
                and f.desc == retype(desc, rename_class)]
        if len(hits) != 1 or hits[0].flags != flags:
            raise Refusal('history-growth-storage-field:' + role + '.' + name)


def check_lambdas(classes, rename_class, rename_member):
    """Bind the two predicate bootstraps to their exact implementation handles."""
    helper, boot = classes[rename_class('dgJ')]
    expected = [16, '(Ljava/lang/Object;)Z']
    binder = Binder({rename_class(k): v for k, v in ROLES.items()})
    prune = find(helper, rename_member('FzB'), retype('(Lcom/bitwig/ramona/core/oDc;)V', rename_class))
    sites = [r for r in instructions(prune.code) if r[1] == 186]
    if len(sites) != 1:
        raise Refusal('history-growth-prune-site')
    value = constant(helper, int.from_bytes(bytes(sites[0][2][:2]), 'big'))
    entry = boot[value['bootstrapIndex']]
    handle, args = entry['handle'], entry['arguments']
    if (handle.get('kind') != 6 or handle['target'].get('owner') != 'java/lang/invoke/LambdaMetafactory'
            or handle['target'].get('name') != 'metafactory' or len(args) != 3
            or symbolic(binder, args[0], boot) != expected or args[1].get('kind') != 6
            or args[1]['target'] != {'tag': 10, 'owner': rename_class('dgJ'),
                                     'name': rename_member('cfM'),
                                     'descriptor': retype('(Lcom/bitwig/ramona/core/oDc;'
                                                          'Lcom/bitwig/ramona/core/oDc;)Z', rename_class)}):
        raise Refusal('history-growth-prune-bootstrap')
    document, dboot = classes[rename_class('dfI')]
    cleanup = find(document, rename_member('wGc'), '()V')
    sites = [r for r in instructions(cleanup.code) if r[1] == 186]
    if len(sites) != 1:
        raise Refusal('history-growth-cleanup-site')
    value = constant(document, int.from_bytes(bytes(sites[0][2][:2]), 'big'))
    entry = dboot[value['bootstrapIndex']]
    handle, args = entry['handle'], entry['arguments']
    if (handle.get('kind') != 6 or handle['target'].get('owner') != 'java/lang/invoke/LambdaMetafactory'
            or handle['target'].get('name') != 'metafactory' or len(args) != 3
            or value.get('descriptor') != '()Ljava/util/function/Predicate;'
            or symbolic(binder, args[0], dboot) != expected or args[1].get('kind') != 5
            or args[1]['target'] != {'tag': 10, 'owner': rename_class('dgJ'),
                                     'name': rename_member('cfM'), 'descriptor': '()Z'}):
        raise Refusal('history-growth-cleanup-bootstrap')


def old_structure(cls, set_type='Ljava/util/Set;'):
    """Report whether a document class declares any helper-set storage."""
    sets = [f for f in cls.fields if f.desc == set_type]
    return {'document': cls.name, 'setFields': [[f.name, f.flags] for f in sets],
            'structurePresent': bool(sets), 'boundedAdmission': False,
            'runtimeClassesInitialized': 0}


# Own-instruction counts of each top-level body on the production path:
# every assertion flag is already initialized true, so each guard costs two
# instructions and skips its block. Derived from the exact bodies above.
OWN = {
    'document.removed': {'constant': 8, 'perHelper': 11},
    'document.inserted': {'empty': 5, 'constant': 12, 'perHelper': 11},
    'document.edit-match': {'empty': 5, 'constant': 12, 'perHelper': 15, 'perMatchedHelper': 2},
    'helper.attach': {'noMatch': 13, 'match': 16},
    'helper.match': {'constant': 4, 'perMissedElement': 15, 'absentExit': 5,
                     'identityExit': 12, 'ancestorExit': 16},
    'helper.related': {'identity': 6, 'ancestor': 10, 'miss': 9},
    'helper.prune': 7, 'helper.inserted': 4, 'helper.removed': 4, 'helper.empty': 4,
    'helper.init': 15, 'helper.add': 8,
    'object.ancestor': {'constant': 7, 'perAncestor': 9, 'nullExit': 4, 'matchExit': 7},
    'object.parent': 3,
}

# Exact path formulas of the inert model over the exact 6.1.4 bytes. The
# constants are fixed path counts; the linear terms follow from each loop.
# s: set size; n: table length; K: empty slots that the set iterator skips
# (K <= n - s); W: walked parent count summed over the set (W <= s*D);
# H: helpers in Z1C; M: matched helpers. Natives, StrictMath.ceil, and
# generated lambda frames count as calls only.
FORMULAS = {
    'helper.match-absent': ((51, 78, 13, 12), (1, 0)),
    'helper.prune-none': ((49, 72, 13, 12), (18, 8)),
    'document.removed': {'vendor': (8, 11, 4), 'jdk': (35, 46)},
    'document.inserted': {'empty': (5, 6), 'vendorExtra': 4, 'jdkExtra': 5},
    'document.edit-match': {'empty': (5, 6), 'vendor': (12, 15, 2, 16), 'jdk': (40, 47),
                            'jdkPerMatchLoopFree': 112},
    'open-set.remove-absent': (44, 24),
}


def set_scan(name, s, n, depth):
    """Upper bound (vendor, JDK) of one helper-set scan without removal."""
    (a, b, k, w), (ja, jb) = FORMULAS[name]
    if s < 0 or n < s or depth < 0:
        raise Refusal('history-growth-scan-input')
    return a + b * s + k * (n - s) + w * s * depth, ja + jb * s


def document_scan(name, sets, depth, matched=0):
    """Upper bound (vendor, JDK) of one document scan over helper sets (s, n).

    No helper may lose a set entry. Removal paths have a separate coarse bound.
    """
    if name == 'document.removed' or name == 'document.inserted':
        if name == 'document.inserted' and not sets:
            return FORMULAS[name]['empty']
        (c, h, d), (jc, jh) = FORMULAS['document.removed']['vendor'], FORMULAS['document.removed']['jdk']
        parts = [set_scan('helper.prune-none', s, n, depth) for s, n in sets]
        vendor = c + h * len(sets) + sum(d + v for v, _ in parts)
        jdk = jc + jh * len(sets) + sum(j for _, j in parts)
        if name == 'document.inserted':
            vendor += FORMULAS[name]['vendorExtra']; jdk += FORMULAS[name]['jdkExtra']
        return vendor, jdk
    if name == 'document.edit-match':
        f = FORMULAS[name]
        if not sets:
            return f['empty']
        c, h, m, attach = f['vendor']
        parts = [set_scan('helper.match-absent', s, n, depth) for s, n in sets]
        vendor = c + h * len(sets) + m * matched + sum(attach + v for v, _ in parts)
        jdk = f['jdk'][0] + f['jdk'][1] * len(sets) + matched * f['jdkPerMatchLoopFree']
        return vendor, jdk
    raise Refusal('history-growth-scan:' + name)


def path_cost(name, **v):
    """Evaluate the own-instruction count of one top-level body."""
    o = OWN[name]
    if name == 'document.removed':
        return o['constant'] + o['perHelper'] * v['helpers']
    if name == 'document.inserted':
        return o['empty'] if not v['helpers'] else o['constant'] + o['perHelper'] * v['helpers']
    if name == 'document.edit-match':
        if not v['helpers']:
            return o['empty']
        return o['constant'] + o['perHelper'] * v['helpers'] + o['perMatchedHelper'] * v['matched']
    if name == 'helper.match':
        exit_cost = {'absent': o['absentExit'], 'identity': o['identityExit'],
                     'ancestor': o['ancestorExit']}[v['exit']]
        return o['constant'] + o['perMissedElement'] * v['missed'] + exit_cost
    if name == 'object.ancestor':
        tail = o['nullExit'] + o['perAncestor'] * v['walked'] if v['exit'] == 'null' \
            else o['matchExit'] + o['perAncestor'] * (v['walked'] - 1)
        return o['constant'] + tail
    raise Refusal('history-growth-path:' + name)


def table_length(expected, factor=0.75):
    """Mirror the exact array-size helper: max(2, nextPowerOfTwo(ceil(e/f)))."""
    import math
    value = max(2, 1 << (math.ceil(expected / factor) - 1).bit_length())
    if value > 1 << 30:
        raise Refusal('history-growth-table-limit')
    return value


def capacity_bound(initial, largest):
    """Bound the table length after any add/iterator-removal history.

    Growth happens only in add: rehash(arraySize(size + 1)). Iterator removal
    never shrinks. Direct removal can halve the table. Thus the length is at
    most max(arraySize(initial), arraySize(largest + 1)).
    """
    return max(table_length(initial), table_length(largest + 1))
