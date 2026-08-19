/**
 * Duplicate customer detection.
 * Master spec §9.2 — "Duplicate warning appears if mobile/name/date-of-birth combination is
 * similar", and §17.2 (customer service: duplicate detection).
 *
 * This is a *warning* system, not a blocker. Two brothers with similar names and the same
 * village are a real thing; the operator decides. We surface evidence, never auto-merge.
 */

import { nameComparisonKey, normalizeMobile } from './normalize';

export type DuplicateCandidateInput = {
  id: string;
  fullName: string;
  mobile?: string | null;
  dateOfBirth?: string | null;
  fatherName?: string | null;
  district?: string | null;
};

export type DuplicateSubject = {
  fullName: string;
  mobile?: string | null;
  dateOfBirth?: string | null;
  fatherName?: string | null;
  district?: string | null;
};

export type DuplicateReasonCode =
  | 'SAME_MOBILE'
  | 'SAME_NAME_AND_DOB'
  | 'SAME_NAME_AND_FATHER'
  | 'SIMILAR_NAME_SAME_DISTRICT'
  | 'SIMILAR_NAME';

export type DuplicateMatch = {
  candidateId: string;
  /** 0–1. ≥ 0.9 is a near-certain duplicate; ≥ 0.6 is worth showing. */
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: DuplicateReasonCode[];
};

/** Threshold below which a candidate is not worth interrupting the operator for. */
export const DUPLICATE_WARNING_THRESHOLD = 0.6;

/** Levenshtein distance, capped — names are short so the naive implementation is fine. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/**
 * 0–1 similarity that combines whole-string edit distance with token overlap, so that
 * "Amit Kumar Singh" and "Amit Singh" score well despite the length difference.
 */
export function nameSimilarity(a: string, b: string): number {
  const keyA = nameComparisonKey(a);
  const keyB = nameComparisonKey(b);
  if (keyA === '' || keyB === '') return 0;
  if (keyA === keyB) return 1;

  const distance = editDistance(keyA, keyB);
  const editScore = 1 - distance / Math.max(keyA.length, keyB.length);

  const tokensA = new Set(keyA.split(' ').filter(Boolean));
  const tokensB = new Set(keyB.split(' ').filter(Boolean));
  const shared = [...tokensA].filter((token) => tokensB.has(token)).length;
  const tokenScore = shared / Math.min(tokensA.size, tokensB.size);

  return Math.max(0, Math.min(1, Math.max(editScore, tokenScore * 0.95)));
}

function sameNonEmpty(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function scoreDuplicate(
  subject: DuplicateSubject,
  candidate: DuplicateCandidateInput,
): DuplicateMatch {
  const reasons: DuplicateReasonCode[] = [];
  let score = 0;

  const subjectMobile = normalizeMobile(subject.mobile).value;
  const candidateMobile = normalizeMobile(candidate.mobile).value;
  const mobileMatches = Boolean(subjectMobile && subjectMobile === candidateMobile);

  const similarity = nameSimilarity(subject.fullName, candidate.fullName);
  const dobMatches = sameNonEmpty(subject.dateOfBirth, candidate.dateOfBirth);
  const fatherMatches =
    Boolean(subject.fatherName && candidate.fatherName) &&
    nameSimilarity(subject.fatherName ?? '', candidate.fatherName ?? '') >= 0.85;
  const districtMatches = sameNonEmpty(subject.district, candidate.district);

  // A shared mobile number in a service centre almost always means the same person —
  // but not always, so it is still only a warning.
  if (mobileMatches) {
    reasons.push('SAME_MOBILE');
    score = Math.max(score, similarity >= 0.7 ? 0.97 : 0.8);
  }

  if (similarity >= 0.85 && dobMatches) {
    reasons.push('SAME_NAME_AND_DOB');
    score = Math.max(score, 0.95);
  }

  if (similarity >= 0.85 && fatherMatches) {
    reasons.push('SAME_NAME_AND_FATHER');
    score = Math.max(score, 0.88);
  }

  if (similarity >= 0.8 && districtMatches) {
    reasons.push('SIMILAR_NAME_SAME_DISTRICT');
    score = Math.max(score, 0.72);
  }

  if (similarity >= 0.92 && reasons.length === 0) {
    reasons.push('SIMILAR_NAME');
    score = Math.max(score, 0.65);
  }

  const confidence: DuplicateMatch['confidence'] =
    score >= 0.9 ? 'high' : score >= 0.7 ? 'medium' : 'low';

  return { candidateId: candidate.id, score: Number(score.toFixed(3)), confidence, reasons };
}

export function findDuplicates(
  subject: DuplicateSubject,
  candidates: readonly DuplicateCandidateInput[],
  threshold = DUPLICATE_WARNING_THRESHOLD,
): DuplicateMatch[] {
  return candidates
    .map((candidate) => scoreDuplicate(subject, candidate))
    .filter((match) => match.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

export const DUPLICATE_REASON_LABELS: Record<DuplicateReasonCode, { en: string; hi: string }> = {
  SAME_MOBILE: { en: 'Same mobile number', hi: 'वही मोबाइल नंबर' },
  SAME_NAME_AND_DOB: { en: 'Same name and date of birth', hi: 'वही नाम और जन्म तिथि' },
  SAME_NAME_AND_FATHER: { en: "Same name and father's name", hi: 'वही नाम और पिता का नाम' },
  SIMILAR_NAME_SAME_DISTRICT: {
    en: 'Similar name in the same district',
    hi: 'उसी जिले में मिलता-जुलता नाम',
  },
  SIMILAR_NAME: { en: 'Similar name', hi: 'मिलता-जुलता नाम' },
};
