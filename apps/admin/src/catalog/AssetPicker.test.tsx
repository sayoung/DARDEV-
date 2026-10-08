import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetPicker } from './AssetPicker.js';
import { AssetKind } from '@xplor/shared';
import { i18n } from '../i18n.js';

describe('AssetPicker', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('affiche les médias READY et permet la sélection', async () => {
    const mockAssets = {
      items: [
        {
          id: '01923e45-6789-7abc-8ef0-123456789abc',
          filename: 'pano.jpg',
          kind: 'PANORAMA',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          width: 800,
          height: 600,
          processingStatus: 'READY',
          processingLog: null,
          copyright: null,
          thumbnailUrl: 'http://example.com/thumb.jpg',
  derivatives: {},
          panorama: null,
          createdAt: new Date().toISOString()
        }
      ],
      total: 1,
      page: 1,
      pageSize: 100,
      totalPages: 1
    };

    const fetchMock = vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockAssets),
    } as Response);

    const onChange = vi.fn();

    render(
      <AssetPicker 
        label="Panorama" 
        kind={AssetKind.PANORAMA} 
        value="" 
        onChange={onChange} 
      />
    );

    // Chargement
    expect(screen.getByText('Chargement...')).toBeTruthy();

    // Attente du rendu du sélecteur
    const radioGroup = await screen.findByRole('radiogroup', { name: 'Panorama' });
    expect(radioGroup).toBeTruthy();

    // Vérification de l'URL
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/admin/assets?page=1&pageSize=100&kind=PANORAMA'),
      expect.any(Object)
    );

    // Vérification des options
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(1);
    
    const img = screen.getByAltText('Miniature de pano.jpg');
    expect(img.getAttribute('src')).toBe('http://example.com/thumb.jpg');

    // Clic pour sélectionner
    const radio = radios[0];
    if (radio) fireEvent.click(radio);
    expect(onChange).toHaveBeenCalledWith('01923e45-6789-7abc-8ef0-123456789abc');
    
    // Le fetch n'a été appelé qu'une seule fois
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ne montre pas les médias PENDING ou en erreur', async () => {
    const mockAssets = {
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          filename: 'pending.jpg',
          kind: 'IMAGE',
          mimeType: 'image/jpeg',
          processingStatus: 'PENDING',
          createdAt: new Date().toISOString()
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          filename: 'ready.jpg',
          kind: 'IMAGE',
          mimeType: 'image/jpeg',
          processingStatus: 'READY',
          createdAt: new Date().toISOString()
        }
      ],
      total: 2,
      page: 1,
      pageSize: 100,
      totalPages: 1
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockAssets),
    } as Response);

    render(
      <AssetPicker 
        label="Image" 
        kind={AssetKind.IMAGE} 
        value="" 
        onChange={vi.fn()} 
      />
    );

    await screen.findByRole('radiogroup');
    
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(1); // Seulement le READY
    expect(screen.queryByText(/11111111/)).toBeNull(); // L'ID pending n'est pas affiché
  });

  it('ne refetch pas lors du re-rendu du parent avec un tableau inline', async () => {
    const mockAssets = {
      items: [
        {
          id: '33333333-3333-3333-3333-333333333333',
          filename: 'video.mp4',
          kind: 'VIDEO',
          mimeType: 'video/mp4',
          processingStatus: 'READY',
          createdAt: new Date().toISOString()
        }
      ],
      total: 1,
      page: 1,
      pageSize: 100,
      totalPages: 1
    };

    const fetchMock = vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockAssets),
    } as Response);

    const { rerender } = render(
      <AssetPicker 
        label="Vidéo" 
        kinds={[AssetKind.VIDEO, AssetKind.IMAGE]} 
        value="" 
        onChange={vi.fn()} 
      />
    );

    await screen.findByRole('radiogroup');
    
    // Il y a deux types dans le tableau inline, donc 2 fetch
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Re-rendu avec un nouveau tableau inline (référence différente mais même contenu)
    rerender(
      <AssetPicker 
        label="Vidéo" 
        kinds={[AssetKind.VIDEO, AssetKind.IMAGE]} 
        value="33333333-3333-3333-3333-333333333333" 
        onChange={vi.fn()} 
      />
    );
    
    // Pas de nouvel appel
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('affiche un message si la liste est vide', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100, totalPages: 0 }),
    } as Response);

    render(
      <AssetPicker 
        label="Vidéo" 
        kind={AssetKind.VIDEO} 
        value="" 
        onChange={vi.fn()} 
      />
    );

    const msgs = await screen.findAllByText('Aucun média trouvé.');
    expect(msgs.length).toBeGreaterThan(0);
  });

  it('affiche une erreur 500 générique', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: { code: 'INTERNAL_ERROR', message: 'Erreur' } }),
    } as Response);

    render(
      <AssetPicker 
        label="Panorama" 
        kind={AssetKind.PANORAMA} 
        value="" 
        onChange={vi.fn()} 
      />
    );

    const errors = await screen.findAllByText('Impossible de charger les médias.');
    expect(errors.length).toBeGreaterThan(0);
  });
});
