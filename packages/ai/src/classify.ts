/**
 * Document classification.
 * Master spec §12.2; docs/AI_PIPELINE.md §3.
 *
 * A scored keyword match over the OCR text plus filename hints — not a trained model. Indian
 * identity and certificate documents carry very stable issuing-authority boilerplate ("INCOME
 * TAX DEPARTMENT", "निर्वाचन आयोग"), which is a far better signal than layout for the MVP.
 *
 * `unknown` is a first-class result (§12.2). A confident wrong class is worse than an honest
 * shrug, because the operator can label an unknown document in one click but has to notice a
 * wrong one first.
 */

import type { DocumentType } from '@assistigo/core';
import type { ClassificationResult } from './types';

type ClassSignals = {
  documentType: DocumentType;
  /** Phrases that are near-unique to this class. */
  strong: readonly string[];
  /** Supporting phrases that also appear on other documents. */
  weak: readonly string[];
  /** Fragments that count when they appear in the filename. */
  filename: readonly string[];
};

/**
 * Matching is done on a normalised copy of the text (lower-cased, whitespace collapsed), so
 * every phrase here is written lower-case. Devanagari has no case, so it passes through.
 */
const SIGNALS: readonly ClassSignals[] = [
  {
    documentType: 'aadhaar_like',
    strong: [
      'unique identification authority',
      'भारतीय विशिष्ट पहचान प्राधिकरण',
      'uidai',
      'मेरा आधार मेरी पहचान',
      'आधार',
    ],
    weak: ['aadhaar', 'aadhar', 'enrolment no', 'नामांकन', 'vid'],
    filename: ['aadhaar', 'aadhar', 'uid'],
  },
  {
    documentType: 'pan',
    strong: [
      'income tax department',
      'permanent account number',
      'आयकर विभाग',
      'स्थायी लेखा संख्या',
    ],
    weak: ['govt. of india', 'भारत सरकार', 'pan'],
    filename: ['pan'],
  },
  {
    documentType: 'voter_id',
    strong: [
      'election commission of india',
      'भारत निर्वाचन आयोग',
      'elector photo identity card',
      'निर्वाचक फोटो पहचान पत्र',
    ],
    weak: ['epic', 'elector', 'मतदाता', 'part no'],
    filename: ['voter', 'epic'],
  },
  {
    documentType: 'marksheet_10',
    strong: [
      'secondary school examination',
      'माध्यमिक परीक्षा',
      'high school examination',
      'matriculation',
    ],
    weak: ['class x', 'कक्षा 10', 'board of secondary'],
    filename: ['10th', 'class10', 'matric', 'highschool'],
  },
  {
    documentType: 'marksheet_12',
    strong: [
      'senior secondary examination',
      'उच्चतर माध्यमिक परीक्षा',
      'intermediate examination',
      'इंटरमीडिएट परीक्षा',
    ],
    weak: ['class xii', 'कक्षा 12', '+2 examination'],
    filename: ['12th', 'class12', 'inter', 'seniorsecondary'],
  },
  {
    documentType: 'caste_certificate',
    strong: ['caste certificate', 'जाति प्रमाण पत्र', 'जाति प्रमाणपत्र'],
    weak: ['scheduled caste', 'scheduled tribe', 'other backward class', 'अनुसूचित जाति'],
    filename: ['caste', 'jati'],
  },
  {
    documentType: 'income_certificate',
    strong: ['income certificate', 'आय प्रमाण पत्र', 'आय प्रमाणपत्र'],
    weak: ['annual income', 'वार्षिक आय', 'family income'],
    filename: ['income', 'aay'],
  },
  {
    documentType: 'residence_certificate',
    strong: [
      'residence certificate',
      'domicile certificate',
      'निवास प्रमाण पत्र',
      'मूल निवास प्रमाण पत्र',
    ],
    weak: ['permanent resident', 'स्थायी निवासी', 'मूल निवासी'],
    filename: ['residence', 'domicile', 'niwas', 'nivas'],
  },
  {
    documentType: 'receipt',
    strong: ['payment receipt', 'भुगतान रसीद', 'transaction receipt'],
    weak: ['transaction id', 'amount paid', 'रसीद', 'receipt no'],
    filename: ['receipt', 'rasid', 'payment'],
  },
  {
    documentType: 'photo',
    strong: [],
    weak: [],
    filename: ['photo', 'passportphoto', 'pic', 'foto'],
  },
  {
    documentType: 'signature',
    strong: [],
    weak: [],
    filename: ['signature', 'sign', 'hastakshar'],
  },
];

const STRONG_WEIGHT = 3;
const WEAK_WEIGHT = 1;
const FILENAME_WEIGHT = 2;
/** The operator's declared type is evidence, not an instruction (§12.2). */
const HINT_WEIGHT = 2;

/**
 * Saturating curve: more corroborating phrases raise confidence with diminishing returns, and
 * nothing reaches 1.0. Classification is a guess the operator can override, and the number
 * shown to them should say so.
 */
function toConfidence(rawScore: number): number {
  if (rawScore <= 0) return 0;
  return Number((rawScore / (rawScore + 2)).toFixed(3));
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Everything that is not a Latin letter, a digit or a Devanagari character. Used to reduce a
 * filename to comparable letters, so `Sunita_Caste-Certificate (1).pdf` still matches `caste`.
 *
 * Written as an escaped `RegExp` rather than a literal because the Devanagari range spans
 * combining marks, which `no-misleading-character-class` flags in a literal — the same form
 * packages/core/src/customers/normalize.ts uses.
 */
// eslint-disable-next-line no-misleading-character-class
const NON_FILENAME_CHARS = new RegExp('[^a-z0-9\\u0900-\\u097F]', 'g');

function countMatches(haystack: string, needles: readonly string[]): number {
  return needles.reduce((total, needle) => (haystack.includes(needle) ? total + 1 : total), 0);
}

/** Below this the answer is `unknown` rather than a class nobody should act on. */
const CLASSIFICATION_FLOOR = 0.45;

/** An image with essentially no readable text is a photo or a signature, not a document. */
const TEXT_LENGTH_FOR_A_REAL_DOCUMENT = 24;

export type ClassifyInput = {
  text: string;
  filename: string;
  mimeType: string;
  hintedType?: DocumentType | null;
};

export function classifyDocument(input: ClassifyInput): ClassificationResult {
  const text = normalise(input.text);
  const filename = normalise(input.filename).replace(NON_FILENAME_CHARS, '');

  const scored = SIGNALS.map((signal) => {
    const raw =
      countMatches(text, signal.strong) * STRONG_WEIGHT +
      countMatches(text, signal.weak) * WEAK_WEIGHT +
      countMatches(filename, signal.filename) * FILENAME_WEIGHT +
      (input.hintedType === signal.documentType ? HINT_WEIGHT : 0);

    return { documentType: signal.documentType, confidence: toConfidence(raw) };
  })
    .filter((entry) => entry.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);

  const best = scored[0];

  // An image carrying no text cannot be classified from its content. Fall back to the filename
  // signal if there was one, otherwise call it a photo — which is what an operator uploading a
  // bare image almost always has.
  if (input.text.trim().length < TEXT_LENGTH_FOR_A_REAL_DOCUMENT && input.mimeType !== 'application/pdf') {
    const imageClass =
      best && (best.documentType === 'photo' || best.documentType === 'signature')
        ? best
        : { documentType: 'photo' as DocumentType, confidence: 0.5 };
    return {
      documentType: imageClass.documentType,
      confidence: imageClass.confidence,
      alternatives: scored.filter((entry) => entry.documentType !== imageClass.documentType).slice(0, 3),
    };
  }

  if (!best || best.confidence < CLASSIFICATION_FLOOR) {
    return {
      documentType: 'unknown',
      confidence: best?.confidence ?? 0,
      alternatives: scored.slice(0, 3),
    };
  }

  // Two classes within a hair of each other is not a decision — 10th and 12th marksheets from
  // the same board share most of their boilerplate. Say so rather than picking by sort order.
  const runnerUp = scored[1];
  if (runnerUp && best.confidence - runnerUp.confidence < 0.05) {
    return {
      documentType: 'unknown',
      confidence: best.confidence,
      alternatives: scored.slice(0, 3),
    };
  }

  return {
    documentType: best.documentType,
    confidence: best.confidence,
    alternatives: scored.slice(1, 4),
  };
}
