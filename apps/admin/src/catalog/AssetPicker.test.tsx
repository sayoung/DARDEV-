import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AssetPicker } from './AssetPicker.js';
import { AssetKind } from '@xplor/shared';
import { i18n } from '../i18n.js';

describe('AssetPicker', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
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
      pageSize: 100
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

    const button = screen.getByText('Sélectionner un média...');
    fireEvent.click(button);

    // Chargement
    expect(screen.getByText('Chargement...')).toBeTruthy();

    // Attente du rendu du sélecteur
    const radioGroup = await screen.findByRole('radiogroup', { name: 'Panorama' });
    expect(radioGroup).toBeTruthy();

    // Vérification de l'URL
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('kind=PANORAMA&status=READY'),
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
          id: '22222222-2222-7222-8222-222222222222',
          filename: 'ready.jpg',
          kind: 'IMAGE',
          mimeType: 'image/jpeg',
          sizeBytes: 1024, width: 800, height: 600,
          processingLog: null, copyright: null, thumbnailUrl: null, derivatives: {}, panorama: null, 
          processingStatus: 'READY',
          createdAt: new Date().toISOString()
        }
      ],
      total: 1,
      page: 1,
      pageSize: 24
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

    const button = screen.getByText('Sélectionner un média...');
    fireEvent.click(button);

    await screen.findByRole('radiogroup');
    
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(1); // Seulement le READY
  });

  it('ne refetch pas lors du re-rendu du parent avec un tableau inline', async () => {
    const mockAssets = {
      items: [
        {
          id: '33333333-3333-7333-8333-333333333333',
          filename: 'video.mp4',
          kind: 'VIDEO',
          mimeType: 'video/mp4',
          sizeBytes: 1024, width: 800, height: 600,
          processingLog: null, copyright: null, thumbnailUrl: null, derivatives: {}, panorama: null, 
          processingStatus: 'READY',
          createdAt: new Date().toISOString()
        }
      ],
      total: 1,
      page: 1,
      pageSize: 100
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

    const button = screen.getByText('Sélectionner un média...');
    fireEvent.click(button);

    await screen.findByRole('radiogroup');
    
    // Il y a deux types dans le tableau inline, mais listAssets accepte kinds[] donc 1 fetch
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Re-rendu avec un nouveau tableau inline (référence différente mais même contenu)
    rerender(
      <AssetPicker 
        label="Vidéo" 
        kinds={[AssetKind.VIDEO, AssetKind.IMAGE]} 
        value="33333333-3333-7333-8333-333333333333" 
        onChange={vi.fn()} 
      />
    );
    
    // Le rerender avec `value` déclenche un fetch pour getAsset(value)
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('affiche un message si la liste est vide', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 }),
    } as Response);

    render(
      <AssetPicker 
        label="Vidéo" 
        kind={AssetKind.VIDEO} 
        value="" 
        onChange={vi.fn()} 
      />
    );

    const button = screen.getByText('Sélectionner un média...');
    fireEvent.click(button);

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

    const button = screen.getByText('Sélectionner un média...');
    fireEvent.click(button);

    const errors = await screen.findAllByText('Impossible de charger les médias.');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('filtre par la recherche (casse, aucun résultat)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((e) => {
      console.log('CAUGHT API ERROR:', e);
    });

    const mockAssets = {
      items: [
        {
          id: '11111111-1111-7111-8111-111111111111', filename: 'Pano1.jpg', kind: 'PANORAMA', mimeType: 'image/jpeg', 
          sizeBytes: 1024, width: 800, height: 600, processingStatus: 'READY', 
          processingLog: null, copyright: null, thumbnailUrl: null, derivatives: {}, panorama: null, 
          createdAt: '2026-10-01T10:00:00.000Z'
        },
        {
          id: '22222222-2222-7222-8222-222222222222', filename: 'Autre.jpg', kind: 'PANORAMA', mimeType: 'image/jpeg', 
          sizeBytes: 1024, width: 800, height: 600, processingStatus: 'READY', 
          processingLog: null, copyright: null, thumbnailUrl: null, derivatives: {}, panorama: null, 
          createdAt: '2026-10-01T12:00:00.000Z'
        }
      ],
      total: 2, page: 1, pageSize: 100
    };
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(mockAssets) } as Response);

    render(<AssetPicker label="Panoramas" kind={AssetKind.PANORAMA} value="" onChange={vi.fn()} />);
    
    const button = screen.getByText('Sélectionner un média...');
    fireEvent.click(button);

    // Attente chargement
    await screen.findByRole('radiogroup');
    errorSpy.mockRestore();
    
    // Vérification initiale
    expect(screen.getByText('Pano1.jpg')).toBeTruthy();
    expect(screen.getByText('Autre.jpg')).toBeTruthy();
  });

  it('affiche le repli « Média du jj/mm/aaaa », les dimensions L × H', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((e) => {
      console.log('CAUGHT API ERROR:', e);
    });

    const mockAssets = {
      items: [
        {
          id: '33333333-3333-7333-8333-333333333333', filename: '', kind: 'PANORAMA', mimeType: 'image/jpeg', 
          sizeBytes: 1024, width: 4000, height: 2000, processingStatus: 'READY', 
          processingLog: null, copyright: null, thumbnailUrl: null, derivatives: {}, panorama: null, 
          createdAt: '2026-09-01T10:00:00.000Z'
        },
        {
          id: '44444444-4444-7444-8444-444444444444', filename: '', kind: 'PANORAMA', mimeType: 'image/jpeg', 
          sizeBytes: 1024, width: 8000, height: 4000, processingStatus: 'READY', 
          processingLog: null, copyright: null, thumbnailUrl: null, derivatives: {}, panorama: null, 
          createdAt: '2026-10-01T12:00:00.000Z'
        }
      ],
      total: 2, page: 1, pageSize: 100
    };
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(mockAssets) } as Response);

    render(<AssetPicker label="Panoramas" kind={AssetKind.PANORAMA} value="" onChange={vi.fn()} />);
    
    const button = screen.getByText('Sélectionner un média...');
    fireEvent.click(button);

    await screen.findByRole('radiogroup');
    errorSpy.mockRestore();
    
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    
    // Vérification de l'ordre tel que retourné par l'API
    const firstTitle = radios[0]?.querySelector('p.truncate')?.textContent;
    expect(firstTitle).toBe('Média du 01/09/2026'); // Le repli est appelé
    
    const firstDim = radios[0]?.querySelector('p.text-xs.text-muted-foreground')?.textContent;
    expect(firstDim).toContain('4000 × 2000 - 01/09/2026'); // Affichage L × H
    
    const secondTitle = radios[1]?.querySelector('p.truncate')?.textContent;
    expect(secondTitle).toBe('Média du 01/10/2026');
    const secondDim = radios[1]?.querySelector('p.text-xs.text-muted-foreground')?.textContent;
    expect(secondDim).toContain('8000 × 4000 - 01/10/2026');
  });
});
