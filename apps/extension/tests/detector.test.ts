import { beforeEach, describe, expect, it } from 'vitest';
import {
  collectPageContext,
  detectFields,
  fieldSignature,
  isBlockedPage,
  isElementVisible,
  resolveLabel,
} from '../src/content/detector';

function render(html: string): Document {
  document.body.innerHTML = html;
  return document;
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.title = '';
});

describe('detector — field discovery', () => {
  it('finds text, select, radio, checkbox and textarea fields', () => {
    const doc = render(`
      <form>
        <label for="name">Applicant's Name</label>
        <input id="name" name="applicant_name" type="text" />

        <label for="state">State</label>
        <select id="state" name="state"><option value="">Select</option><option value="BR">Bihar</option></select>

        <label for="male">Male</label>
        <input id="male" name="gender" type="radio" value="M" />

        <label for="terms">I agree</label>
        <input id="terms" name="terms" type="checkbox" />

        <label for="addr">Address</label>
        <textarea id="addr" name="address"></textarea>
      </form>
    `);

    const fields = detectFields(doc);
    expect(fields.map((field) => field.inputType)).toEqual([
      'text',
      'select-one',
      'radio',
      'checkbox',
      'textarea',
    ]);
  });

  it('ignores hidden, submit and button inputs', () => {
    const doc = render(`
      <form>
        <input type="hidden" name="csrf" value="secret" />
        <input type="text" name="full_name" />
        <input type="submit" value="Submit" />
        <button type="button">Add row</button>
      </form>
    `);

    const fields = detectFields(doc);
    expect(fields).toHaveLength(1);
    expect(fields[0]?.name).toBe('full_name');
  });

  it('records that a field is filled without recording what is in it', () => {
    const doc = render(`<form><input name="full_name" value="Amit Kumar" /></form>`);
    const [field] = detectFields(doc);

    expect(field?.hasValue).toBe(true);
    // The value must not appear anywhere in the payload.
    expect(JSON.stringify(field)).not.toContain('Amit');
  });

  it('captures select options, which are form structure rather than customer data', () => {
    const doc = render(`
      <form>
        <select name="state"><option value="">Select</option><option value="BR">Bihar</option></select>
      </form>
    `);
    const [field] = detectFields(doc);
    expect(field?.options).toEqual([
      { value: '', label: 'Select' },
      { value: 'BR', label: 'Bihar' },
    ]);
  });

  it('reads required, maxlength and readonly', () => {
    const doc = render(
      `<form><input name="pin" required maxlength="6" readonly disabled /></form>`,
    );
    const [field] = detectFields(doc);
    expect(field).toMatchObject({ required: true, maxLength: 6, readOnly: true, disabled: true });
  });

  it('detects custom ARIA controls, contenteditable elements, and datalists', () => {
    const doc = render(`
      <form>
        <div contenteditable="true" id="bio" aria-label="Bio">Developer</div>
        <div role="checkbox" aria-checked="true" aria-label="Subscribe"></div>
        <div role="combobox" aria-label="Country">
          <ul role="listbox">
            <li role="option" data-value="IN">India</li>
          </ul>
        </div>
        <input list="cities" name="city" type="text" />
        <datalist id="cities">
          <option value="DEL">Delhi</option>
          <option value="PAT">Patna</option>
        </datalist>
        <input type="date" name="dob" />
        <input type="range" name="score" />
      </form>
    `);

    const fields = detectFields(doc);
    expect(fields.map((f) => f.inputType)).toEqual([
      'contenteditable',
      'checkbox',
      'combobox',
      'text',
      'date',
      'range',
    ]);

    const combobox = fields.find((f) => f.inputType === 'combobox');
    expect(combobox?.options).toEqual([{ value: 'IN', label: 'India' }]);

    const cityInput = fields.find((f) => f.name === 'city');
    expect(cityInput?.options).toEqual([
      { value: 'DEL', label: 'Delhi' },
      { value: 'PAT', label: 'Patna' },
    ]);
  });

  it('does not mistake a browser default for something the operator already entered', () => {
    // A slider reports its midpoint and a colour swatch reports #000000 whether or not anyone
    // touched them. Counting those as filled would make both permanently unfillable.
    const doc = render(`
      <form>
        <input type="range" name="untouched_range" />
        <input type="range" name="preset_range" value="30" />
        <input type="color" name="untouched_colour" />
        <input type="color" name="preset_colour" value="#ff0000" />
        <div role="slider" id="custom_slider" aria-label="Level" aria-valuenow="40"></div>
      </form>
    `);

    const byName = new Map(detectFields(doc).map((f) => [f.name ?? f.id, f.hasValue]));
    expect(Object.fromEntries(byName)).toEqual({
      untouched_range: false,
      preset_range: true,
      untouched_colour: false,
      preset_colour: true,
      custom_slider: false,
    });
  });

  it('treats an untouched multi-select as empty', () => {
    const doc = render(`
      <form>
        <select name="empty" multiple><option value="a">A</option><option value="b">B</option></select>
        <select name="chosen" multiple><option value="a" selected>A</option><option value="b">B</option></select>
      </form>
    `);

    const fields = detectFields(doc);
    expect(fields.map((f) => f.inputType)).toEqual(['select-multiple', 'select-multiple']);
    expect(fields.map((f) => f.hasValue)).toEqual([false, true]);
  });

  it('collects the options of a dropdown that keeps them in a popup it points at', () => {
    const doc = render(`
      <form>
        <div role="combobox" id="scheme" aria-label="Scheme" aria-controls="scheme-list"></div>
        <div id="scheme-list">
          <span data-option="A">Scheme A</span>
          <span data-option="B">Scheme B</span>
        </div>
      </form>
    `);

    const combobox = detectFields(doc).find((f) => f.id === 'scheme');
    expect(combobox?.options).toEqual([
      { value: 'A', label: 'Scheme A' },
      { value: 'B', label: 'Scheme B' },
    ]);
  });

  it('lists an option once when the popup it points at is also a descendant', () => {
    const doc = render(`
      <form>
        <div role="combobox" id="state" aria-label="State" aria-controls="state-list">
          <ul id="state-list" role="listbox"><li role="option" data-value="BR">Bihar</li></ul>
        </div>
      </form>
    `);

    const combobox = detectFields(doc).find((f) => f.id === 'state');
    expect(combobox?.options).toEqual([{ value: 'BR', label: 'Bihar' }]);
  });
});

describe('detector — label resolution', () => {
  it('prefers an explicit label[for]', () => {
    const doc = render(`<label for="a">Father's Name</label><input id="a" name="x" />`);
    expect(resolveLabel(doc.querySelector('input')!)).toBe("Father's Name");
  });

  it('falls back to a wrapping label', () => {
    const doc = render(`<label>Mobile Number <input name="m" /></label>`);
    expect(resolveLabel(doc.querySelector('input')!)).toBe('Mobile Number');
  });

  it('uses aria-labelledby', () => {
    const doc = render(
      `<span id="lbl">Date of Birth</span><input name="d" aria-labelledby="lbl" />`,
    );
    expect(resolveLabel(doc.querySelector('input')!)).toBe('Date of Birth');
  });

  it('reads the previous table cell, as older government portals lay forms out', () => {
    const doc = render(`
      <table><tr><td>PIN Code</td><td><input name="pin" /></td></tr></table>
    `);
    expect(resolveLabel(doc.querySelector('input')!)).toBe('PIN Code');
  });

  it('falls back to the nearest preceding text', () => {
    const doc = render(`<div><span>Annual Income</span><input name="inc" /></div>`);
    expect(resolveLabel(doc.querySelector('input')!)).toBe('Annual Income');
  });

  it('handles Hindi labels', () => {
    const doc = render(`<label for="a">पिता का नाम</label><input id="a" name="f" />`);
    expect(resolveLabel(doc.querySelector('input')!)).toBe('पिता का नाम');
  });
});

describe('detector — visibility', () => {
  it('marks display:none and visibility:hidden fields invisible', () => {
    const doc = render(`
      <input id="a" name="a" style="display:none" />
      <input id="b" name="b" style="visibility:hidden" />
      <input id="c" name="c" />
    `);
    expect(isElementVisible(doc.getElementById('a')!)).toBe(false);
    expect(isElementVisible(doc.getElementById('b')!)).toBe(false);
    expect(isElementVisible(doc.getElementById('c')!)).toBe(true);
  });

  it('follows display:none up the ancestor chain', () => {
    const doc = render(`<div style="display:none"><input id="a" name="a" /></div>`);
    expect(isElementVisible(doc.getElementById('a')!)).toBe(false);
  });

  it('respects aria-hidden', () => {
    const doc = render(`<input id="a" name="a" aria-hidden="true" />`);
    expect(isElementVisible(doc.getElementById('a')!)).toBe(false);
  });
});

describe('detector — signatures', () => {
  it('is stable across re-detections of the same form', () => {
    const html = `<form><input name="full_name" /><input name="mobile" /></form>`;
    const first = detectFields(render(html)).map((field) => field.signature);
    const second = detectFields(render(html)).map((field) => field.signature);
    expect(first).toEqual(second);
  });

  it('distinguishes two fields that differ only by name', () => {
    const doc = render(`<form><input name="a" /><input name="b" /></form>`);
    const [one, two] = detectFields(doc);
    expect(one?.signature).not.toBe(two?.signature);
  });

  it('survives a field moving position when it has a name', () => {
    const before = render(`<form><input name="full_name" /></form>`);
    const beforeSignature = detectFields(before)[0]?.signature;

    const after = render(`<form><input name="extra" /><input name="full_name" /></form>`);
    const afterSignature = detectFields(after).find((f) => f.name === 'full_name')?.signature;

    expect(afterSignature).toBe(beforeSignature);
  });

  it('falls back to position for a field with no name or id', () => {
    const element = document.createElement('input');
    expect(fieldSignature(element, 0, 3)).toBe(fieldSignature(element, 0, 3));
    expect(fieldSignature(element, 0, 3)).not.toBe(fieldSignature(element, 0, 4));
  });
});

describe('detector — page context', () => {
  it('captures origin, path and title but never the query string', () => {
    document.title = 'Scholarship application';
    const context = collectPageContext(document);

    expect(context.title).toBe('Scholarship application');
    expect(context.origin).toBe(window.location.origin);
    expect(context.path).toBe(window.location.pathname);
    expect(JSON.stringify(context)).not.toContain('?');
  });
});

describe('detector — blocked pages', () => {
  it.each([
    { protocol: 'chrome:', hostname: 'extensions' },
    { protocol: 'chrome-extension:', hostname: 'abcdef' },
    { protocol: 'about:', hostname: '' },
    { protocol: 'file:', hostname: '' },
    { protocol: 'https:', hostname: 'chromewebstore.google.com' },
  ])('refuses to run on %o', (location) => {
    expect(isBlockedPage(location)).toBe(true);
  });

  it('runs on an ordinary portal page', () => {
    expect(isBlockedPage({ protocol: 'https:', hostname: 'demo.assistigo.test' })).toBe(false);
  });
});
