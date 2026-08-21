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
      // opacity: 0 on parent containers hides fields, but custom styled inputs (radios/checkboxes)
      // often set opacity: 0 directly on the input element itself while leaving the wrapper visible.
      if (
        style.opacity === '0' &&
        (depth > 0 || !['radio', 'checkbox', 'file'].includes(element.getAttribute('type') ?? ''))
      ) {
        return false;
      }
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

/** Label resolution, in the order that gives the most reliable answer first */
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

  const cell = element.closest('td');
  const previousCell = cell?.previousElementSibling;
  if (previousCell) {
    const text = textOf(previousCell);
    if (text && text.length <= 120) return text;
  }

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

  const clone = parent.cloneNode(true) as Element;
  for (const node of Array.from(clone.querySelectorAll('option, script, style'))) {
    node.remove();
  }

  const text = textOf(clone);
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

/**
 * Where a custom dropdown keeps its choices. There is no standard, so this is the union of the
 * shapes component libraries actually ship: an ARIA option, a plain list item, or a div tagged
 * with the value it stands for.
 */
export const CUSTOM_OPTION_SELECTOR =
  '[role="option"], option, li, [data-value], [data-option]';

/**
 * The option elements of a custom dropdown, inline or in the popup it points at.
 *
 * Shared with the filler so detection and filling always look in the same places — an option
 * the operator was shown but the filler cannot find reads as a silent failure.
 */
export function collectCustomOptionElements(element: Element): Element[] {
  const doc = element.ownerDocument;
  const nodes = new Set<Element>(Array.from(element.querySelectorAll(CUSTOM_OPTION_SELECTOR)));

  const controlsId = element.getAttribute('aria-controls') ?? element.getAttribute('aria-owns');
  if (controlsId && doc) {
    const container = doc.getElementById(controlsId);
    if (container) {
      // A popup can also be a descendant, so this deliberately unions rather than appends.
      for (const node of Array.from(container.querySelectorAll(CUSTOM_OPTION_SELECTOR))) {
        nodes.add(node);
      }
    }
  }

  return Array.from(nodes);
}

function collectOptions(element: Element): FieldOption[] | null {
  const tag = element.tagName.toLowerCase();
  const doc = element.ownerDocument;

  // Standard <select>
  if (tag === 'select') {
    const options = Array.from(element.querySelectorAll('option')).slice(0, MAX_OPTIONS);
    return options.map((option) => ({
      value: option.getAttribute('value') ?? option.textContent?.trim() ?? '',
      label: (option.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 300),
    }));
  }

  // <input list="datalist-id">
  const listId = element.getAttribute('list');
  if (listId && doc) {
    const datalist = doc.getElementById(listId);
    if (datalist) {
      const options = Array.from(datalist.querySelectorAll('option')).slice(0, MAX_OPTIONS);
      if (options.length > 0) {
        return options.map((option) => ({
          value: option.getAttribute('value') ?? option.textContent?.trim() ?? '',
          label: (option.textContent ?? option.getAttribute('value') ?? '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 300),
        }));
      }
    }
  }

  // Custom ARIA dropdown / combobox / listbox
  const role = element.getAttribute('role')?.toLowerCase();
  if (role === 'combobox' || role === 'listbox' || role === 'select' || element.hasAttribute('aria-haspopup')) {
    const optionNodes = collectCustomOptionElements(element);

    if (optionNodes.length > 0) {
      return optionNodes.slice(0, MAX_OPTIONS).map((opt) => {
        const val =
          opt.getAttribute('data-value') ??
          opt.getAttribute('data-option') ??
          opt.getAttribute('value') ??
          opt.textContent?.trim() ??
          '';
        const lbl = (opt.textContent ?? val).replace(/\s+/g, ' ').trim().slice(0, 300);
        return { value: val, label: lbl };
      });
    }
  }

  return null;
}

/**
 * Types the browser hands a value to whether or not anyone touched them: a slider reports the
 * midpoint of its bounds, a colour swatch reports #000000. Reading those back as "already
 * filled" would make every slider and colour picker permanently unfillable, so for these the
 * question is whether the *page* set a value, not what the widget currently reads.
 */
const BROWSER_DEFAULTED_TYPES = ['range', 'color'] as const;

function hasValue(element: Element): boolean {
  const role = element.getAttribute('role')?.toLowerCase();

  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox' || element.type === 'radio') return element.checked;
    if (element.type === 'file') return element.files !== null && element.files.length > 0;
    if ((BROWSER_DEFAULTED_TYPES as readonly string[]).includes(element.type)) {
      return (element.getAttribute('value') ?? '').trim() !== '';
    }
    return element.value.trim() !== '';
  }
  if (element instanceof HTMLTextAreaElement) return element.value.trim() !== '';
  if (element instanceof HTMLSelectElement) {
    // A multi-select has no placeholder first option to discount; nothing selected is the empty state.
    if (element.multiple) return element.selectedOptions.length > 0;
    return element.value.trim() !== '' && element.selectedIndex > 0;
  }
  if (element.hasAttribute('contenteditable') && element.getAttribute('contenteditable') !== 'false') {
    return (element.textContent ?? '').trim() !== '';
  }

  const ariaChecked = element.getAttribute('aria-checked');
  if (ariaChecked !== null) return ariaChecked === 'true';

  const ariaValuenow = element.getAttribute('aria-valuenow');
  if (ariaValuenow !== null) {
    // ARIA requires a slider to publish its position, exactly like <input type="range"> above.
    if (role === 'slider') return false;
    return ariaValuenow.trim() !== '';
  }

  const valAttr = element.getAttribute('value');
  if (valAttr !== null && valAttr.trim() !== '') return true;

  return false;
}

function tagNameOf(element: Element): DetectedField['tagName'] {
  const tag = element.tagName.toLowerCase();
  if (tag === 'select' || tag === 'textarea') return tag;
  const role = element.getAttribute('role')?.toLowerCase();
  if (role === 'combobox' || role === 'listbox' || role === 'select') return 'select';
  return 'input';
}

function inputTypeOf(element: Element): string {
  if (element.hasAttribute('contenteditable') && element.getAttribute('contenteditable') !== 'false') {
    return 'contenteditable';
  }
  const role = element.getAttribute('role')?.toLowerCase();
  if (role) {
    if (role === 'checkbox') return 'checkbox';
    if (role === 'radio') return 'radio';
    if (role === 'combobox') return 'combobox';
    if (role === 'listbox' || role === 'select') return 'select-one';
    if (role === 'switch') return 'checkbox';
    if (role === 'slider') return 'range';
    if (role === 'spinbutton') return 'number';
    if (role === 'textbox') return 'text';
  }
  const tag = element.tagName.toLowerCase();
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') {
    return (element as HTMLSelectElement).multiple ? 'select-multiple' : 'select-one';
  }
  return (element.getAttribute('type') ?? 'text').toLowerCase();
}

/**
 * Everything that could be a field: native controls, rich-text hosts, and the ARIA roles a
 * component library uses when it reimplements a control out of divs.
 *
 * Exported because a field's signature is derived from its position in *this* selector's result
 * list. The filler recomputes signatures against the live DOM, so if it queried a different set
 * of elements every signature would resolve to the wrong field.
 */
export const FIELD_SELECTOR =
  'input, select, textarea, [contenteditable="true"], [contenteditable=""], [role="checkbox"], [role="radio"], [role="combobox"], [role="listbox"], [role="select"], [role="textbox"], [role="switch"], [role="slider"], [role="spinbutton"]';

function querySelectorAllDeep(root: ParentNode, selector: string): Element[] {
  const elements: Element[] = Array.from(root.querySelectorAll(selector));
  try {
    const children = root.querySelectorAll('*');
    for (const child of Array.from(children)) {
      if (child.shadowRoot) {
        elements.push(...querySelectorAllDeep(child.shadowRoot, selector));
      }
    }
  } catch {
    // Edge cases in legacy browsers or strict security contexts.
  }
  return elements;
}

export function detectFields(doc: Document, frame = 0): DetectedField[] {
  const forms = Array.from(doc.forms);
  const formOf = new Map<Element, number>();
  forms.forEach((form, index) => {
    for (const element of Array.from(form.querySelectorAll(FIELD_SELECTOR))) {
      formOf.set(element, index);
    }
  });

  const elements = querySelectorAllDeep(doc, FIELD_SELECTOR).slice(0, MAX_FIELDS);
  const fields: DetectedField[] = [];

  elements.forEach((element, index) => {
    const inputType = inputTypeOf(element);

    // Structural inputs are not customer data and only add noise to the review list.
    if (['hidden', 'submit', 'reset', 'button', 'image'].includes(inputType)) return;

    // Listbox inside a combobox is the option container, not a separate field.
    const role = element.getAttribute('role')?.toLowerCase();
    if (role === 'listbox' && element.closest('[role="combobox"]')) return;

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
