/**
 * ⚠⚠ The words that may not cross the tool surface — D18c's one-way door, as a
 * list something can assert against.
 *
 * Two rules live here, and they fail in different directions:
 *
 *   1. **No choice-mapping** (D18c). *"Tool descriptions carry complete
 *      mechanical knowledge ... and ZERO choice-mapping: nothing that maps the
 *      shape of a change onto a mechanism."* A leak *"contaminates every event
 *      logged after it, irrecoverably"* — every branch event recorded afterwards
 *      is measuring an agent that was told the answer, and no amount of later
 *      editing takes the sentence back out of the record.
 *   2. **No spike jargon** (D18c, operator 2026-08-07). The surface is written
 *      from scratch for a general-purpose agent. This project's internal
 *      vocabulary — a *take*, the *stash*, the *floor*, an *epoch* — names things
 *      an agent has no reason to know about, and using them would make the
 *      surface a view of our implementation rather than of the music.
 *
 * ⚠ The list IS the record, in the style of `WIRE_METHODS_BANNED` and
 * `STASH_MUTATORS`: each entry says why, so the ban survives a refactor by
 * someone who never read D18c, and removing an entry is a reviewable act rather
 * than a silent one. `surface.test.ts` checks it against three things — the tool
 * names, the JSON schema an agent actually receives, and the TEXT every exercised
 * tool emits, refusals included.
 *
 * ⚠ **False positives are expected and are not a defect.** *"A guard that never
 * fires is not a guard, and the remedy is to widen the exemption list
 * EXPLICITLY, one entry at a time"* (session 3d). `SURFACE_WORD_EXEMPTIONS` is
 * that list, and it is empty today because the surface was written under the ban
 * rather than retrofitted to it.
 *
 * ⚠ What this deliberately does NOT do is rewrite text at runtime. A sanitiser
 * that silently reworded a message would make the guard pass while the leak
 * shipped; the surface owns its own words instead, and the one place internal
 * wording can still reach an agent is the unexpected-error fallback in
 * `report.ts`, which is documented there as a bug report rather than a designed
 * message.
 */

/**
 * ⚠ Matched as a whole word with an ordinary English suffix, so `fork` catches
 * `forking` while `reap` does not catch `reappear`. Prefix matching was the first
 * cut and it fired on `reapply`, which is a word this surface has a legitimate
 * use for — the sort of false positive that gets a guard switched off.
 */
const SUFFIXES = '(?:s|es|ed|ing)?';

export const SURFACE_WORDS_BANNED: Readonly<Record<string, string>> = {
  // --- choice-mapping: the mechanisms, by name (D18c) -----------------------
  fork:
    'the track-fork branch mechanism. Naming a mechanism on the surface is the choice-mapping '
    + 'leak in its purest form — and the mechanism does not exist yet, so a description that '
    + 'mentioned one would be describing something an agent cannot call.',
  branch:
    'the same leak one level up: "branch" is the category the three mechanisms live in, and a '
    + 'surface that offers to branch has already mapped a change onto one of them.',
  layer:
    'the layer-chain branch mechanism (3f). Nothing on this surface reaches a device layer.',
  chain:
    'the layer-chain mechanism again, and the word this project uses for a device chain — which '
    + 'is why the device tools say "position in the track" instead. Two meanings, one of them a '
    + 'mechanism, is exactly the ambiguity a fresh vocabulary exists to avoid.',
  duplicate:
    'the clip-block mechanism\'s verb (3e). Nothing here duplicates anything, and a description '
    + 'that mentioned duplication would map a change onto a mechanism before the mechanism ships.',
  lineage:
    'the spike\'s word for the group structure a fork builds. Internal, and mechanism-shaped.',
  reap:
    'the spike\'s word for destroying structure the agent did not make (D20). The destructive '
    + 'tools say what they delete in plain words instead.',

  // --- spike jargon: our machinery, not the agent's world (D18c) ------------
  take:
    'this project\'s word for one recorded batch. The surface calls it a CHANGE, because that is '
    + 'what it is to the person whose music it altered.',
  changeset: 'the same thing under its other internal name.',
  stash:
    'the in-memory record of what each batch replaced. An agent needs to know a change can be '
    + 'put back, not where we keep the "before".',
  floor:
    'the internal name of the refusal that stops a write it could not put back. The refusal says '
    + 'what it could not record; it never names its own machinery.',
  epoch:
    'the counters that make a stale row address refusable. The surface reports a refusal and what '
    + 'to do about it; the counter behind it is ours.',
  'write-set': 'this project\'s word for the addresses a batch touches.',
  changelog: 'not a thing this system has — the project is the record, and `list_changes` is the view.',

  // --- heuristic language (D18d: v1 ships mechanics, not advice) ------------
  typically:
    'D18d: v1 descriptions carry mechanics, trade-offs and correctness recipes, with "no worked '
    + 'examples, no heuristics, no typically/recommended language". A hedge is a pre-drawn '
    + 'conclusion wearing a softer word.',
  recommended: 'as `typically` — a recommendation is a choice already made for the agent.',
  usually: 'as `typically`.',
  prefer: 'as `typically`, in the imperative.',
  'use this when': 'the exact sentence D18c names as the smell: a rule about WHEN, not a fact.',
  'use it when': 'as `use this when`.',
  'instead use': 'a redirect. Refusal text says what is impossible; it never points elsewhere.',
};

/**
 * ⚠ Explicit, one entry at a time, each naming where and why.
 *
 * Empty on purpose: the surface was written under the ban rather than retrofitted
 * to it, so nothing has needed exempting yet. The shape exists so that the first
 * legitimate collision is recorded here rather than resolved by deleting a ban.
 */
export const SURFACE_WORD_EXEMPTIONS: readonly {
  readonly word: string;
  readonly where: string;
  readonly why: string;
}[] = [];

const patternFor = (word: string): RegExp =>
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${SUFFIXES}\\b`, 'i');

/** Every banned word this text uses. Empty is the passing answer. */
export function bannedWordsIn(text: string, where = ''): string[] {
  const exempt = new Set(
    SURFACE_WORD_EXEMPTIONS.filter((e) => where.includes(e.where)).map((e) => e.word),
  );
  return Object.keys(SURFACE_WORDS_BANNED)
    .filter((word) => !exempt.has(word))
    .filter((word) => patternFor(word).test(text));
}
