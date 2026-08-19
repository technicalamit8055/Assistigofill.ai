/**
 * Dictionary-based field scoring.
 * Master spec §14.3 (priority 4), §14.6 (confidence bands); docs/FORM_ENGINE.md §4.
 *
 * The scorer answers one question: given the metadata for a form field, which customer field is
 * it most likely to be, and how sure are we?
 *
 * "How sure are we" is not decoration. Below 0.70 the operator has to confirm the mapping before
 * anything is typed, so a well-calibrated low score is as valuable as a high one.
 */

import { MAPPING_DICTIONARY, normalizeLabel, type DictionaryEntry } from './dictionary';
import type { DetectedField } from './types';

export type ScoreSignal =
  | 'label_exact'
  | 'attribute_exact'
  | 'aria_or_placeholder_exact'
  | 'label_tokens'
  | 'attribute_partial'
  | 'nearby_text'
  | 'section_heading';

/** Weights from docs/FORM_ENGINE.md §4. Kept as data so they can be tuned against pilot results. */
const SIGNAL_WEIGHTS: Record<ScoreSignal, number> = {
  label_exact: 1.0,
  attribute_exact: 0.95,
  aria_or_placeholder_exact: 0.9,
  label_tokens: 0.8,
  attribute_partial: 0.72,
  nearby_text: 0.65,
  section_heading: 0.55,
};

/** A field whose input type contradicts the mapping is probably not that field. */
const INPUT_TYPE_PENALTY = 0.5;

export type ScoredCandidate = {
  customerField: string;
  score: number;
  signal: ScoreSignal;
  transform?: string;
};

/** Every piece of text on a field that could name it, most authoritative first. */
function fieldTexts(field: DetectedField) {
  return {
    label: normalizeLabel(field.labelText),
    aria: normalizeLabel(field.ariaLabel),
    placeholder: normalizeLabel(field.placeholder),
    attributes: normalizeLabel([field.name, field.id].filter(Boolean).join(' ')),
    nearby: normalizeLabel(field.nearbyText),
    heading: normalizeLabel(field.sectionHeading),
  };
}

function tokenSet(text: string): Set<string> {
  return new Set(text.split(' ').filter((token) => token.length > 1));
}

/**
 * A negative keyword anywhere in the field's own naming rejects the candidate outright.
 *
 * Section headings and nearby text are deliberately excluded: on a form where a "Personal
 * Details" section sits above a "Father's Details" section, nearby text bleeds across the
 * boundary and would veto correct mappings.
 */
function isRejected(entry: DictionaryEntry, texts: ReturnType<typeof fieldTexts>): boolean {
  if (!entry.negative || entry.negative.length === 0) return false;
  const own = [texts.label, texts.aria, texts.placeholder, texts.attributes].join(' ');
  return entry.negative.some((word) => own.includes(normalizeLabel(word)));
}

function bestSignal(
  entry: DictionaryEntry,
  texts: ReturnType<typeof fieldTexts>,
): ScoreSignal | null {
  const synonyms = entry.synonyms.map(normalizeLabel).filter(Boolean);
  const attributes = (entry.attributes ?? []).map(normalizeLabel).filter(Boolean);

  if (texts.label && synonyms.includes(texts.label)) return 'label_exact';

  if (texts.attributes) {
    const attributeTokens = tokenSet(texts.attributes);
    if (attributes.some((candidate) => texts.attributes === candidate)) return 'attribute_exact';
    // "applicant_name" normalises to "applicant name"; match on the joined form too.
    if (
      attributes.some(
        (candidate) => texts.attributes.replace(/\s+/g, '') === candidate.replace(/\s+/g, ''),
      )
    ) {
      return 'attribute_exact';
    }
    if (
      attributes.some((candidate) => {
        const candidateTokens = [...tokenSet(candidate)];
        return (
          candidateTokens.length > 0 && candidateTokens.every((token) => attributeTokens.has(token))
        );
      })
    ) {
      return 'attribute_partial';
    }
  }

  if (
    (texts.aria && synonyms.includes(texts.aria)) ||
    (texts.placeholder && synonyms.includes(texts.placeholder))
  ) {
    return 'aria_or_placeholder_exact';
  }

  if (texts.label) {
    const labelTokens = tokenSet(texts.label);
    const matched = synonyms.some((synonym) => {
      const synonymTokens = [...tokenSet(synonym)];
      if (synonymTokens.length === 0) return texts.label.includes(synonym);
      return synonymTokens.every((token) => labelTokens.has(token));
    });
    if (matched) return 'label_tokens';
    // Devanagari synonyms are single tokens that appear inside a longer Hindi phrase.
    if (synonyms.some((synonym) => synonym.length > 2 && texts.label.includes(synonym))) {
      return 'label_tokens';
    }
  }

  if (
    texts.nearby &&
    synonyms.some((synonym) => synonym.length > 3 && texts.nearby.includes(synonym))
  ) {
    return 'nearby_text';
  }

  if (
    texts.heading &&
    synonyms.some((synonym) => synonym.length > 3 && texts.heading.includes(synonym))
  ) {
    return 'section_heading';
  }

  return null;
}

function inputTypeCompatible(entry: DictionaryEntry, field: DetectedField): boolean {
  if (!entry.inputTypes || entry.inputTypes.length === 0) return true;
  const actual = field.inputType.toLowerCase();
  if (field.tagName === 'textarea') return entry.inputTypes.includes('textarea');
  if (field.tagName === 'select') {
    return entry.inputTypes.some((type) => type.startsWith('select'));
  }
  return entry.inputTypes.includes(actual);
}

/** All plausible mappings for one field, best first. */
export function scoreField(
  field: DetectedField,
  dictionary: readonly DictionaryEntry[] = MAPPING_DICTIONARY,
): ScoredCandidate[] {
  const texts = fieldTexts(field);
  const candidates: ScoredCandidate[] = [];

  for (const entry of dictionary) {
    if (isRejected(entry, texts)) continue;

    const signal = bestSignal(entry, texts);
    if (!signal) continue;

    let score = SIGNAL_WEIGHTS[signal];
    if (!inputTypeCompatible(entry, field)) score *= INPUT_TYPE_PENALTY;

    candidates.push({
      customerField: entry.customerField,
      score: Number(score.toFixed(3)),
      signal,
      ...(entry.transform ? { transform: entry.transform } : {}),
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  /*
   * Two candidates tied at the top means the field's naming genuinely does not distinguish
   * between them — for instance a bare "district" on a form that has both a current and a
   * permanent address block. Reporting full confidence there would be a lie, so the winner is
   * demoted into the review band and the operator decides.
   */
  const [first, second] = candidates;
  if (first && second && Math.abs(first.score - second.score) < 0.001) {
    first.score = Number(Math.min(first.score, 0.65).toFixed(3));
  }

  return candidates;
}

export function bestMatch(
  field: DetectedField,
  dictionary: readonly DictionaryEntry[] = MAPPING_DICTIONARY,
): ScoredCandidate | null {
  return scoreField(field, dictionary)[0] ?? null;
}
