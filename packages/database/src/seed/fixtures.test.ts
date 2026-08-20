import { describe, expect, it } from 'vitest';
import { fakeCustomer, DEMO_MEMBERS, DEMO_ORGANIZATION } from './fixtures';

describe('fakeCustomer', () => {
  it('is deterministic for a given index', () => {
    expect(fakeCustomer(3)).toEqual(fakeCustomer(3));
  });

  it('never produces a real-format mobile number (docs/DATABASE.md §7)', () => {
    for (let i = 0; i < 30; i++) {
      expect(fakeCustomer(i).mobile).toMatch(/^99000\d{5}$/);
    }
  });

  it('only ever stores an all-zero Aadhaar last four', () => {
    for (let i = 0; i < 30; i++) {
      expect(fakeCustomer(i).aadhaarLast4).toBe('0000');
    }
  });

  it('generates a pattern-valid PAN with the ZZZ issuer block', () => {
    for (let i = 0; i < 30; i++) {
      expect(fakeCustomer(i).pan).toMatch(/^ZZZP[A-Z]\d{4}Q$/);
    }
  });

  it('produces distinct customers across the seed range', () => {
    const names = new Set(Array.from({ length: 30 }, (_, i) => fakeCustomer(i).fullName));
    expect(names.size).toBeGreaterThan(1);
  });
});

describe('DEMO_MEMBERS', () => {
  it('covers every organization role exactly once', () => {
    const roles = DEMO_MEMBERS.map((m) => m.role);
    expect(new Set(roles).size).toBe(roles.length);
    expect(roles.sort()).toEqual(
      ['billing_admin', 'manager', 'operator', 'owner', 'viewer'].sort(),
    );
  });

  it('uses a .test email domain, never a real-looking one', () => {
    for (const member of DEMO_MEMBERS) {
      expect(member.email.endsWith('@assistigo-demo.test')).toBe(true);
    }
  });
});

describe('DEMO_ORGANIZATION', () => {
  it('has a name that is obviously a demo fixture', () => {
    expect(DEMO_ORGANIZATION.name.toLowerCase()).toContain('demo');
  });
});
