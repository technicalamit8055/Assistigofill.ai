/**
 * Fill-execution safety tests.
 *
 * DO NOT DELETE OR WEAKEN THIS FILE. It is the executable form of the four hard product rules
 * (spec §14.8, §19.7) and CI runs it as its own job.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEPENDENT_WAIT_MS, applyFill, findElementBySignature } from '../src/content/filler';
import { detectFields } from '../src/content/detector';

function render(html: string): Document {
  document.body.innerHTML = html;
  return document;
}

function signatureOf(doc: Document, name: string): string {
  const field = detectFields(doc).find((candidate) => candidate.name === name);
  if (!field) throw new Error(`no detected field named ${name}`);
  return field.signature;
}

/** For custom controls, which are divs and so rarely carry a `name`. */
function signatureOfId(doc: Document, id: string): string {
  const field = detectFields(doc).find((candidate) => candidate.id === id);
  if (!field) throw new Error(`no detected field with id ${id}`);
  return field.signature;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('filler — writes values correctly', () => {
  it('fills a text input and fires input and change events', async () => {
    const doc = render(`<form><input name="full_name" /></form>`);
    const input = doc.querySelector('input')!;

    const events: string[] = [];
    input.addEventListener('input', () => events.push('input'));
    input.addEventListener('change', () => events.push('change'));

    const results = await applyFill(doc, [
      { signature: signatureOf(doc, 'full_name'), value: 'Amit Kumar', inputType: 'text' },
    ]);

    expect(results[0]?.action).toBe('filled');
    expect(input.value).toBe('Amit Kumar');
    // Controlled React/Vue inputs only update when these fire.
    expect(events).toEqual(['input', 'change']);
  });

  it('fills a textarea', async () => {
    const doc = render(`<form><textarea name="address"></textarea></form>`);
    const results = await applyFill(doc, [
      { signature: signatureOf(doc, 'address'), value: 'Village Rampur', inputType: 'textarea' },
    ]);
    expect(results[0]?.action).toBe('filled');
    expect(doc.querySelector('textarea')!.value).toBe('Village Rampur');
  });

  it('selects a dropdown option by value, then by label', async () => {
    const doc = render(`
      <form>
        <select name="state"><option value="">Select</option><option value="BR">Bihar</option></select>
        <select name="district"><option value="">Select</option><option value="PAT">Patna</option></select>
      </form>
    `);

    const byValue = await applyFill(doc, [
      { signature: signatureOf(doc, 'state'), value: 'BR', inputType: 'select-one' },
    ]);
    const byLabel = await applyFill(doc, [
      { signature: signatureOf(doc, 'district'), value: 'Patna', inputType: 'select-one' },
    ]);

    expect(byValue[0]?.action).toBe('filled');
    expect(byLabel[0]?.action).toBe('filled');
    expect(doc.querySelectorAll('select')[0]!.value).toBe('BR');
    expect(doc.querySelectorAll('select')[1]!.value).toBe('PAT');
  });

  it('checks the radio button whose value matches, and leaves the others alone', async () => {
    const doc = render(`
      <form>
        <input type="radio" name="gender" id="m" value="Male" />
        <input type="radio" name="gender" id="f" value="Female" />
      </form>
    `);

    const fields = detectFields(doc);
    const male = fields.find((field) => field.id === 'm')!;

    const results = await applyFill(doc, [
      { signature: male.signature, value: 'Male', inputType: 'radio' },
    ]);

    expect(results[0]?.action).toBe('filled');
    expect((doc.getElementById('m') as HTMLInputElement).checked).toBe(true);
    expect((doc.getElementById('f') as HTMLInputElement).checked).toBe(false);
  });

  it('ticks a checkbox', async () => {
    const doc = render(`<form><input type="checkbox" name="whatsapp" /></form>`);
    const results = await applyFill(doc, [
      { signature: signatureOf(doc, 'whatsapp'), value: 'yes', inputType: 'checkbox' },
    ]);
    expect(results[0]?.action).toBe('filled');
    expect(doc.querySelector('input')!.checked).toBe(true);
  });

  it('fills a multi-select dropdown', async () => {
    const doc = render(`
      <form>
        <select name="hobbies" multiple>
          <option value="sports">Sports</option>
          <option value="music">Music</option>
          <option value="reading">Reading</option>
        </select>
      </form>
    `);
    const results = await applyFill(doc, [
      { signature: signatureOf(doc, 'hobbies'), value: 'sports, music', inputType: 'select-multiple' },
    ]);
    expect(results[0]?.action).toBe('filled');
    const select = doc.querySelector('select')!;
    const selected = Array.from(select.selectedOptions).map((o) => o.value);
    expect(selected).toEqual(['sports', 'music']);
  });

  it('formats dates for date input fields', async () => {
    const doc = render(`<form><input type="date" name="dob" /></form>`);
    const results = await applyFill(doc, [
      { signature: signatureOf(doc, 'dob'), value: '15/08/1995', inputType: 'date' },
    ]);
    expect(results[0]?.action).toBe('filled');
    expect(doc.querySelector('input')!.value).toBe('1995-08-15');
  });

  it('fills contenteditable rich text elements', async () => {
    const doc = render(`<form><div contenteditable="true" id="editor" aria-label="Notes"></div></form>`);
    const fields = detectFields(doc);
    const editorSig = fields[0]!.signature;

    const results = await applyFill(doc, [
      { signature: editorSig, value: 'This is a sample note.', inputType: 'contenteditable' },
    ]);
    expect(results[0]?.action).toBe('filled');
    expect(doc.getElementById('editor')!.textContent).toBe('This is a sample note.');
  });

  it('fills ARIA checkboxes and switches', async () => {
    const doc = render(`
      <form>
        <div role="checkbox" id="chk" aria-checked="false" aria-label="Agree"></div>
        <div role="switch" id="sw" aria-checked="false" aria-label="Enable"></div>
      </form>
    `);
    const fields = detectFields(doc);
    const chkSig = fields.find((f) => f.id === 'chk')!.signature;
    const swSig = fields.find((f) => f.id === 'sw')!.signature;

    const results = await applyFill(doc, [
      { signature: chkSig, value: 'true', inputType: 'checkbox' },
      { signature: swSig, value: 'yes', inputType: 'checkbox' },
    ]);
    expect(results.map((r) => r.action)).toEqual(['filled', 'filled']);
    expect(doc.getElementById('chk')!.getAttribute('aria-checked')).toBe('true');
    expect(doc.getElementById('sw')!.getAttribute('aria-checked')).toBe('true');
  });

  it.each([
    { type: 'time', name: 'slot', value: '5:30 PM', expected: '17:30' },
    { type: 'time', name: 'slot', value: '9:05', expected: '09:05' },
    { type: 'month', name: 'period', value: '08/2026', expected: '2026-08' },
    { type: 'month', name: 'period', value: '2026-8', expected: '2026-08' },
    { type: 'week', name: 'wk', value: '2026-W3', expected: '2026-W03' },
    { type: 'datetime-local', name: 'appt', value: '15/08/1995 5:30 PM', expected: '1995-08-15T17:30' },
    { type: 'color', name: 'tint', value: 'abcdef', expected: '#abcdef' },
    { type: 'color', name: 'tint', value: '#ABC', expected: '#aabbcc' },
  ])('normalises $value into what an <input type="$type"> accepts', async ({ type, name, value, expected }) => {
    const doc = render(`<form><input type="${type}" name="${name}" /></form>`);
    const results = await applyFill(doc, [
      { signature: signatureOf(doc, name), value, inputType: type },
    ]);

    expect(results[0]?.action).toBe('filled');
    expect(doc.querySelector('input')!.value).toBe(expected);
  });

  it('clamps a slider to its bounds instead of letting the browser discard the value', async () => {
    const doc = render(`<form><input type="range" name="score" min="0" max="10" /></form>`);
    const results = await applyFill(doc, [
      { signature: signatureOf(doc, 'score'), value: '99', inputType: 'range' },
    ]);

    expect(results[0]?.action).toBe('filled');
    expect(doc.querySelector('input')!.value).toBe('10');
  });

  it('reports a failure rather than a browser-invented value for an unusable one', async () => {
    // A slider and a colour swatch both replace a value they reject, so "something is in there"
    // is not evidence the fill worked.
    const doc = render(`
      <form>
        <input type="range" name="score" min="0" max="10" />
        <input type="color" name="tint" />
      </form>
    `);

    const results = await applyFill(doc, [
      { signature: signatureOf(doc, 'score'), value: 'not a number', inputType: 'range' },
      { signature: signatureOf(doc, 'tint'), value: 'cerulean', inputType: 'color' },
    ]);

    expect(results.map((r) => r.action)).toEqual(['failed', 'failed']);
  });

  it('picks the matching option out of an ARIA radio group, not the one it was handed', async () => {
    const doc = render(`
      <form>
        <div role="radiogroup" aria-label="Gender">
          <div role="radio" id="male" data-value="M" aria-checked="false">Male</div>
          <div role="radio" id="female" data-value="F" aria-checked="false">Female</div>
        </div>
      </form>
    `);

    // The instruction targets the first radio; the value names the second.
    const results = await applyFill(doc, [
      { signature: signatureOfId(doc, 'male'), value: 'Female', inputType: 'radio' },
    ]);

    expect(results[0]?.action).toBe('filled');
    expect(doc.getElementById('female')!.getAttribute('aria-checked')).toBe('true');
    expect(doc.getElementById('male')!.getAttribute('aria-checked')).toBe('false');
  });

  it('leaves an ARIA radio group alone when no option matches', async () => {
    const doc = render(`
      <form>
        <div role="radiogroup" aria-label="Gender">
          <div role="radio" id="male" data-value="M" aria-checked="false">Male</div>
          <div role="radio" id="female" data-value="F" aria-checked="false">Female</div>
        </div>
      </form>
    `);

    const results = await applyFill(doc, [
      { signature: signatureOfId(doc, 'male'), value: 'Prefer not to say', inputType: 'radio' },
    ]);

    expect(results[0]?.action).toBe('skipped');
    expect(doc.querySelectorAll('[aria-checked="true"]')).toHaveLength(0);
  });

  it('picks an option out of the popup a custom combobox points at', async () => {
    const doc = render(`
      <form>
        <div role="combobox" id="state" aria-label="State" aria-controls="state-list"></div>
        <div id="state-list">
          <div role="option" data-value="BR" id="opt-br">Bihar</div>
          <div role="option" data-value="JH" id="opt-jh">Jharkhand</div>
        </div>
      </form>
    `);

    const clicked: string[] = [];
    for (const id of ['opt-br', 'opt-jh']) {
      doc.getElementById(id)!.addEventListener('click', () => clicked.push(id));
    }

    const results = await applyFill(doc, [
      { signature: signatureOfId(doc, 'state'), value: 'Bihar', inputType: 'combobox' },
    ]);

    expect(results[0]?.action).toBe('filled');
    expect(clicked).toEqual(['opt-br']);
  });

  it('says so when a custom combobox has no option for the value', async () => {
    const doc = render(`
      <form>
        <div role="combobox" id="state" aria-label="State">
          <div role="option" data-value="BR">Bihar</div>
        </div>
      </form>
    `);

    const results = await applyFill(doc, [
      { signature: signatureOfId(doc, 'state'), value: 'Nepal', inputType: 'combobox' },
    ]);

    // Reporting "filled" here would tell the operator a field was handled that never was.
    expect(results[0]).toMatchObject({ action: 'skipped', skipReason: 'no_value' });
  });

  it('types into a role="textbox" that is not a real input', async () => {
    const doc = render(`<form><div role="textbox" id="notes" aria-label="Notes"></div></form>`);
    const results = await applyFill(doc, [
      { signature: signatureOfId(doc, 'notes'), value: 'Village Rampur', inputType: 'text' },
    ]);

    expect(results[0]?.action).toBe('filled');
    expect(doc.getElementById('notes')!.textContent).toBe('Village Rampur');
  });

  it('sets the position of a custom slider through aria-valuenow', async () => {
    const doc = render(
      `<form><div role="slider" id="level" aria-label="Level" aria-valuenow="0"></div></form>`,
    );
    const results = await applyFill(doc, [
      { signature: signatureOfId(doc, 'level'), value: '7', inputType: 'range' },
    ]);

    expect(results[0]?.action).toBe('filled');
    expect(doc.getElementById('level')!.getAttribute('aria-valuenow')).toBe('7');
  });

  it('reports dependent_not_ready rather than forcing an unpopulated dropdown', async () => {
    vi.useFakeTimers();
    const doc = render(
      `<form><select name="district"><option value="">Select</option></select></form>`,
    );
    const promise = applyFill(doc, [
      { signature: signatureOf(doc, 'district'), value: 'Patna', inputType: 'select-one' },
    ]);
    // Past the bounded wait, whatever it is currently tuned to — a hardcoded number here silently
    // turns into a five-second timeout the next time the constant is raised for a slow portal.
    await vi.advanceTimersByTimeAsync(DEPENDENT_WAIT_MS + 500);
    const results = await promise;
    vi.useRealTimers();

    expect(results[0]).toMatchObject({ action: 'skipped', skipReason: 'dependent_not_ready' });
  });
});

describe('filler — safety: never submits', () => {
  it('does not submit the form it fills', async () => {
    const doc = render(`
      <form id="f"><input name="full_name" /><input type="submit" value="Submit" /></form>
    `);
    const form = doc.getElementById('f') as HTMLFormElement;

    const submitted = vi.fn();
    form.addEventListener('submit', submitted);

    await applyFill(doc, [
      { signature: signatureOf(doc, 'full_name'), value: 'Amit Kumar', inputType: 'text' },
    ]);

    expect(submitted).not.toHaveBeenCalled();
  });

  it('refuses to write into a submit input even when instructed', async () => {
    const doc = render(`<form><input type="submit" name="go" value="Submit" /></form>`);
    // A submit input is never detected, so construct the instruction by hand — this is the
    // "somebody tampered with the payload" case.
    const elements = Array.from(doc.querySelectorAll('input, select, textarea'));
    const { fieldSignature } = await import('../src/content/detector');
    const signature = fieldSignature(elements[0]!, 0, 0, 0);

    const clicked = vi.fn();
    doc.querySelector('input')!.addEventListener('click', clicked);

    const results = await applyFill(doc, [{ signature, value: 'anything', inputType: 'submit' }]);

    expect(results[0]).toMatchObject({ action: 'skipped', skipReason: 'submit_control' });
    expect(clicked).not.toHaveBeenCalled();
  });

  it('refuses to click a bare <button> masquerading as a dropdown option', async () => {
    // Filling a custom dropdown means clicking an element applyFill never vetted. A <button>
    // with no type submits its form, so this is the one shape that must never be clicked.
    const doc = render(`
      <form id="f">
        <div role="combobox" id="scheme" aria-label="Scheme" aria-controls="scheme-list"></div>
        <div id="scheme-list"><button id="opt" data-value="Bihar">Bihar</button></div>
      </form>
    `);

    const submitted = vi.fn();
    const clicked = vi.fn();
    (doc.getElementById('f') as HTMLFormElement).addEventListener('submit', submitted);
    doc.getElementById('opt')!.addEventListener('click', clicked);

    const results = await applyFill(doc, [
      { signature: signatureOfId(doc, 'scheme'), value: 'Bihar', inputType: 'combobox' },
    ]);

    expect(results[0]?.action).toBe('skipped');
    expect(clicked).not.toHaveBeenCalled();
    expect(submitted).not.toHaveBeenCalled();
  });

  it('still clicks an option that cannot submit, so the guard is not a blanket refusal', async () => {
    const doc = render(`
      <form id="f">
        <div role="combobox" id="scheme" aria-label="Scheme" aria-controls="scheme-list"></div>
        <div id="scheme-list"><button type="button" id="opt" data-value="Bihar">Bihar</button></div>
      </form>
    `);

    const clicked = vi.fn();
    doc.getElementById('opt')!.addEventListener('click', clicked);

    const results = await applyFill(doc, [
      { signature: signatureOfId(doc, 'scheme'), value: 'Bihar', inputType: 'combobox' },
    ]);

    expect(results[0]?.action).toBe('filled');
    expect(clicked).toHaveBeenCalled();
  });

  it('never dispatches a submit or requestSubmit call', async () => {
    const doc = render(`<form id="f"><input name="full_name" /></form>`);
    const form = doc.getElementById('f') as HTMLFormElement;

    const submitSpy = vi.spyOn(form, 'submit').mockImplementation(() => undefined);
    const requestSubmitSpy = vi.spyOn(form, 'requestSubmit').mockImplementation(() => undefined);

    await applyFill(doc, [
      { signature: signatureOf(doc, 'full_name'), value: 'Amit Kumar', inputType: 'text' },
    ]);

    expect(submitSpy).not.toHaveBeenCalled();
    expect(requestSubmitSpy).not.toHaveBeenCalled();
  });
});

describe('filler — safety: never fills captcha, OTP or payment fields', () => {
  it.each([
    { name: 'captcha', label: 'Enter captcha', reason: 'captcha_field' },
    { name: 'otp', label: 'Enter OTP', reason: 'otp_field' },
    { name: 'cardNumber', label: 'Card number', reason: 'payment_field' },
  ])('refuses $name even when an instruction targets it', async ({ name, label, reason }) => {
    const doc = render(`
      <form>
        <label for="x">${label}</label>
        <input id="x" name="${name}" />
      </form>
    `);

    const results = await applyFill(doc, [
      { signature: signatureOf(doc, name), value: '123456', inputType: 'text' },
    ]);

    expect(results[0]).toMatchObject({ action: 'skipped', skipReason: reason });
    expect(doc.querySelector('input')!.value).toBe('');
  });
});

describe('filler — safety: respects field state', () => {
  it('skips disabled and readonly fields', async () => {
    const doc = render(`
      <form><input name="a" disabled /><input name="b" readonly /></form>
    `);

    const results = await applyFill(doc, [
      { signature: signatureOf(doc, 'a'), value: 'x', inputType: 'text' },
      { signature: signatureOf(doc, 'b'), value: 'y', inputType: 'text' },
    ]);

    expect(results.map((result) => result.skipReason)).toEqual(['disabled', 'readonly']);
  });

  it('reports a missing element instead of writing into the wrong one', async () => {
    const doc = render(`<form><input name="a" /></form>`);
    const results = await applyFill(doc, [
      { signature: 'not-a-real-signature', value: 'x', inputType: 'text' },
    ]);
    expect(results[0]).toMatchObject({ action: 'failed', error: 'element_not_found' });
  });
});

describe('filler — signature resolution', () => {
  it('recomputes signatures from the live DOM rather than trusting the payload', () => {
    const doc = render(`<form><input name="full_name" /><input name="mobile" /></form>`);
    const signature = signatureOf(doc, 'mobile');
    const element = findElementBySignature(doc, signature);
    expect(element?.getAttribute('name')).toBe('mobile');
  });

  it('returns null when the page changed and the field is gone', () => {
    const doc = render(`<form><input name="full_name" /></form>`);
    const signature = signatureOf(doc, 'full_name');
    render(`<form><input name="something_else" /></form>`);
    expect(findElementBySignature(document, signature)).toBeNull();
  });
});
