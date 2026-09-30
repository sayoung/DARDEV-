import { describe, expect, it } from 'vitest';
import { parsePathname } from './router.js';

describe('router', () => {
  describe('parsePathname', () => {
    it('parse public routes', () => {
      expect(parsePathname('/forgot')).toEqual({ name: 'forgot' });
      expect(parsePathname('/reset/123')).toEqual({ name: 'reset', token: '123' });
      expect(parsePathname('/invite/abc')).toEqual({ name: 'invite', token: 'abc' });
    });

    it('parse authenticated routes', () => {
      expect(parsePathname('/')).toEqual({ name: 'home' });
      expect(parsePathname('/cities')).toEqual({ name: 'cities' });
      expect(parsePathname('/categories')).toEqual({ name: 'categories' });
      expect(parsePathname('/tours')).toEqual({ name: 'tours' });
      expect(parsePathname('/tours/new')).toEqual({ name: 'tour-new' });
      expect(parsePathname('/tours/456')).toEqual({ name: 'tour-detail', id: '456' });
    });

    it('decode id for tour-detail', () => {
      expect(parsePathname('/tours/mon%20id')).toEqual({ name: 'tour-detail', id: 'mon id' });
    });

    it('fallback to home for empty id or unknown path', () => {
      expect(parsePathname('/tours/')).toEqual({ name: 'home' });
      expect(parsePathname('/unknown-path')).toEqual({ name: 'home' });
      expect(parsePathname('')).toEqual({ name: 'home' });
    });
  });
});
