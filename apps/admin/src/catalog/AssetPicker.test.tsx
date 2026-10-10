import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AssetPicker } from './AssetPicker.js';
import { AssetKind, ProcessingStatus, type AssetResponse } from '@xplor/shared';
import { i18n } from '../i18n.js';
import { listAssets, getAsset } from '../api/catalog.js';

vi.mock('../api/catalog.js');

describe('AssetPicker', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr');
    vi.mocked(listAssets).mockClear();
    vi.mocked(getAsset).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  const makeMockAsset = (id: string, filename: string, kind = AssetKind.PANORAMA): AssetResponse => ({
    id,
    filename,
    kind,
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    width: 800,
    height: 600,
    processingStatus: ProcessingStatus.READY,
    processingLog: null,
    copyright: null,
    thumbnailUrl: null,
    derivatives: {},
    panorama: null,
    createdAt: new Date().toISOString(),
  });

  it('(1) le bouton affiche t(\'catalog.asset.emptyOption\') sans value, et le filename renvoyé par getAsset(value) sinon', async () => {
    vi.mocked(getAsset).mockResolvedValueOnce(makeMockAsset('val1', 'mon-fichier.jpg'));

    const { rerender } = render(<AssetPicker label="Média" onChange={vi.fn()} value="" />);
    expect(screen.getByText('Sélectionner un média...')).toBeTruthy();

    rerender(<AssetPicker label="Média" onChange={vi.fn()} value="val1" />);
    expect(await screen.findByText('mon-fichier.jpg')).toBeTruthy();
    expect(getAsset).toHaveBeenCalledWith('val1');
  });

  it('(2) l\'ouverture appelle listAssets avec les bons paramètres selon kind ou kinds', () => {
    vi.mocked(listAssets).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 24 });
    const { unmount } = render(<AssetPicker label="Média" kind={AssetKind.PANORAMA} onChange={vi.fn()} value="" />);
    
    fireEvent.click(screen.getByText('Sélectionner un média...'));
    expect(listAssets).toHaveBeenCalledWith({ kind: AssetKind.PANORAMA, status: 'READY', page: 1, pageSize: 24 });
    
    unmount();
    vi.mocked(listAssets).mockClear();
    
    render(<AssetPicker label="Média" kinds={[AssetKind.IMAGE, AssetKind.VIDEO]} onChange={vi.fn()} value="" />);
    fireEvent.click(screen.getByText('Sélectionner un média...'));
    expect(listAssets).toHaveBeenCalledWith({ kinds: [AssetKind.IMAGE, AssetKind.VIDEO], status: 'READY', page: 1, pageSize: 24 });
  });

  it('(3) cliquer un radio appelle onChange(id) et ferme la fenêtre', async () => {
    vi.mocked(listAssets).mockResolvedValueOnce({
      items: [makeMockAsset('asset-1', 'asset1.jpg')], total: 1, page: 1, pageSize: 24
    });

    const onChange = vi.fn();
    render(<AssetPicker label="Média" kind={AssetKind.PANORAMA} onChange={onChange} value="" />);
    fireEvent.click(screen.getByText('Sélectionner un média...'));
    
    const radio = await screen.findByRole('radio', { name: 'asset1.jpg' });
    fireEvent.click(radio);
    
    expect(onChange).toHaveBeenCalledWith('asset-1');
    
    // Le dialog devrait être fermé (soit caché, soit démonté)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('(4) état vide, état erreur (Alert destructive)', async () => {
    vi.mocked(listAssets).mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 24 });
    const { unmount } = render(<AssetPicker label="Média" onChange={vi.fn()} value="" />);
    fireEvent.click(screen.getByText('Sélectionner un média...'));
    
    expect(await screen.findByText('Aucun média trouvé.')).toBeTruthy();
    unmount();

    vi.mocked(listAssets).mockRejectedValueOnce(new Error('Erreur API'));
    render(<AssetPicker label="Média" onChange={vi.fn()} value="" />);
    fireEvent.click(screen.getByText('Sélectionner un média...'));
    
    const alert = await screen.findByText('Impossible de charger les médias.');
    expect(alert).toBeTruthy();
    const alertWrapper = alert.closest('.destructive') || alert.closest('[class*="destructive"]');
    expect(alertWrapper).toBeTruthy();
  });

  it('(5) \'Charger plus\' visible tant que items cumulés < total, appelle listAssets page 2 et AJOUTE les items, disparaît quand tout est chargé', async () => {
    const item1 = makeMockAsset('asset-1', 'page1.jpg');
    const item2 = makeMockAsset('asset-2', 'page2.jpg');
    
    vi.mocked(listAssets)
      .mockResolvedValueOnce({ items: [item1], total: 2, page: 1, pageSize: 1 })
      .mockResolvedValueOnce({ items: [item2], total: 2, page: 2, pageSize: 1 });

    render(<AssetPicker label="Média" onChange={vi.fn()} value="" />);
    fireEvent.click(screen.getByText('Sélectionner un média...'));
    
    expect(await screen.findByRole('radio', { name: 'page1.jpg' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'page2.jpg' })).toBeNull();
    
    const loadMore = screen.getByRole('button', { name: 'Charger plus' });
    fireEvent.click(loadMore);
    
    expect(await screen.findByRole('radio', { name: 'page2.jpg' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'page1.jpg' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Charger plus' })).toBeNull();
  });

  it('(6) un re-rendu du parent avec un tableau kinds inline ne relance pas listAssets', async () => {
    vi.mocked(listAssets).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 24 });
    const { rerender } = render(<AssetPicker label="Média" kinds={[AssetKind.IMAGE, AssetKind.VIDEO]} onChange={vi.fn()} value="" />);
    fireEvent.click(screen.getByText('Sélectionner un média...'));
    
    await screen.findByText('Aucun média trouvé.');
    expect(listAssets).toHaveBeenCalledTimes(1);

    rerender(<AssetPicker label="Média" kinds={[AssetKind.IMAGE, AssetKind.VIDEO]} onChange={vi.fn()} value="" />);
    
    expect(listAssets).toHaveBeenCalledTimes(1);
  });

  it('(7) une réponse obsolète est ignorée (deux ouvertures/fermetures ou changement de kind avec promesses résolues dans l\'ordre inverse)', async () => {
    let resolveFirst!: (v: Awaited<ReturnType<typeof listAssets>>) => void;
    let resolveSecond!: (v: Awaited<ReturnType<typeof listAssets>>) => void;

    vi.mocked(listAssets)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const { rerender } = render(<AssetPicker label="Média" kind={AssetKind.PANORAMA} onChange={vi.fn()} value="" />);
    
    fireEvent.click(screen.getByText('Sélectionner un média...'));
    
    // Le changement de prop kind déclenche un re-rendu et refetch (useEffect dans load)
    rerender(<AssetPicker label="Média" kind={AssetKind.IMAGE} onChange={vi.fn()} value="" />);
    
    // On résout la DEUXIÈME promesse d'abord
    resolveSecond({
      items: [makeMockAsset('asset-2', 'second.jpg', AssetKind.IMAGE)], total: 1, page: 1, pageSize: 24
    });

    expect(await screen.findByRole('radio', { name: 'second.jpg' })).toBeTruthy();
    
    // On résout la PREMIÈRE (obsolète)
    resolveFirst({
      items: [makeMockAsset('asset-1', 'first.jpg', AssetKind.PANORAMA)], total: 1, page: 1, pageSize: 24
    });

    // On vérifie que la première réponse est bien ignorée (n'écrase pas la seconde)
    await new Promise(r => setTimeout(r, 100));
    expect(screen.queryByRole('radio', { name: 'first.jpg' })).toBeNull();
  });
});
