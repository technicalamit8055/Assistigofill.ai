/**
 * Fake data generators for the demo seed.
 * Rules: docs/DATABASE.md §7, docs/DEVELOPMENT_RULES.md rule 6 — no real citizen data, ever.
 *
 * A fixed seed (mulberry32) makes every `npm run db:reset && npm run db:seed` produce byte-identical
 * output, which is what makes the RLS tests (packages/database/rls-tests) able to assert on
 * specific rows instead of "some row that happens to exist".
 */

function mulberry32(seed: number) {
  let a = seed;
  return function random(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)] as T;
}

function digits(count: number, rng: () => number): string {
  let out = '';
  for (let i = 0; i < count; i++) out += Math.floor(rng() * 10).toString();
  return out;
}

const FIRST_NAMES_MALE = [
  'Amit',
  'Ravi',
  'Suresh',
  'Vijay',
  'Rakesh',
  'Sanjay',
  'Deepak',
  'Manoj',
  'Ajay',
  'Arun',
  'Naveen',
  'Pankaj',
  'Rajesh',
  'Vikram',
  'Yogesh',
];

const FIRST_NAMES_FEMALE = [
  'Sunita',
  'Pooja',
  'Anita',
  'Kavita',
  'Rekha',
  'Meena',
  'Neha',
  'Priya',
  'Geeta',
  'Shalini',
  'Vandana',
  'Kiran',
  'Nisha',
  'Sarita',
  'Usha',
];

const SURNAMES = [
  'Kumar',
  'Singh',
  'Sharma',
  'Verma',
  'Yadav',
  'Gupta',
  'Prasad',
  'Mishra',
  'Chauhan',
  'Rathi',
  'Pandey',
  'Jha',
  'Thakur',
  'Patel',
];

const VILLAGES = [
  'Rampur',
  'Sultanpur',
  'Madhopur',
  'Bishunpur',
  'Chandpur',
  'Devpur',
  'Kishanganj',
  'Narsinghpur',
];

const DISTRICTS = [
  { district: 'Muzaffarpur', state: 'Bihar' },
  { district: 'Gorakhpur', state: 'Uttar Pradesh' },
  { district: 'Dhanbad', state: 'Jharkhand' },
  { district: 'Bhilwara', state: 'Rajasthan' },
  { district: 'Ratlam', state: 'Madhya Pradesh' },
];

/** Fake PIN codes: valid 6-digit shape, drawn from unused-block prefixes to avoid a real locality. */
function fakePincode(rng: () => number): string {
  return `9${digits(5, rng)}`;
}

/** Reserved for demo/test use, per docs/DATABASE.md §7 — never allocated to a real subscriber. */
function fakeMobile(rng: () => number): string {
  return `99000${digits(5, rng)}`;
}

/** Pattern-valid PAN with the ZZZ issuer block, per docs/DATABASE.md §7. */
function fakePan(sequence: number, rng: () => number): string {
  const holder = String.fromCharCode(65 + (sequence % 26));
  return `ZZZP${holder}${digits(4, rng)}Q`;
}

function fakeAccountNumber(rng: () => number): string {
  return `000${digits(11, rng)}`;
}

function fakeIfsc(rng: () => number): string {
  return `ZZZB0${digits(6, rng)}`;
}

const BANKS = ['State Bank of India', 'Punjab National Bank', 'Bank of Baroda', 'Canara Bank'];

export type FakeCustomer = {
  fullName: string;
  fullNameHi?: string;
  gender: 'male' | 'female';
  mobile: string;
  dateOfBirth: string;
  fatherName: string;
  motherName: string;
  category: 'general' | 'obc' | 'sc' | 'st' | 'ews';
  village: string;
  district: string;
  state: string;
  pincode: string;
  aadhaarLast4: string;
  pan: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
};

const CATEGORIES: FakeCustomer['category'][] = ['general', 'obc', 'sc', 'st', 'ews'];

/** Deterministic — same index always produces the same fake customer, however many times it is called. */
export function fakeCustomer(index: number): FakeCustomer {
  const rng = mulberry32(20260101 + index);
  const gender = index % 2 === 0 ? 'male' : 'female';
  const firstName = pick(gender === 'male' ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE, rng);
  const surname = pick(SURNAMES, rng);
  const fatherFirst = pick(FIRST_NAMES_MALE, rng);
  const motherFirst = pick(FIRST_NAMES_FEMALE, rng);
  const place = pick(DISTRICTS, rng);
  const year = 1970 + Math.floor(rng() * 35);
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * 28);

  return {
    fullName: `${firstName} ${surname}`,
    gender,
    // Always zero — this is a demo fixture, never a real subscriber's number (spec §32.1).
    mobile: fakeMobile(rng),
    dateOfBirth: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    fatherName: `${fatherFirst} ${surname}`,
    motherName: `${motherFirst} ${surname}`,
    category: pick(CATEGORIES, rng),
    village: pick(VILLAGES, rng),
    district: place.district,
    state: place.state,
    pincode: fakePincode(rng),
    aadhaarLast4: '0000',
    pan: fakePan(index, rng),
    accountNumber: fakeAccountNumber(rng),
    ifsc: fakeIfsc(rng),
    bankName: pick(BANKS, rng),
  };
}

export const DEMO_ORGANIZATION = {
  name: 'Demo Seva Kendra',
  businessType: 'csc_vle' as const,
  city: 'Muzaffarpur',
  district: 'Muzaffarpur',
  state: 'Bihar',
};

/** One demo user per role, so every RLS scenario in docs/DATABASE.md §8 has a real member to test. */
export const DEMO_MEMBERS = [
  { email: 'demo.owner@assistigo-demo.test', role: 'owner' as const, name: 'Demo Owner' },
  { email: 'demo.manager@assistigo-demo.test', role: 'manager' as const, name: 'Demo Manager' },
  { email: 'demo.operator@assistigo-demo.test', role: 'operator' as const, name: 'Demo Operator' },
  { email: 'demo.viewer@assistigo-demo.test', role: 'viewer' as const, name: 'Demo Viewer' },
  {
    email: 'demo.billing@assistigo-demo.test',
    role: 'billing_admin' as const,
    name: 'Demo Billing Admin',
  },
];

/** Password is fixed and public on purpose — this account only ever exists in local/demo Supabase. */
export const DEMO_PASSWORD = 'AssistigoDemo!2026';
