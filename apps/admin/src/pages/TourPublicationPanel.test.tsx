import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { TourPublicationPanel } from './TourPublicationPanel.js';
import { TourStatus, type TourResponse, ValidationIssueCode, Role } from '@xplor/shared';
import * as client from '../api/client.js';

// Setup translation mock if needed, but since jsdom is used, real i18n might be initialized in a global setup, 
// or we can mock react-i18next
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          'catalog.publication.status': 'Statut',
          'catalog.tour.status.DRAFT': 'Brouillon',
          'catalog.tour.status.PUBLISHED': 'Publiée',
          'catalog.publication.validate': 'Vérifier',
          'catalog.publication.publish': 'Publier',
          'catalog.publication.unpublish': 'Dépublier',
          'catalog.publication.noIssues': 'Aucun problème : la visite peut être publiée',
          'catalog.publication.issuesTitle': 'Problèmes à corriger avant publication',
          'catalog.issue.SCENE_UNREACHABLE': 'Scène inatteignable (aucun lien vers cette scène)',
          'common.error.generic': 'Une erreur est survenue.'
        };
        return translations[key] || key;
      },
      i18n: { language: 'fr' }
    })
  };
});

const mockTour: TourResponse = {
  id: '01900000-0000-0000-0000-000000000000',
  title: { fr: 'Visite manuelle' },
  summary: { fr: 'Résumé' },
  cityId: '01900000-0000-0000-0000-000000000001',
  categoryIds: ['01900000-0000-0000-0000-000000000002'],
  coverAssetId: '01900000-0000-0000-0000-000000000003',
  status: TourStatus.DRAFT,
  publicShare: false,
  shareToken: '1234567890123456789012',
  sceneCount: 3,
  createdById: '01900000-0000-0000-0000-000000000004',
  contentVersion: 1,
  startSceneId: null,
  publishedAt: null
};

vi.mock('../auth/AuthProvider.js', () => ({
  useAuth: () => ({
    state: {
      status: 'authenticated',
      profile: { id: 'u1', email: 'test@xplor.local', name: 'Test', role: Role.ADMIN, uiLang: 'fr' }
    }
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

describe('TourPublicationPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  
  afterEach(() => {
    cleanup();
  });

  it('422 avec SCENE_UNREACHABLE affiche le libellé traduit et un lien vers la scène', async () => {
    const onTourUpdated = vi.fn();
    
    // @ts-expect-error - Mocking generic function
    const requestJsonSpy = vi.spyOn(client, 'requestJson').mockImplementation(async (url: string) => {
      if (url.includes('/publish')) {
        return Promise.reject(new client.ApiError(422, 'TOUR_NOT_PUBLISHABLE', [{
          code: ValidationIssueCode.SCENE_UNREACHABLE,
          sceneId: '01900000-0000-4000-8000-000000000005',
          message: 'Scene unreachable'
        }]));
      }
      if (url.includes('/scenes')) {
        return Promise.resolve([{
          id: '01900000-0000-4000-8000-000000000005',
          tourId: mockTour.id,
          title: { fr: 'Remparts' },
          panoramaAssetId: '01900000-0000-4000-8000-000000000000',
          initialYaw: 0,
          initialPitch: 0,
          initialZoom: 50,
          weight: 0,
          hotspotCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]);
      }
      return Promise.resolve(null);
    });

    render(<TourPublicationPanel tour={mockTour} onTourUpdated={onTourUpdated} />);
    
    const publishBtn = screen.getByRole('button', { name: 'Publier' });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });

    expect(screen.getByText(/Scène inatteignable/)).toBeDefined();
    
    const link = screen.getByRole('link', { name: 'Remparts' });
    expect(link.getAttribute('href')).toBe('#scene-01900000-0000-4000-8000-000000000005');
    
    expect(requestJsonSpy).toHaveBeenCalledTimes(2); // publish, then listScenes
  });

  it('publish 200 fait passer le statut à PUBLISHED et affiche Dépublier', async () => {
    const onTourUpdated = vi.fn();
    
    // @ts-expect-error - Mocking generic function
    vi.spyOn(client, 'requestJson').mockResolvedValueOnce({
      ...mockTour,
      status: TourStatus.PUBLISHED
    });

    render(<TourPublicationPanel tour={mockTour} onTourUpdated={onTourUpdated} />);
    
    const publishBtn = screen.getByRole('button', { name: 'Publier' });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(onTourUpdated).toHaveBeenCalledWith(expect.objectContaining({ status: TourStatus.PUBLISHED }));
    });
  });

  it('validate avec une liste vide affiche le message de succès', async () => {
    const onTourUpdated = vi.fn();
    
    // @ts-expect-error - Mocking generic function
    vi.spyOn(client, 'requestJson').mockResolvedValueOnce({
      issues: []
    });

    render(<TourPublicationPanel tour={mockTour} onTourUpdated={onTourUpdated} />);
    
    const validateBtn = screen.getByRole('button', { name: 'Vérifier' });
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('Aucun problème : la visite peut être publiée');
    });
  });

  it('issues mal formées -> message générique', async () => {
    const onTourUpdated = vi.fn();
    
    // @ts-expect-error - Mocking generic function
    vi.spyOn(client, 'requestJson').mockImplementation(async (url: string) => {
      if (url.includes('/publish')) {
        return Promise.reject(new client.ApiError(422, 'TOUR_NOT_PUBLISHABLE', [{
          code: 'UNKNOWN_CODE',
          message: 'What'
        }]));
      }
      return Promise.resolve(null);
    });

    render(<TourPublicationPanel tour={mockTour} onTourUpdated={onTourUpdated} />);
    
    const publishBtn = screen.getByRole('button', { name: 'Publier' });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Une erreur est survenue.');
    });
  });
});
