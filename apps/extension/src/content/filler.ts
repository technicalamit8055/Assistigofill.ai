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

// Imported from the narrow subpaths rather than the package barrel: this file ships inside a
// content script injected into pages Assistigo does not control, so every kilobyte and every
// extra module in that bundle is worth avoiding.
import { classifyField, isSubmitControl } from '@assistigo/form-engine/safety';
import type { FillInstruction, FillResult } from '@assistigo/form-engine/types';
import { fieldSignature } from './detector';

/** How long to wait for a dependent dropdown (state → district) to repopulate. */
const DEPENDENT_WAIT_MS = 1500;
const DEPENDENT_POLL_MS = 75;

type FillableElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * React, Vue and Angular track their own value state. Assigning `element.value` directly
 * updates the DOM but leaves the framework believing the field is still empty, so it wipes the
 * value on the next render. Going through the prototype's native setter makes the framework's
 * own change detection fire.
 */
function setNativeValue(element: FillableElement, value: string): void {
  const prototype = Object.getPrototypeOf(element) as object;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

function dispatchInputEvents(element: Element): void {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
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

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Dependent dropdowns repopulate asynchronously after their parent changes. We wait a bounded
 * time for an option to appear rather than forcing a value the portal would reject — a field
 * left empty is recoverable, a wrong district on a submitted form is not.
 */
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

function fillTextLike(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): FillResult['action'] {
  element.focus();
  setNativeValue(element, value);
  dispatchInputEvents(element);
  element.blur();
  return element.value === value ? 'filled' : 'failed';
}

async function fillSelect(select: HTMLSelectElement, value: string): Promise<FillResult> {
  const option = await waitForOption(select, value);
  const signature = select.dataset.assistigoSignature ?? '';

  if (!option) {
    return {
      signature,
      action: 'skipped',
      skipReason: select.options.length <= 1 ? 'dependent_not_ready' : 'no_value',
    };
  }

  select.focus();
  setNativeValue(select, option.value);
  dispatchInputEvents(select);
  select.blur();

  return { signature, action: select.value === option.value ? 'filled' : 'failed' };
}

function fillCheckable(element: HTMLInputElement, value: string): FillResult['action'] {
  const wanted = normalise(value);

  if (element.type === 'checkbox') {
    const shouldCheck = ['true', 'yes', '1', 'on', normalise(element.value)].includes(wanted);
    if (element.checked === shouldCheck) return 'filled';
    element.click();
    return element.checked === shouldCheck ? 'filled' : 'failed';
  }

  // Radio: only click the member of the group whose value or label matches.
  const matchesValue = normalise(element.value) === wanted;
  const label = element.labels?.[0]?.textContent ?? '';
  const matchesLabel =
    normalise(label) === wanted || (wanted.length > 2 && normalise(label).startsWith(wanted));

  if (!matchesValue && !matchesLabel) return 'skipped';
  if (!element.checked) element.click();
  return element.checked ? 'filled' : 'failed';
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
    for (const element of Array.from(form.querySelectorAll('input, select, textarea'))) {
      formOf.set(element, index);
    }
  });

  const elements = Array.from(doc.querySelectorAll('input, select, textarea'));
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
 * Nothing is clicked except radio buttons and checkboxes, which are the only controls that
 * cannot be set any other way — and each is checked against `isSubmitControl` first.
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
      inputType: element.getAttribute('type'),
      name: element.getAttribute('name'),
      id: element.getAttribute('id'),
      className: element.getAttribute('class'),
      placeholder: element.getAttribute('placeholder'),
      ariaLabel: element.getAttribute('aria-label'),
      autocomplete: element.getAttribute('autocomplete'),
      labelText: element.labels?.[0]?.textContent ?? null,
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
        inputType: element.getAttribute('type'),
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

    if (element.disabled) {
      results.push({ signature: instruction.signature, action: 'skipped', skipReason: 'disabled' });
      continue;
    }
    if ('readOnly' in element && element.readOnly) {
      results.push({ signature: instruction.signature, action: 'skipped', skipReason: 'readonly' });
      continue;
    }

    // --- write -------------------------------------------------------------
    try {
      if (element instanceof HTMLSelectElement) {
        element.dataset.assistigoSignature = instruction.signature;
        const result = await fillSelect(element, instruction.value);
        results.push({ ...result, signature: instruction.signature });
        delete element.dataset.assistigoSignature;
        continue;
      }

      if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) {
        results.push({
          signature: instruction.signature,
          action: fillCheckable(element, instruction.value),
        });
        continue;
      }

      results.push({
        signature: instruction.signature,
        action: fillTextLike(element as HTMLInputElement | HTMLTextAreaElement, instruction.value),
      });
    } catch {
      // The reason is deliberately not captured: an exception message from a host page could
      // contain the value we just tried to write (§19.6).
      results.push({ signature: instruction.signature, action: 'failed', error: 'fill_error' });
    }
  }

  return results;
}
