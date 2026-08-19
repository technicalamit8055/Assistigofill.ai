/**
 * Fill-execution safety tests.
 *
 * DO NOT DELETE OR WEAKEN THIS FILE. It is the executable form of the four hard product rules
 * (spec §14.8, §19.7) and CI runs it as its own job.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyFill, findElementBySignature } from '../src/content/filler';
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

  it('reports dependent_not_ready rather than forcing an unpopulated dropdown', async () => {
    vi.useFakeTimers();
    const doc = render(
      `<form><select name="district"><option value="">Select</option></select></form>`,
    );
    const promise = applyFill(doc, [
      { signature: signatureOf(doc, 'district'), value: 'Patna', inputType: 'select-one' },
    ]);
    await vi.advanceTimersByTimeAsync(2000);
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
