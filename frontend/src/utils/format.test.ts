import { describe, it, expect } from 'vitest';
import { formatNumber, formatCompact, formatCurrency, formatPoints, titleCase, initials } from './format';

describe('formatting helpers', () => {
  it('uses the Indian numbering system', () => {
    expect(formatNumber(1234567)).toBe('12,34,567');
  });

  it('returns an em dash rather than NaN for missing values', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
    expect(formatCurrency(null)).toBe('—');
  });

  it('compacts large figures for chart axes', () => {
    expect(formatCompact(4_850_000)).toBe('4.85M');
    expect(formatCompact(12_450)).toBe('12.5K');
    expect(formatCompact(480)).toBe('480');
  });

  it('signs point movements explicitly', () => {
    expect(formatPoints(1500)).toBe('+1,500');
    expect(formatPoints(-500)).toBe('-500');
  });

  it('converts enum values into readable labels', () => {
    expect(titleCase('UNDER_REVIEW')).toBe('Under Review');
    expect(titleCase('POINTS_LOCKED')).toBe('Points Locked');
  });

  it('derives at most two initials', () => {
    expect(initials('Aarav Sharma')).toBe('AS');
    expect(initials('Priya')).toBe('P');
  });
});
