/**
 * Tests for the "Edit details" form's decision-building — the logic that decides which of the
 * operator's inputs actually count as a change worth saving. The cases that matter are the ones
 * where a bug would either silently drop a real edit or send a no-op value (a masked placeholder,
 * an untouched field) up to the write path.
 */

import { describe, expect, it } from 'vitest';
import { buildEditDecisions, type EditableFieldMeta } from './edit-decisions';

function field(overrides: Partial<EditableFieldMeta> = {}): EditableFieldMeta {
  return { key: 'customer.full_name', value: null, encrypted: false, ...overrides };
}

describe('buildEditDecisions', () => {
  it('includes a field whose value changed', () => {
    const decisions = buildEditDecisions(
      [field({ key: 'customer.full_name', value: 'Ram Kumar' })],
      new Map([['customer.full_name', 'Ram Prasad']]),
    );
    expect(decisions).toEqual([
      { fieldKey: 'customer.full_name', action: 'edit', value: 'Ram Prasad' },
    ]);
  });

  it('drops a field left unchanged', () => {
    const decisions = buildEditDecisions(
      [field({ key: 'customer.full_name', value: 'Ram Kumar' })],
      new Map([['customer.full_name', 'Ram Kumar']]),
    );
    expect(decisions).toEqual([]);
  });

  it('drops a field left unchanged even with surrounding whitespace', () => {
    const decisions = buildEditDecisions(
      [field({ key: 'customer.full_name', value: 'Ram Kumar' })],
      new Map([['customer.full_name', '  Ram Kumar  ']]),
    );
    expect(decisions).toEqual([]);
  });

  it('treats a blank input as "keep the current value", not as a clear', () => {
    const decisions = buildEditDecisions(
      [field({ key: 'customer.father_name', value: 'Shyam Lal' })],
      new Map([['customer.father_name', '   ']]),
    );
    expect(decisions).toEqual([]);
  });

  it('ignores a field the form never submitted', () => {
    const decisions = buildEditDecisions(
      [field({ key: 'customer.full_name', value: 'Ram Kumar' })],
      new Map(),
    );
    expect(decisions).toEqual([]);
  });

  it('sends any non-blank value for an encrypted field, since it is never prefilled', () => {
    const decisions = buildEditDecisions(
      [field({ key: 'customer.pan', value: null, encrypted: true })],
      new Map([['customer.pan', 'ABCDE1234F']]),
    );
    expect(decisions).toEqual([{ fieldKey: 'customer.pan', action: 'edit', value: 'ABCDE1234F' }]);
  });

  it('leaves an encrypted field alone when the operator left it blank', () => {
    const decisions = buildEditDecisions(
      [field({ key: 'customer.pan', value: null, encrypted: true })],
      new Map([['customer.pan', '']]),
    );
    expect(decisions).toEqual([]);
  });

  it('collects several changed fields and skips the untouched ones', () => {
    const decisions = buildEditDecisions(
      [
        field({ key: 'customer.full_name', value: 'Ram Kumar' }),
        field({ key: 'customer.father_name', value: 'Shyam Lal' }),
        field({ key: 'customer.mobile', value: '9900012345' }),
      ],
      new Map([
        ['customer.full_name', 'Ram Kumar'],
        ['customer.father_name', 'Shyam Prasad'],
        ['customer.mobile', '9900012345'],
      ]),
    );
    expect(decisions).toEqual([
      { fieldKey: 'customer.father_name', action: 'edit', value: 'Shyam Prasad' },
    ]);
  });
});
