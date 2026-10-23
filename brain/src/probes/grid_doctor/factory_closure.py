"""Check the Nitro clone compile guards and list setter as data.

The functions read instruction rows only. They do not run vendor code or
initialize vendor classes. A passing check is a conditional local result.
It is not bounded admission.
"""
import itertools
import struct

from grid_symbols.scan import Refusal

BRANCH_OPS = {153, 154, 157, 158, 198, 199}
VARIABLES = ('S', 'I', 'H', 'F', 'D', 'U', 'ERO_AFTER')
FIELD_VARIABLES = {'IwV': 'I', 'hUR': 'H', 'FzB': 'F', 'dEI': 'D', 'UNj': 'U', 'ERO': 'ERO'}
COUNT_GETTERS = ('Guv', 'wYK')
PORT_GETTERS = ('Bpn', 'iW2')
COMPILE = ('cfM', '(ZZZ)V')
MAX_STEPS = 512
CONDITIONS = (
    'Assertion-disabled flags are initialized true.',
    'BBT() is the constant-false body iconst_0, ireturn.',
    'Guv() and wYK() return the copied nitro input and output list sizes.',
    'The receiver is a fresh clone: ERO is null on entry.',
)


def rows_from_trace(trace):
    """Convert method_trace instruction rows to guard rows with branch targets."""
    rows = []
    for item in trace['instructions']:
        row = {'offset': item['offset'], 'op': item['opcode']}
        if item.get('constant') is not None:
            row['c'] = item['constant']
        if item['opcode'] in BRANCH_OPS or item['opcode'] == 167:
            delta = struct.unpack('>h', bytes(item['args'][:2]))[0]
            row['t'] = item['offset'] + delta
        rows.append(row)
    return rows


def _value(item, env):
    if item == ('sum',):
        return env['S']
    if isinstance(item, tuple) and item[0] == 'field':
        key = FIELD_VARIABLES.get(item[1])
        if key is None:
            raise Refusal('factory-guard-field:' + item[1])
        return env[key]
    if isinstance(item, int):
        return bool(item)
    raise Refusal('factory-guard-value')


def evaluate(rows, env, assertion_flag='MRY'):
    """Return the ordered guard events for one boolean assignment."""
    index = {row['offset']: i for i, row in enumerate(rows)}
    stack, events, local = [], [], None
    i = steps = 0
    env = dict(env)
    while True:
        steps += 1
        if steps > MAX_STEPS or i >= len(rows):
            raise Refusal('factory-guard-steps')
        row = rows[i]
        op, ref = row['op'], row.get('c', {})
        nxt = i + 1
        if op == 42:
            stack.append('this')
        elif op == 178:
            if ref.get('name') != assertion_flag or ref.get('descriptor') != 'Z':
                raise Refusal('factory-guard-static')
            stack.append(('assert',))
        elif op == 180:
            if stack.pop() != 'this':
                raise Refusal('factory-guard-receiver')
            stack.append(('field', ref['name']))
        elif op == 182:
            name, desc = ref['name'], ref['descriptor']
            if name in COUNT_GETTERS and desc == '()I':
                stack.pop()
                stack.append(('count', name))
            elif name == 'BBT' and desc == '()Z':
                stack.pop()
                stack.append(0)
            elif (name, desc) == COMPILE:
                del stack[-4:]
                events.append('compile')
                env['ERO'] = env['ERO_AFTER']
            elif name in PORT_GETTERS and desc == '()Ljava/util/List;':
                events.append('ports')
                return events
            elif name == 'd_' and desc == '(Ljava/lang/String;)V':
                del stack[-2:]
            elif name == 'hUR' and desc == '([B)Ljava/lang/String;':
                del stack[-2:]
                stack.append(('hash',))
            else:
                raise Refusal('factory-guard-call:' + name)
        elif op == 96:
            right, left = stack.pop(), stack.pop()
            if {left, right} != {('count', 'Guv'), ('count', 'wYK')}:
                raise Refusal('factory-guard-sum')
            stack.append(('sum',))
        elif op in (3, 4):
            stack.append(op - 3)
        elif op == 18:
            stack.append(('const',))
        elif op == 54 or op == 60:
            local = stack.pop()
        elif op == 27:
            stack.append(local)
        elif op == 181:
            stack.pop()
            if stack.pop() != 'this':
                raise Refusal('factory-guard-store')
            events.append('put:' + ref['name'])
        elif op in BRANCH_OPS:
            item = stack.pop()
            if item == ('assert',):
                if op != 154:
                    raise Refusal('factory-guard-assertion-form')
                taken = True
            else:
                value = _value(item, env)
                taken = {153: not value, 154: value, 157: value, 158: not value,
                         198: not value, 199: value}[op]
            if taken:
                nxt = index.get(row['t'])
                if nxt is None:
                    raise Refusal('factory-guard-target')
        elif op == 167:
            nxt = index.get(row['t'])
            if nxt is None:
                raise Refusal('factory-guard-target')
        elif op == 177:
            return events
        else:
            raise Refusal('factory-guard-op:' + str(op))
        i = nxt


def expected_bl(env):
    compile_ = (not env['S']) and (env['I'] or (env['H'] and env['F']))
    ports = env['S'] or (compile_ and env['ERO_AFTER'])
    return compile_, ports


def expected_pgx(env):
    return (not env['D']) and (not env['S']) and (env['H'] or env['I'])


def nitro_compile_guards(bl_rows, pgx_rows, assertion_flag='MRY'):
    """Check the compile and port guards of bl_ and Pgx for all assignments."""
    count = 0
    for values in itertools.product((False, True), repeat=len(VARIABLES)):
        env = dict(zip(VARIABLES, values), ERO=False)
        bl = evaluate(bl_rows, env, assertion_flag)
        pgx = evaluate(pgx_rows, env, assertion_flag)
        compile_, ports = expected_bl(env)
        if ('compile' in bl) != compile_ or ('ports' in bl) != ports:
            raise Refusal('factory-guard-bl-formula')
        if ('compile' in pgx) != expected_pgx(env):
            raise Refusal('factory-guard-pgx-formula')
        if ('put:dEI' in pgx) != (not env['D']):
            raise Refusal('factory-guard-pgx-latch')
        count += 1
    return {
        'bl_': 'compile <=> !S && (IwV != null || (hUR && FzB != null)); '
               'ports <=> S || (compile && ERO != null after compile)',
        'Pgx': 'compile <=> !dEI && !S && (hUR || IwV != null); dEI := true when dEI is false',
        'skip': 'S = Guv() + wYK() > 0 excludes both compile calls',
        'assignments': count,
        'conditions': list(CONDITIONS),
        'boundedAdmission': False,
        'runtimeClassesInitialized': 0,
    }


def list_setter_fields(rows, expected):
    """Map lookupswitch keys of a list setter to the first field store in each arm."""
    switches = [row for row in rows if row['op'] == 171]
    if len(switches) != 1:
        raise Refusal('factory-list-switch')
    args = switches[0]['a']
    base = switches[0]['offset']
    targets = {key: base + delta for key, delta in zip(args[1::2], args[2::2])}
    stores = sorted((row['offset'], row['c']['name']) for row in rows
                    if row['op'] == 181 and 'c' in row)
    result = {}
    for key, target in targets.items():
        later = [name for offset, name in stores if offset >= target]
        if not later:
            raise Refusal('factory-list-store')
        result[key] = later[0]
    if result != expected:
        raise Refusal('factory-list-fields')
    return {'fields': result, 'boundedAdmission': False, 'runtimeClassesInitialized': 0,
            'conditions': ['Each switch arm stores its list before any later arm.']}
