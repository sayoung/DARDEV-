import { describe, expect, it } from 'vitest';
import { hrefFor, parsePathname } from './router.js';

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
      expect(parsePathname('/hotels')).toEqual({ name: 'hotels' });
      expect(parsePathname('/hotels/789/selection')).toEqual({ name: 'hotel-selection', id: '789' });
      expect(parsePathname('/media')).toEqual({ name: 'media' });
    });

    it('decode id for hotel-selection', () => {
      expect(parsePathname('/hotels/mon%20id/selection')).toEqual({ name: 'hotel-selection', id: 'mon id' });
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

  describe('hrefFor', () => {
    it('build hotel links while preserving language and dropping notices', () => {
      window.history.replaceState(null, '', '/?lang=fr&notice=expired');

      expect(hrefFor('/hotels')).toBe('/hotels?lang=fr');
      expect(hrefFor('/hotels/789/selection')).toBe('/hotels/789/selection?lang=fr');
    });
  });
});
