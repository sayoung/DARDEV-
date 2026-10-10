import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { AssetPicker } from './AssetPicker.js';
import { listAssets, getAsset } from '../api/catalog.js';
import { AssetKind, ProcessingStatus, type AssetResponse } from '@xplor/shared';
import { i18n } from '../i18n.js';

vi.mock('../api/catalog.js', () => ({
  listAssets: vi.fn(),
  getAsset: vi.fn(),
}));

describe('AssetPicker', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('fr');
  });

  afterEach(() => {
    vi.useRealTimers();
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
    createdAt: new Date('2026-10-10T12:00:00Z').toISOString(),
  });

  it('(1) aperçu fermé avec nom + type du média sélectionné, bouton « Sélectionner » sans valeur / « Modifier » avec valeur', async () => {
    vi.mocked(getAsset).mockResolvedValueOnce(makeMockAsset('val1', 'mon-fichier.jpg', AssetKind.IMAGE));

    const { rerender } = render(<AssetPicker label="Média" onChange={vi.fn()} value="" />);
    expect(screen.getByText('Sélectionner un média...')).toBeTruthy();

    rerender(<AssetPicker label="Média" onChange={vi.fn()} value="val1" />);

    expect(await screen.findByText('mon-fichier.jpg')).toBeTruthy();
    expect(screen.getByText('Image')).toBeTruthy();
    expect(screen.getByText('Modifier')).toBeTruthy();
    expect(getAsset).toHaveBeenCalledWith('val1');
  });

  it('(2) ouverture : listAssets appelé avec status: READY, pageSize: 24, page: 1', () => {
    vi.mocked(listAssets).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 24 });
    const { unmount } = render(<AssetPicker label="Média" kind={AssetKind.PANORAMA} onChange={vi.fn()} value="" />);

    fireEvent.click(screen.getByText('Sélectionner un média...'));

    expect(listAssets).toHaveBeenCalledWith({ kind: AssetKind.PANORAMA, status: ProcessingStatus.READY, page: 1, pageSize: 24 });

    unmount();
    vi.mocked(listAssets).mockClear();

    render(<AssetPicker label="Média" kinds={[AssetKind.IMAGE, AssetKind.VIDEO]} onChange={vi.fn()} value="" />);
    fireEvent.click(screen.getByText('Sélectionner un média...'));

    expect(listAssets).toHaveBeenCalledWith({ kinds: [AssetKind.IMAGE, AssetKind.VIDEO], status: ProcessingStatus.READY, page: 1, pageSize: 24 });
  });

  it('(3) pagination : "Charger plus" ajoute la page 2 et disparaît quand tous les éléments sont chargés', async () => {
    const item1 = makeMockAsset('asset-1', 'page1.jpg');
    const item2 = makeMockAsset('asset-2', 'page2.jpg');

    vi.mocked(listAssets)
      .mockResolvedValueOnce({ items: [item1], total: 2, page: 1, pageSize: 1 })
      .mockResolvedValueOnce({ items: [item2], total: 2, page: 2, pageSize: 1 });

    render(<AssetPicker label="Média" onChange={vi.fn()} value="" />);
    fireEvent.click(screen.getByText('Sélectionner un média...'));

    expect(await screen.findByRole('radio', { name: 'page1.jpg' })).toBeTruthy();

    const loadMore = screen.getByRole('button', { name: 'Charger plus' });
    fireEvent.click(loadMore);

    expect(listAssets).toHaveBeenNthCalledWith(2, { status: ProcessingStatus.READY, page: 2, pageSize: 24 });

    expect(await screen.findByRole('radio', { name: 'page2.jpg' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'page1.jpg' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Charger plus' })).toBeNull();
  });

  it('(4) recherche : appel avec q après debounce, liste réinitialisée', async () => {
    vi.useFakeTimers();
    const item1 = makeMockAsset('a1', 'fichier1.jpg');
    const item2 = makeMockAsset('a2', 'test.jpg');

    vi.mocked(listAssets).mockResolvedValueOnce({ items: [item1], total: 1, page: 1, pageSize: 24 });

    render(<AssetPicker label="Média" onChange={vi.fn()} value="" />);
    fireEvent.click(screen.getByText('Sélectionner un média...'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(listAssets).toHaveBeenCalledWith({ status: ProcessingStatus.READY, page: 1, pageSize: 24 });
    expect(screen.getByRole('radio', { name: 'fichier1.jpg' })).toBeTruthy();

    vi.mocked(listAssets).mockClear();
    vi.mocked(listAssets).mockResolvedValueOnce({ items: [item2], total: 1, page: 1, pageSize: 24 });

    const searchInput = screen.getByPlaceholderText('Rechercher par nom...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    expect(listAssets).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(listAssets).toHaveBeenCalledWith({ q: 'test', status: ProcessingStatus.READY, page: 1, pageSize: 24 });
    expect(screen.queryByRole('radio', { name: 'fichier1.jpg' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'test.jpg' })).toBeTruthy();
  });

  it('(5) filtre de type : Select présent avec plusieurs types, absent avec un seul, changement de type refait la requête', async () => {
    vi.mocked(listAssets).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 24 });

    const { unmount } = render(<AssetPicker label="Média" kinds={[AssetKind.IMAGE, AssetKind.VIDEO, AssetKind.PANORAMA]} onChange={vi.fn()} value="" />);
    fireEvent.click(screen.getByText('Sélectionner un média...'));

    await act(async () => {
      await Promise.resolve();
    });
    vi.mocked(listAssets).mockClear();

    const select = screen.getByRole('combobox', { name: 'Filtrer par type' });
    expect(select).toBeTruthy();

    fireEvent.change(select, { target: { value: AssetKind.IMAGE } });

    await act(async () => {
      await Promise.resolve();
    });
    expect(listAssets).toHaveBeenCalledWith({ kind: AssetKind.IMAGE, status: ProcessingStatus.READY, page: 1, pageSize: 24 });
    vi.mocked(listAssets).mockClear();

    fireEvent.change(select, { target: { value: 'all' } });
    
    await act(async () => {
      await Promise.resolve();
    });
    expect(listAssets).toHaveBeenCalledWith({ kinds: [AssetKind.IMAGE, AssetKind.VIDEO, AssetKind.PANORAMA], status: ProcessingStatus.READY, page: 1, pageSize: 24 });
    vi.mocked(listAssets).mockClear();

    fireEvent.change(select, { target: { value: AssetKind.VIDEO } });
    
    await act(async () => {
      await Promise.resolve();
    });
    expect(listAssets).toHaveBeenCalledWith({ kind: AssetKind.VIDEO, status: ProcessingStatus.READY, page: 1, pageSize: 24 });

    unmount();

    render(<AssetPicker label="Média" kind={AssetKind.IMAGE} onChange={vi.fn()} value="" />);
    fireEvent.click(screen.getByText('Sélectionner un média...'));

    expect(screen.queryByRole('combobox', { name: 'Filtrer par type' })).toBeNull();
  });

  it('(6) sélection : clic sur un radio appelle onChange(id) et ferme la fenêtre', async () => {
    vi.mocked(listAssets).mockResolvedValueOnce({
      items: [makeMockAsset('asset-1', 'asset1.jpg')], total: 1, page: 1, pageSize: 24
    });

    const onChange = vi.fn();
    render(<AssetPicker label="Média" onChange={onChange} value="" />);
    fireEvent.click(screen.getByText('Sélectionner un média...'));

    const radio = await screen.findByRole('radio', { name: 'asset1.jpg' });
    fireEvent.click(radio);

    expect(onChange).toHaveBeenCalledWith('asset-1');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('(7) états erreur et vide', async () => {
    vi.mocked(listAssets).mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 24 });
    const { unmount } = render(<AssetPicker label="Média" onChange={vi.fn()} value="" />);
    fireEvent.click(screen.getByText('Sélectionner un média...'));

    expect(await screen.findByText('Aucun média trouvé.')).toBeTruthy();
    unmount();

    vi.mocked(listAssets).mockRejectedValueOnce(new Error('Erreur API'));
    render(<AssetPicker label="Média" onChange={vi.fn()} value="" />);
    fireEvent.click(screen.getByText('Sélectionner un média...'));

    expect(await screen.findByText('Impossible de charger les médias.')).toBeTruthy();
  });

  it('(8) ignore les requêtes obsolètes en cas de concurrence', async () => {
    vi.useFakeTimers();

    type ListAssetsResponse = { items: AssetResponse[], total: number, page: number, pageSize: number };
    
    let resolveFirst: (val: ListAssetsResponse) => void = () => {};
    const p1 = new Promise<ListAssetsResponse>((resolve) => { resolveFirst = resolve; });
    let resolveSecond: (val: ListAssetsResponse) => void = () => {};
    const p2 = new Promise<ListAssetsResponse>((resolve) => { resolveSecond = resolve; });

    vi.mocked(listAssets)
      .mockReturnValueOnce(p1)
      .mockReturnValueOnce(p2);

    render(<AssetPicker label="Média" kinds={[AssetKind.IMAGE, AssetKind.VIDEO]} onChange={vi.fn()} value="" />);

    fireEvent.click(screen.getByText('Sélectionner un média...'));

    const select = screen.getByRole('combobox', { name: 'Filtrer par type' });
    fireEvent.change(select, { target: { value: AssetKind.IMAGE } });

    resolveSecond({ items: [makeMockAsset('asset-2', 'second.jpg', AssetKind.IMAGE)], total: 1, page: 1, pageSize: 24 });

    await act(async () => {
      await p2;
    });

    expect(screen.getByRole('radio', { name: 'second.jpg' })).toBeTruthy();

    resolveFirst({ items: [makeMockAsset('asset-1', 'first.jpg', AssetKind.VIDEO)], total: 1, page: 1, pageSize: 24 });

    await act(async () => {
      await p1;
    });

    expect(screen.queryByRole('radio', { name: 'first.jpg' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'second.jpg' })).toBeTruthy();
  });
});
