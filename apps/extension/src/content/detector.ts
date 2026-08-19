/**
 * Field detection.
 * Master spec §14.1, §14.2; docs/FORM_ENGINE.md §2, docs/EXTENSION.md §6.
 *
 * Walks the page and produces metadata for every field an operator might want filled.
 *
 * The contract that matters: **this function never reads a field's value.** `hasValue` records
 * whether something is there; what it is stays on the page. The one exception is `<select>`
 * option lists, which are part of the form's structure rather than the customer's data and are
 * needed to match "Bihar" to the right `<option>`.
 */

import type { DetectedField, FieldOption, PageContext } from '@assistigo/form-engine/types';

const NEARBY_TEXT_LIMIT = 120;
const MAX_FIELDS = 500;
const MAX_OPTIONS = 500;

/** Pages the extension must never run on (§19.6). */
const BLOCKED_PROTOCOLS = [
  'chrome:',
  'chrome-extension:',
  'edge:',
  'about:',
  'view-source:',
  'file:',
];
const BLOCKED_HOSTS = ['chromewebstore.google.com', 'chrome.google.com'];

export function isBlockedPage(location: { protocol: string; hostname: string }): boolean {
  if (BLOCKED_PROTOCOLS.includes(location.protocol)) return true;
  return BLOCKED_HOSTS.includes(location.hostname);
}

/** FNV-1a. Short, stable, and good enough to identify a field across two detections. */
function hash(input: string): string {
  let value = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value.toString(36);
}

/**
 * A field's identity.
 *
 * Built from the form it belongs to plus its own naming, with the position as a last resort.
 * Name and id are preferred because they survive a page re-render; position does not, but a
 * field with neither is otherwise unaddressable.
 */
export function fieldSignature(
  element: Element,
  formIndex: number,
  fieldIndex: number,
  frame = 0,
): string {
  const name = element.getAttribute('name') ?? '';
  const id = element.getAttribute('id') ?? '';
  const type = element.getAttribute('type') ?? element.tagName.toLowerCase();
  const stable = name || id;
  const parts = stable
    ? [frame, formIndex, type, stable]
    : [frame, formIndex, type, `idx${fieldIndex}`];
  return hash(parts.join('|'));
}

function styleOf(element: Element): CSSStyleDeclaration | null {
  const view = element.ownerDocument?.defaultView;
  if (!view) return null;
  try {
    return view.getComputedStyle(element);
  } catch {
    return null;
  }
}

/**
 * Visibility, decided from computed style rather than layout boxes.
 *
 * Layout-based checks (`offsetParent`, client rects) are more accurate in a real browser but
 * meaningless in a headless test environment, and a field wrongly judged invisible is silently
 * dropped from the operator's review list. Style walking behaves identically in both.
 */
export function isElementVisible(element: Element): boolean {
  if (element instanceof HTMLElement && element.hidden) return false;
  if (element.getAttribute('type') === 'hidden') return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;

  let current: Element | null = element;
  let depth = 0;
  while (current && depth < 50) {
    const style = styleOf(current);
    if (style) {
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      if (style.opacity === '0') return false;
    }
    current = current.parentElement;
    depth += 1;
  }
  return true;
}

function textOf(node: Element | null | undefined): string | null {
  const text = node?.textContent?.replace(/\s+/g, ' ').trim();
  return text ? text : null;
}

/**
 * Label resolution, in the order that gives the most reliable answer first
 * (docs/EXTENSION.md §6). Portals use every one of these, often on the same page.
 */
export function resolveLabel(element: Element): string | null {
  const doc = element.ownerDocument;
  const id = element.getAttribute('id');

  if (id) {
    const escaped = id.replace(/["\\]/g, '\\$&');
    const explicit = doc?.querySelector(`label[for="${escaped}"]`);
    const text = textOf(explicit);
    if (text) return text;
  }

  const wrapping = element.closest('label');
  if (wrapping) {
    // The wrapping label's text includes the control's own text nodes; that is fine for
    // inputs, which have none.
    const text = textOf(wrapping);
    if (text) return text;
  }

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy && doc) {
    const parts = labelledBy
      .split(/\s+/)
      .map((refId) => textOf(doc.getElementById(refId)))
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }

  // A table-based layout puts the label in the previous cell — extremely common on older
  // government portals.
  const cell = element.closest('td');
  const previousCell = cell?.previousElementSibling;
  if (previousCell) {
    const text = textOf(previousCell);
    if (text && text.length <= 120) return text;
  }

  // Otherwise, the nearest preceding text.
  let sibling = element.previousElementSibling;
  let steps = 0;
  while (sibling && steps < 3) {
    const text = textOf(sibling);
    if (text && text.length <= 120) return text;
    sibling = sibling.previousElementSibling;
    steps += 1;
  }

  return null;
}

function resolveNearbyText(element: Element): string | null {
  const parent = element.parentElement;
  if (!parent) return null;
  const text = textOf(parent);
  if (!text) return null;
  return text.slice(0, NEARBY_TEXT_LIMIT);
}

function resolveSectionHeading(element: Element): string | null {
  let current: Element | null = element.parentElement;
  let depth = 0;
  while (current && depth < 8) {
    const heading = current.querySelector('h1, h2, h3, h4, legend');
    const text = textOf(heading);
    if (text) return text.slice(0, 200);
    current = current.parentElement;
    depth += 1;
  }
  return null;
}

function collectOptions(element: Element): FieldOption[] | null {
  if (element.tagName.toLowerCase() !== 'select') return null;
  const options = Array.from(element.querySelectorAll('option')).slice(0, MAX_OPTIONS);
  return options.map((option) => ({
    value: option.getAttribute('value') ?? option.textContent?.trim() ?? '',
    label: (option.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 300),
  }));
}

/** True when the control holds something. Deliberately does not report *what*. */
function hasValue(element: Element): boolean {
  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox' || element.type === 'radio') return element.checked;
    if (element.type === 'file') return element.files !== null && element.files.length > 0;
    return element.value.trim() !== '';
  }
  if (element instanceof HTMLTextAreaElement) return element.value.trim() !== '';
  if (element instanceof HTMLSelectElement) {
    return element.value.trim() !== '' && element.selectedIndex > 0;
  }
  return false;
}

function tagNameOf(element: Element): DetectedField['tagName'] {
  const tag = element.tagName.toLowerCase();
  if (tag === 'select' || tag === 'textarea') return tag;
  return 'input';
}

function inputTypeOf(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') {
    return (element as HTMLSelectElement).multiple ? 'select-multiple' : 'select-one';
  }
  return (element.getAttribute('type') ?? 'text').toLowerCase();
}

const FIELD_SELECTOR = 'input, select, textarea';

export function detectFields(doc: Document, frame = 0): DetectedField[] {
  const forms = Array.from(doc.forms);
  const formOf = new Map<Element, number>();
  forms.forEach((form, index) => {
    for (const element of Array.from(form.querySelectorAll(FIELD_SELECTOR))) {
      formOf.set(element, index);
    }
  });

  const elements = Array.from(doc.querySelectorAll(FIELD_SELECTOR)).slice(0, MAX_FIELDS);
  const fields: DetectedField[] = [];

  elements.forEach((element, index) => {
    const inputType = inputTypeOf(element);

    // Structural inputs are not customer data and only add noise to the review list.
    if (['hidden', 'submit', 'reset', 'button', 'image'].includes(inputType)) return;

    const formIndex = formOf.get(element) ?? -1;

    fields.push({
      signature: fieldSignature(element, formIndex, index, frame),
      tagName: tagNameOf(element),
      inputType,
      name: element.getAttribute('name'),
      id: element.getAttribute('id'),
      placeholder: element.getAttribute('placeholder'),
      labelText: resolveLabel(element),
      ariaLabel: element.getAttribute('aria-label'),
      nearbyText: resolveNearbyText(element),
      sectionHeading: resolveSectionHeading(element),
      options: collectOptions(element),
      required:
        element.hasAttribute('required') || element.getAttribute('aria-required') === 'true',
      maxLength: (() => {
        const raw = element.getAttribute('maxlength');
        const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      })(),
      pattern: element.getAttribute('pattern'),
      hasValue: hasValue(element),
      visible: isElementVisible(element),
      disabled: element.hasAttribute('disabled'),
      readOnly: element.hasAttribute('readonly'),
      frame,
      order: fields.length,
    });
  });

  return fields;
}

/**
 * Page context. Origin and path only — a query string can carry a customer's details, and this
 * value is stored in `fill_sessions` (§18.2).
 */
export function collectPageContext(doc: Document): PageContext {
  const location = doc.defaultView?.location;
  let blockedFrames = 0;

  const frames = doc.querySelectorAll('iframe');
  for (const frame of Array.from(frames)) {
    try {
      // Reading contentDocument on a cross-origin frame throws; that is the test.
      if (!(frame as HTMLIFrameElement).contentDocument) blockedFrames += 1;
    } catch {
      blockedFrames += 1;
    }
  }

  return {
    origin: location?.origin ?? '',
    path: location?.pathname ?? '',
    title: doc.title ? doc.title.slice(0, 300) : null,
    blockedFrames,
  };
}

/** Same-origin frames are walked; cross-origin ones are reported, never forced. */
export function detectFieldsInFrames(doc: Document): DetectedField[] {
  const fields = detectFields(doc, 0);
  const frames = Array.from(doc.querySelectorAll('iframe'));

  frames.forEach((frame, index) => {
    try {
      const inner = (frame as HTMLIFrameElement).contentDocument;
      if (inner) fields.push(...detectFields(inner, index + 1));
    } catch {
      // Cross-origin. Counted in collectPageContext().blockedFrames.
    }
  });

  return fields.slice(0, MAX_FIELDS).map((field, order) => ({ ...field, order }));
}
