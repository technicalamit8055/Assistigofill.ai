import { describe, expect, it } from 'vitest';
import { findDuplicates, nameSimilarity, scoreDuplicate } from './duplicates';

const candidate = {
  id: 'existing-1',
  fullName: 'Amit Kumar',
  mobile: '9900012345',
  dateOfBirth: '1990-04-03',
  fatherName: 'Ram Kumar',
  district: 'Patna',
};

describe('nameSimilarity', () => {
  it('is 1 for the same name written differently', () => {
    expect(nameSimilarity('Amit Kumar', '  AMIT   kumar ')).toBe(1);
  });

  it('scores a shortened name highly', () => {
    expect(nameSimilarity('Amit Kumar Singh', 'Amit Singh')).toBeGreaterThan(0.8);
  });

  it('scores unrelated names low', () => {
    expect(nameSimilarity('Amit Kumar', 'Sunita Devi')).toBeLessThan(0.4);
  });

  it('handles Devanagari', () => {
    expect(nameSimilarity('अमित कुमार', 'अमित कुमार')).toBe(1);
  });
});

describe('scoreDuplicate', () => {
  it('flags a repeat customer with the same mobile and name', () => {
    const match = scoreDuplicate({ fullName: 'Amit Kumar', mobile: '+91 99000 12345' }, candidate);
    expect(match.confidence).toBe('high');
    expect(match.reasons).toContain('SAME_MOBILE');
  });

  it('flags the same name and date of birth even without a mobile', () => {
    const match = scoreDuplicate({ fullName: 'Amit Kumar', dateOfBirth: '1990-04-03' }, candidate);
    expect(match.reasons).toContain('SAME_NAME_AND_DOB');
    expect(match.confidence).toBe('high');
  });

  it('only warns — a shared family mobile with a different person is medium at most', () => {
    const match = scoreDuplicate({ fullName: 'Sunita Devi', mobile: '9900012345' }, candidate);
    expect(match.reasons).toEqual(['SAME_MOBILE']);
    expect(match.confidence).toBe('medium');
    expect(match.score).toBeLessThan(0.9);
  });

  it('does not flag two different people from the same district', () => {
    const match = scoreDuplicate({ fullName: 'Sunita Devi', district: 'Patna' }, candidate);
    expect(match.score).toBe(0);
    expect(match.reasons).toEqual([]);
  });

  it('does not flag brothers with different first names', () => {
    const match = scoreDuplicate(
      { fullName: 'Rohit Kumar', fatherName: 'Ram Kumar', district: 'Patna' },
      candidate,
    );
    expect(match.score).toBeLessThan(0.6);
  });
});

describe('findDuplicates', () => {
  it('returns matches above the threshold, strongest first', () => {
    const matches = findDuplicates({ fullName: 'Amit Kumar', mobile: '9900012345' }, [
      { id: 'a', fullName: 'Sunita Devi', mobile: '9900099999' },
      candidate,
      { id: 'c', fullName: 'Amit Kumar', district: 'Patna' },
    ]);
    expect(matches[0]?.candidateId).toBe('existing-1');
    expect(matches.map((m) => m.candidateId)).not.toContain('a');
  });

  it('returns nothing for a genuinely new customer', () => {
    expect(findDuplicates({ fullName: 'Priya Sharma', mobile: '9900054321' }, [candidate])).toEqual(
      [],
    );
  });
});
