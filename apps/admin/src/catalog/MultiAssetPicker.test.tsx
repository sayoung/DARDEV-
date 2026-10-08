import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MultiAssetPicker } from './MultiAssetPicker.js';
import { AssetKind } from '@xplor/shared';
import { i18n } from '../i18n.js';

describe('MultiAssetPicker', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('affiche le nom, gère la sélection multiple avec onChange, recherche, exclusion des médias non READY', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((e) => {
      console.log('CAUGHT API ERROR:', e);
    });
    const mockAssets = {
      items: [
        {
          id: '11111111-1111-7111-8111-111111111111', filename: 'Ready1.jpg', kind: 'PANORAMA', mimeType: 'image/jpeg', 
          sizeBytes: 1024, width: 800, height: 600, processingStatus: 'READY', 
          processingLog: null, copyright: null, thumbnailUrl: null, derivatives: {}, panorama: null, 
          createdAt: '2026-10-01T10:00:00.000Z'
        },
        {
          id: '22222222-2222-7222-8222-222222222222', filename: 'Ready2.jpg', kind: 'PANORAMA', mimeType: 'image/jpeg', 
          sizeBytes: 1024, width: 800, height: 600, processingStatus: 'READY', 
          processingLog: null, copyright: null, thumbnailUrl: null, derivatives: {}, panorama: null, 
          createdAt: '2026-10-01T12:00:00.000Z'
        },
        {
          id: '33333333-3333-7333-8333-333333333333', filename: 'Error.jpg', kind: 'PANORAMA', mimeType: 'image/jpeg', 
          sizeBytes: 1024, width: null, height: null, processingStatus: 'ERROR', 
          processingLog: 'error', copyright: null, thumbnailUrl: null, derivatives: {}, panorama: null, 
          createdAt: '2026-10-01T14:00:00.000Z'
        }
      ],
      total: 3, page: 1, pageSize: 100
    };
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(mockAssets) } as Response);

    const onChange = vi.fn();
    render(<MultiAssetPicker label="Panoramas" kind={AssetKind.PANORAMA} value={['11111111-1111-7111-8111-111111111111']} onChange={onChange} />);
    
    await screen.findByRole('group'); // it uses role="group"
    errorSpy.mockRestore();
    
    // Seulement 2 affichés (READY)
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    
    // Le premier doit être Ready2.jpg (tri par date décroissante)
    const firstTitle = checkboxes[0]?.querySelector('p.truncate')?.textContent;
    expect(firstTitle).toBe('Ready2.jpg');
    
    const secondTitle = checkboxes[1]?.querySelector('p.truncate')?.textContent;
    expect(secondTitle).toBe('Ready1.jpg');

    // Clic sur un non sélectionné
    const firstCheckbox = checkboxes[0];
    if (firstCheckbox) fireEvent.click(firstCheckbox); // Ready2
    expect(onChange).toHaveBeenCalledWith(['11111111-1111-7111-8111-111111111111', '22222222-2222-7222-8222-222222222222']);
    
    // Clic sur un sélectionné
    const secondCheckbox = checkboxes[1];
    if (secondCheckbox) fireEvent.click(secondCheckbox); // Ready1
    expect(onChange).toHaveBeenCalledWith([]);

    // Recherche
    const searchInput = screen.getByPlaceholderText(/Rechercher/i);
    fireEvent.change(searchInput, { target: { value: 'Ready2' } });
    
    expect(screen.queryByText('Ready1.jpg')).toBeNull();
    expect(screen.getByText('Ready2.jpg')).toBeTruthy();
  });
});
