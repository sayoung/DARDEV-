import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn utility', () => {
  it('merges multiple string classes', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('handles conditional classes, ignoring false, null, undefined', () => {
    expect(cn('class1', false, 'class3', undefined, null)).toBe('class1 class3');
  });

  it('handles conflicting tailwind classes by keeping the last one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});
