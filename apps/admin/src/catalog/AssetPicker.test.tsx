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

  it('affiche un message de chargement puis les options (avec kind dans lURL)', async () => {
    const mockAssets = {
      items: [
        {
          id: '01923e45-6789-7abc-8ef0-123456789abc',
          kind: 'IMAGE',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          width: 800,
          height: 600,
          processingStatus: 'READY',
          processingLog: null,
          copyright: null,
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
        label="Image de couverture" 
        kind={AssetKind.IMAGE} 
        value="" 
        onChange={onChange} 
      />
    );

    // Chargement
    expect(screen.getByText('Chargement...')).toBeTruthy();

    // Attente du rendu du sélecteur
    const select = await screen.findByLabelText('Image de couverture');
    expect(select).toBeTruthy();

    // Vérification de l'URL
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/admin/assets?page=1&pageSize=100&kind=IMAGE'),
      expect.any(Object)
    );

    // Vérification des options
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2); // Option vide + 1 asset
    expect(options[0]?.textContent).toBe('Sélectionner un média...');
    expect(options[1]?.textContent).toBe('56789abc - image/jpeg 800×600 - Prêt');

    // Changement de valeur
    fireEvent.change(select, { target: { value: '01923e45-6789-7abc-8ef0-123456789abc' } });
    expect(onChange).toHaveBeenCalledWith('01923e45-6789-7abc-8ef0-123456789abc');
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

    expect(await screen.findByText('Aucun média trouvé.')).toBeTruthy();
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

    expect(await screen.findByText('Impossible de charger les médias.')).toBeTruthy();
  });
});
