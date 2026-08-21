/**
 * Fill execution.
 * Master spec §14.8, §15.5, §19.7; docs/FORM_ENGINE.md §9.
 *
 * This module writes into a page the user is looking at. Two rules constrain everything here:
 *
 *   1. It never submits. No click on a submit control, no `form.submit()`, no
 *      `form.requestSubmit()`, no Enter keypress inside a form. There is no code path that does.
 *   2. It never writes to a CAPTCHA, OTP or payment field, even if instructed to. The mapper
 *      already filtered those out; this is the second, independent check.
 *
 * Values arrive here, are typed into the page, and are not retained afterwards.
 */

import { classifyField, isSubmitControl } from '@assistigo/form-engine/safety';
import type { FillInstruction, FillResult } from '@assistigo/form-engine/types';
import { FIELD_SELECTOR, collectCustomOptionElements, fieldSignature } from './detector';

export const DEPENDENT_WAIT_MS = 3000;
const DEPENDENT_POLL_MS = 75;

type FillableElement = HTMLElement;

/**
 * React, Vue and Angular track their own value state. Assigning `element.value` directly
 * updates the DOM but leaves the framework believing the field is still empty, so it wipes the
 * value on the next render. Going through the prototype's native setter makes the framework's
 * own change detection fire.
 */
function setNativeValue(element: HTMLElement, value: string): void {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    const prototype = Object.getPrototypeOf(element) as object;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    const tracker = (element as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker;
    const lastValue = element.value;

    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    if (tracker) {
      tracker.setValue(lastValue);
    }
  } else {
    element.setAttribute('value', value);
  }
}

function dispatchInputEvents(element: Element): void {
  element.dispatchEvent(new Event('focus', { bubbles: true }));
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Matches a value against a <select>'s options: by value, then label, then loosely. */
function findOption(select: HTMLSelectElement, value: string): HTMLOptionElement | null {
  const options = Array.from(select.options);
  const wanted = normalise(value);

  return (
    options.find((option) => option.value === value) ??
    options.find((option) => normalise(option.value) === wanted) ??
    options.find((option) => normalise(option.text) === wanted) ??
    options.find((option) => normalise(option.text).startsWith(wanted)) ??
    options.find((option) => wanted.length > 3 && normalise(option.text).includes(wanted)) ??
    null
  );
}

/** How a custom control advertises which choice it stands for. No standard, so try all of them. */
function choiceTexts(element: Element): string[] {
  return [
    element.getAttribute('data-value'),
    element.getAttribute('data-option'),
    element.getAttribute('value'),
    element.getAttribute('aria-label'),
    element.textContent,
  ].filter((part): part is string => typeof part === 'string' && part.trim() !== '');
}

/** The custom-control equivalent of `findOption`'s exact and prefix passes. */
function matchesChoice(element: Element, wanted: string): boolean {
  return choiceTexts(element).some((text) => {
    const candidate = normalise(text);
    if (candidate === wanted) return true;
    return wanted.length > 2 && candidate.startsWith(wanted);
  });
}

/**
 * Whether clicking this element could commit the form (§14.8, rule 1).
 *
 * `applyFill` vets the field it was told to fill. A dropdown option or a sibling radio is a
 * different element that nothing vetted, and inside a custom widget it can be any element at
 * all — including a bare `<button>`, which submits its form by default.
 *
 * Structure only: no naming or label text is consulted. The role or type attribute already
 * proves the element is an option rather than a submit control, and an option legitimately
 * reads "I confirm the above" or sits in a group named `submit_mode` — refusing those would
 * break ordinary choices without making anything safer.
 */
function isUnsafeClickTarget(element: Element): boolean {
  return isSubmitControl({
    tagName: element.tagName,
    inputType: element.getAttribute('type') ?? element.getAttribute('role'),
  });
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitForOption(
  select: HTMLSelectElement,
  value: string,
): Promise<HTMLOptionElement | null> {
  const deadline = Date.now() + DEPENDENT_WAIT_MS;
  let option = findOption(select, value);
  while (!option && Date.now() < deadline) {
    await delay(DEPENDENT_POLL_MS);
    option = findOption(select, value);
  }
  return option;
}

/** `5:30 PM`, `5.30`, `17:30:00` all mean the same thing; only `17:30` is valid HTML. */
function formatTime(value: string): string {
  const match = value.trim().match(/^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*(am|pm)?$/i);
  if (!match?.[1] || !match[2]) return value.trim();

  let hours = Number.parseInt(match[1], 10);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  if (hours > 23) return value.trim();

  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

/** `08/2026` and `2026-8` are both the same month to an operator; `<input type="month">` wants `2026-08`. */
function formatMonth(value: string): string {
  const isoOrder = value.match(/^(\d{4})[-/](\d{1,2})$/);
  if (isoOrder?.[1] && isoOrder[2]) return `${isoOrder[1]}-${isoOrder[2].padStart(2, '0')}`;

  const monthFirst = value.match(/^(\d{1,2})[-/](\d{4})$/);
  if (monthFirst?.[1] && monthFirst[2]) return `${monthFirst[2]}-${monthFirst[1].padStart(2, '0')}`;

  return value;
}

/** `2026-w4`, `2026/04` -> `2026-W04`. */
function formatWeek(value: string): string {
  const match = value.match(/^(\d{4})[-/]?[wW]?(\d{1,2})$/);
  if (!match?.[1] || !match[2]) return value;
  return `${match[1]}-W${match[2].padStart(2, '0')}`;
}

/**
 * `<input type="color">` accepts `#rrggbb` and nothing else. A bare hex, a shorthand triplet or
 * a colour name is discarded silently and the swatch stays black, which reads as a filled field.
 */
function formatColor(value: string): string {
  const hex = value.replace(/^#/, '');
  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex.toLowerCase()}`;
  // #abc is shorthand for #aabbcc.
  if (/^[0-9a-f]{3}$/i.test(hex)) return `#${hex.toLowerCase().replace(/./g, (ch) => ch + ch)}`;
  return value;
}

/**
 * A slider cannot hold an arbitrary string: a value outside its bounds is silently pulled back
 * to the nearest end, and a non-numeric one is discarded. Clamping first means the write either
 * lands exactly or is refused, instead of reporting a number the operator never asked for.
 *
 * Returns null when there is no number in the value at all.
 */
function clampToRange(element: HTMLInputElement, value: string): string | null {
  const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(parsed)) return null;

  // The HTML defaults when a slider declares no bounds of its own.
  const min = Number.parseFloat(element.min || '0');
  const max = Number.parseFloat(element.max || '100');

  let next = parsed;
  if (Number.isFinite(min)) next = Math.max(next, min);
  if (Number.isFinite(max)) next = Math.min(next, max);
  return String(next);
}

/** Formats a value to match what a native input of this type will actually accept. */
function formatValueForInputType(value: string, inputType: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  if (inputType === 'date') {
    // DD/MM/YYYY or DD-MM-YYYY -> YYYY-MM-DD
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (ddmmyyyy?.[1] && ddmmyyyy?.[2] && ddmmyyyy?.[3]) {
      const d = ddmmyyyy[1];
      const m = ddmmyyyy[2];
      const y = ddmmyyyy[3];
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  if (inputType === 'datetime-local') {
    // Split on the first separator only, so a trailing "AM"/"PM" stays with the time.
    const parts = trimmed.match(/^(\S+)[T\s]+(.+)$/);
    if (parts?.[1] && parts[2]) {
      return `${formatValueForInputType(parts[1], 'date')}T${formatTime(parts[2])}`;
    }
  }

  if (inputType === 'time') return formatTime(trimmed);
  if (inputType === 'month') return formatMonth(trimmed);
  if (inputType === 'week') return formatWeek(trimmed);
  if (inputType === 'color') return formatColor(trimmed);

  return trimmed;
}

/**
 * Types where the browser replaces a value it rejects instead of clearing the field, so
 * "something is in there" is not evidence the fill worked. These are checked exactly.
 */
const EXACT_VALUE_TYPES = [
  'date',
  'datetime-local',
  'month',
  'week',
  'time',
  'color',
  'range',
  'number',
];

function fillTextLike(
  element: HTMLElement,
  value: string,
  inputType: string,
): FillResult['action'] {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    // The element's own type is the truth about what it accepts; the instruction only says what
    // the mapper thought it was looking at.
    const effectiveType = element instanceof HTMLInputElement ? element.type : inputType;
    let formatted = formatValueForInputType(value, effectiveType);

    if (element instanceof HTMLInputElement && element.type === 'range') {
      const clamped = clampToRange(element, formatted);
      if (clamped === null) return 'failed';
      formatted = clamped;
    }

    element.focus();
    setNativeValue(element, formatted);
    dispatchInputEvents(element);
    element.blur();

    if (EXACT_VALUE_TYPES.includes(effectiveType)) {
      return element.value === formatted ? 'filled' : 'failed';
    }
    return element.value === formatted || element.value !== '' ? 'filled' : 'failed';
  }

  const formatted = formatValueForInputType(value, inputType);

  // A custom slider or spinbutton is a div; ARIA requires it to publish its position through
  // aria-valuenow, which is the only handle on it that means anything to the page.
  element.focus();
  if (element.hasAttribute('aria-valuenow')) {
    element.setAttribute('aria-valuenow', formatted);
    dispatchInputEvents(element);
    element.blur();
    return element.getAttribute('aria-valuenow') === formatted ? 'filled' : 'failed';
  }

  element.setAttribute('value', formatted);
  dispatchInputEvents(element);
  element.blur();
  return element.getAttribute('value') === formatted ? 'filled' : 'failed';
}

function fillContentEditable(element: HTMLElement, value: string): FillResult['action'] {
  element.focus();
  element.textContent = value;
  dispatchInputEvents(element);
  element.blur();
  return (element.textContent ?? '') === value ? 'filled' : 'failed';
}

async function fillSelect(
  element: HTMLElement,
  value: string,
): Promise<FillResult> {
  const signature = element.dataset.assistigoSignature ?? '';

  if (element instanceof HTMLSelectElement) {
    if (element.multiple) {
      const wantedValues = value.split(/[,|]/).map((v) => normalise(v));
      element.focus();
      let matchedAny = false;
      Array.from(element.options).forEach((opt) => {
        const matches =
          wantedValues.includes(normalise(opt.value)) ||
          wantedValues.includes(normalise(opt.text));
        if (matches) {
          opt.selected = true;
          matchedAny = true;
        }
      });
      dispatchInputEvents(element);
      element.blur();
      return { signature, action: matchedAny ? 'filled' : 'failed' };
    }

    const option = await waitForOption(element, value);
    if (!option) {
      return {
        signature,
        action: 'skipped',
        skipReason: element.options.length <= 1 ? 'dependent_not_ready' : 'no_value',
      };
    }

    element.focus();
    setNativeValue(element, option.value);
    dispatchInputEvents(element);
    element.blur();

    return { signature, action: element.value === option.value ? 'filled' : 'failed' };
  }

  // Custom ARIA dropdown / combobox
  const wanted = normalise(value);

  element.focus();
  if (element instanceof HTMLInputElement) {
    setNativeValue(element, value);
    dispatchInputEvents(element);
  }

  // Opening the list is often what populates it. This element has already been vetted by
  // applyFill; the option it reveals is vetted separately before being clicked.
  element.click();

  const optionNodes = collectCustomOptionElements(element);
  const match =
    optionNodes.find((opt) => matchesChoice(opt, wanted)) ??
    // Last, loosest pass, mirroring findOption(): only for values long enough to be distinctive.
    optionNodes.find((opt) => wanted.length > 3 && normalise(opt.textContent ?? '').includes(wanted));

  if (match instanceof HTMLElement && !isUnsafeClickTarget(match)) {
    match.click();
    dispatchInputEvents(element);
    return { signature, action: 'filled' };
  }

  dispatchInputEvents(element);

  if (element instanceof HTMLInputElement) {
    // A combobox backed by a real text input: the typed value is itself the fill, whether or not
    // the page offered a matching suggestion.
    return { signature, action: element.value === value ? 'filled' : 'failed' };
  }

  // Nothing was typed and nothing was clicked, so nothing was filled. Saying so is the point:
  // the operator sees the field in the review list rather than believing it was handled.
  return {
    signature,
    action: 'skipped',
    skipReason: optionNodes.length === 0 ? 'dependent_not_ready' : 'no_value',
  };
}

function fillCheckable(element: HTMLElement, value: string): FillResult['action'] {
  const wanted = normalise(value);
  const isFalse = ['false', 'no', '0', 'off'].includes(wanted);

  if (element instanceof HTMLInputElement && element.type === 'checkbox') {
    const shouldCheck = !isFalse && ['true', 'yes', '1', 'on', normalise(element.value)].includes(wanted);
    if (element.checked === shouldCheck) return 'filled';
    element.click();
    return element.checked === shouldCheck ? 'filled' : 'failed';
  }

  const role = element.getAttribute('role')?.toLowerCase();
  if (role === 'checkbox' || role === 'switch') {
    const currentlyChecked = element.getAttribute('aria-checked') === 'true';
    const shouldCheck = !isFalse;
    if (currentlyChecked === shouldCheck) return 'filled';
    element.click();
    element.setAttribute('aria-checked', String(shouldCheck));
    dispatchInputEvents(element);
    return 'filled';
  }

  // Radio button handling
  if (element instanceof HTMLInputElement && element.type === 'radio') {
    const matchesValue = normalise(element.value) === wanted;
    const label = element.labels?.[0]?.textContent ?? '';
    const matchesLabel =
      normalise(label) === wanted || (wanted.length > 2 && normalise(label).startsWith(wanted));

    if (matchesValue || matchesLabel) {
      if (!element.checked) element.click();
      return element.checked ? 'filled' : 'failed';
    }

    // Search inside parent form or document for matching radio button in group
    const name = element.getAttribute('name');
    if (name) {
      const group = Array.from(
        (element.form ?? element.ownerDocument).querySelectorAll(`input[type="radio"][name="${name}"]`),
      ) as HTMLInputElement[];

      const match = group.find((radio) => {
        const valMatch = normalise(radio.value) === wanted;
        const lblText = radio.labels?.[0]?.textContent ?? '';
        const lblMatch =
          normalise(lblText) === wanted ||
          (wanted.length > 2 && normalise(lblText).startsWith(wanted));
        return valMatch || lblMatch;
      });

      if (match) {
        if (!match.checked) match.click();
        return match.checked ? 'filled' : 'failed';
      }
    }

    return 'skipped';
  }

  if (role === 'radio') {
    /*
     * An ARIA radio is one option of several, so the value decides *which* sibling to check —
     * never "the one the mapper happened to point at". Without this, filling "Female" would
     * check whichever option was detected first.
     */
    const group = element.closest('[role="radiogroup"]');
    const siblings = group
      ? (Array.from(group.querySelectorAll('[role="radio"]')) as HTMLElement[])
      : [element];
    const candidates = siblings.length > 0 ? siblings : [element];

    const match = candidates.find((radio) => matchesChoice(radio, wanted));
    if (!match || isUnsafeClickTarget(match)) return 'skipped';

    match.click();
    if (match.getAttribute('aria-checked') !== 'true') {
      // The page has no handler of its own, so reflect the selection for it — including
      // clearing the siblings, which is what makes it a radio rather than a checkbox.
      for (const radio of candidates) {
        radio.setAttribute('aria-checked', String(radio === match));
      }
    }
    dispatchInputEvents(match);
    return match.getAttribute('aria-checked') === 'true' ? 'filled' : 'failed';
  }

  return 'skipped';
}

/**
 * Locates the element a signature refers to.
 *
 * The signature is recomputed from the live DOM rather than trusted from the payload, so a page
 * that mutated between detection and fill cannot redirect a value into a different field.
 */
export function findElementBySignature(doc: Document, signature: string): FillableElement | null {
  const forms = Array.from(doc.forms);
  const formOf = new Map<Element, number>();
  forms.forEach((form, index) => {
    for (const element of Array.from(form.querySelectorAll(FIELD_SELECTOR))) {
      formOf.set(element, index);
    }
  });

  const elements = Array.from(doc.querySelectorAll(FIELD_SELECTOR));
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (!element) continue;
    if (fieldSignature(element, formOf.get(element) ?? -1, index, 0) === signature) {
      return element as FillableElement;
    }
  }
  return null;
}

/**
 * Applies a batch of fill instructions and reports what happened to each one.
 * Safety controls are checked against `isSubmitControl` and `classifyField` first.
 */
export async function applyFill(
  doc: Document,
  instructions: readonly FillInstruction[],
): Promise<FillResult[]> {
  const results: FillResult[] = [];

  for (const instruction of instructions) {
    const element = findElementBySignature(doc, instruction.signature);

    if (!element) {
      results.push({
        signature: instruction.signature,
        action: 'failed',
        error: 'element_not_found',
      });
      continue;
    }

    // --- independent safety re-check, on the live element -------------------
    const safetyClass = classifyField({
      inputType: element.getAttribute('type') ?? element.getAttribute('role'),
      name: element.getAttribute('name'),
      id: element.getAttribute('id'),
      className: element.getAttribute('class'),
      placeholder: element.getAttribute('placeholder'),
      ariaLabel: element.getAttribute('aria-label'),
      autocomplete: element.getAttribute('autocomplete'),
      labelText: (element as HTMLInputElement).labels?.[0]?.textContent ?? null,
    });

    if (safetyClass !== 'normal') {
      results.push({
        signature: instruction.signature,
        action: 'skipped',
        skipReason:
          safetyClass === 'captcha'
            ? 'captcha_field'
            : safetyClass === 'otp'
              ? 'otp_field'
              : safetyClass === 'payment'
                ? 'payment_field'
                : 'submit_control',
      });
      continue;
    }

    if (
      isSubmitControl({
        tagName: element.tagName,
        inputType: element.getAttribute('type') ?? element.getAttribute('role'),
        name: element.getAttribute('name'),
        id: element.getAttribute('id'),
      })
    ) {
      results.push({
        signature: instruction.signature,
        action: 'skipped',
        skipReason: 'submit_control',
      });
      continue;
    }

    if (element.hasAttribute('disabled')) {
      results.push({ signature: instruction.signature, action: 'skipped', skipReason: 'disabled' });
      continue;
    }
    if (element.hasAttribute('readonly') || ('readOnly' in element && (element as HTMLInputElement).readOnly)) {
      results.push({ signature: instruction.signature, action: 'skipped', skipReason: 'readonly' });
      continue;
    }

    // --- write -------------------------------------------------------------
    const role = element.getAttribute('role')?.toLowerCase() ?? '';
    const isNativeTextControl =
      element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;

    try {
      const isRichText =
        element.hasAttribute('contenteditable') &&
        element.getAttribute('contenteditable') !== 'false';

      // A role="textbox" that is not an <input> or <textarea> is a div the page types into
      // itself. Setting a `value` attribute on one changes nothing the operator can see.
      if (isRichText || (role === 'textbox' && !isNativeTextControl)) {
        results.push({
          signature: instruction.signature,
          action: fillContentEditable(element, instruction.value),
        });
        continue;
      }

      if (
        element instanceof HTMLSelectElement ||
        ['select-one', 'select-multiple', 'combobox', 'listbox'].includes(instruction.inputType) ||
        ['combobox', 'listbox', 'select'].includes(role)
      ) {
        element.dataset.assistigoSignature = instruction.signature;
        const result = await fillSelect(element, instruction.value);
        results.push({ ...result, signature: instruction.signature });
        delete element.dataset.assistigoSignature;
        continue;
      }

      if (
        (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) ||
        ['checkbox', 'radio', 'switch'].includes(instruction.inputType) ||
        ['checkbox', 'radio', 'switch'].includes(role)
      ) {
        results.push({
          signature: instruction.signature,
          action: fillCheckable(element, instruction.value),
        });
        continue;
      }

      results.push({
        signature: instruction.signature,
        action: fillTextLike(element, instruction.value, instruction.inputType),
      });
    } catch {
      // Deliberately not captured for privacy (§19.6)
      results.push({ signature: instruction.signature, action: 'failed', error: 'fill_error' });
    }
  }

  return results;
}
