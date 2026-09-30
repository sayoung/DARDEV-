import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import React, { useState } from 'react';
import { TourPublicationPanel } from './TourPublicationPanel.js';
import { TourStatus, type TourResponse, ValidationIssueCode, Role } from '@xplor/shared';
import * as authProvider from '../auth/AuthProvider.js';

// Setup translation mock
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
          'catalog.issue.SCENE_UNREACHABLE': 'Scène inatteignable',
          'common.error.generic': 'Une erreur est survenue.'
        };
        return translations[key] || key;
      },
      i18n: { language: 'fr' }
    })
  };
});

const mockTour: TourResponse = {
  id: '01900000-0000-7000-8000-000000000000',
  title: { fr: 'Visite manuelle' },
  summary: { fr: 'Résumé' },
  cityId: '01900000-0000-7000-8000-000000000001',
  categoryIds: ['01900000-0000-7000-8000-000000000002'],
  coverAssetId: '01900000-0000-7000-8000-000000000003',
  status: TourStatus.DRAFT,
  publicShare: false,
  shareToken: '1234567890123456789012',
  sceneCount: 3,
  createdById: '01900000-0000-7000-8000-000000000004',
  contentVersion: 1,
  startSceneId: null,
  publishedAt: null
};

vi.mock('../auth/AuthProvider.js', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('TourPublicationPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
    
    // Default to ADMIN role
    (authProvider.useAuth as Mock).mockReturnValue({
      state: {
        status: 'authenticated',
        profile: { id: 'u1', email: 'test@xplor.local', name: 'Test', role: Role.ADMIN, uiLang: 'fr' }
      }
    });
  });
  
  afterEach(() => {
    cleanup();
  });

  it('422 avec SCENE_UNREACHABLE affiche le libellé traduit et un lien vers la bonne scène', async () => {
    const onTourUpdated = vi.fn();
    
    // Mock fetch for publish returning 422
    mockFetch.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.endsWith('/publish')) {
        return Promise.resolve(new Response(JSON.stringify({
          error: {
            code: 'TOUR_NOT_PUBLISHABLE',
            issues: [{
              code: ValidationIssueCode.SCENE_UNREACHABLE,
              sceneId: '01900000-0000-7000-8000-000000000005', // Remparts
              message: 'Scene unreachable'
            }]
          }
        }), { status: 422, headers: { 'Content-Type': 'application/json' } }));
      }
      
      // The case "Visite manuelle" : Porte, Jardin, Remparts
      if (urlStr.endsWith('/scenes')) {
        const baseScene = {
          tourId: mockTour.id,
          panoramaAssetId: '01900000-0000-7000-8000-000000000000',
          initialYaw: 0,
          initialPitch: 0,
          initialZoom: 50,
          weight: 0,
          hotspotCount: 0,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z'
        };
        return Promise.resolve(new Response(JSON.stringify([
          { ...baseScene, id: '01900000-0000-7000-8000-000000000003', title: { fr: 'Porte' } },
          { ...baseScene, id: '01900000-0000-7000-8000-000000000004', title: { fr: 'Jardin' } },
          { ...baseScene, id: '01900000-0000-7000-8000-000000000005', title: { fr: 'Remparts' } },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(<TourPublicationPanel tour={mockTour} onTourUpdated={onTourUpdated} />);
    
    const publishBtn = screen.getByRole('button', { name: 'Publier' });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });

    expect(screen.getByText(/Scène inatteignable/)).toBeDefined();
    
    // Check that the link chooses the correct scene among the three
    const link = screen.getByRole('link', { name: 'Remparts' });
    expect(link.getAttribute('href')).toBe('#scene-01900000-0000-7000-8000-000000000005');
  });

  it('publish 200 fait passer le statut à PUBLISHED et affiche Dépublier', async () => {
    // To verify display change, we need to pass a mocked tour state or verify that onTourUpdated 
    // triggers a re-render in the parent, but since we are unit testing TourPublicationPanel, 
    // we should render it with a wrapper that maintains state, or just check onTourUpdated.
    // The requirement says: "Le test « publish 200 » ne vérifie pas l'affichage. Il contrôle seulement que onTourUpdated est appelé, pas que le statut passe à « Publiée » ni que « Dépublier » apparaît."
    // Let's create a wrapper to test the UI update!
    
    mockFetch.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.endsWith('/publish')) {
        return Promise.resolve(new Response(JSON.stringify({
          ...mockTour,
          status: TourStatus.PUBLISHED
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const Wrapper = () => {
      const [tour, setTour] = useState(mockTour);
      return <TourPublicationPanel tour={tour} onTourUpdated={setTour} />;
    };

    render(<Wrapper />);
    
    const publishBtn = screen.getByRole('button', { name: 'Publier' });
    fireEvent.click(publishBtn);

    // Wait for display to update: "Publiée" text and "Dépublier" button
    await waitFor(() => {
      expect(screen.getByText(/Statut: Publiée/)).toBeDefined();
    });
    
    expect(screen.getByRole('button', { name: 'Dépublier' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Publier' })).toBeNull();
  });

  it('validate avec une liste vide affiche le message de succès', async () => {
    mockFetch.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.endsWith('/validate')) {
        return Promise.resolve(new Response(JSON.stringify({
          issues: []
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(<TourPublicationPanel tour={mockTour} onTourUpdated={vi.fn()} />);
    
    const validateBtn = screen.getByRole('button', { name: 'Vérifier' });
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('Aucun problème : la visite peut être publiée');
    });
  });

  it('issues mal formées -> message générique', async () => {
    mockFetch.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.endsWith('/publish')) {
        return Promise.resolve(new Response(JSON.stringify({
          error: {
            code: 'TOUR_NOT_PUBLISHABLE',
            issues: [{
              code: 'UNKNOWN_CODE',
              message: 'What'
            }]
          }
        }), { status: 422, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(<TourPublicationPanel tour={mockTour} onTourUpdated={vi.fn()} />);
    
    const publishBtn = screen.getByRole('button', { name: 'Publier' });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Une erreur est survenue.');
    });
  });

  it('Les boutons sont visibles pour ADMIN et EDITOR seulement', () => {
    // Test with ADMIN
    (authProvider.useAuth as Mock).mockReturnValue({
      state: { status: 'authenticated', profile: { role: Role.ADMIN } }
    });
    const { unmount } = render(<TourPublicationPanel tour={mockTour} onTourUpdated={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Vérifier' })).not.toBeNull();
    unmount();

    // Test with EDITOR
    (authProvider.useAuth as Mock).mockReturnValue({
      state: { status: 'authenticated', profile: { role: Role.EDITOR } }
    });
    render(<TourPublicationPanel tour={mockTour} onTourUpdated={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Vérifier' })).not.toBeNull();
    cleanup();

    // Test with HOTEL_MANAGER (not allowed)
    (authProvider.useAuth as Mock).mockReturnValue({
      state: { status: 'authenticated', profile: { role: Role.HOTEL_MANAGER } }
    });
    render(<TourPublicationPanel tour={mockTour} onTourUpdated={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Vérifier' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Publier' })).toBeNull();
  });
});
