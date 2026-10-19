import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HotspotType, HotspotIcon, type HotspotResponse, type SceneResponse } from '@xplor/shared';

import { i18n } from '../i18n.js';
import { HotspotForm } from './HotspotForm.js';

const dummyScene: SceneResponse = {
  id: '018f3a2b-0001-7000-8000-000000000001',
  tourId: '018f3a2b-0001-7000-8000-000000000002',
  title: { fr: 'Scène cible' },
  panoramaAssetId: '018f3a2b-0001-7000-8000-000000000003',
  initialYaw: 0,
  initialPitch: 0,
  initialZoom: 50,
  weight: 0,
  hotspotCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const initialData: HotspotResponse = {
  id: '018f3a2b-0001-7000-8000-000000000010',
  sceneId: '018f3a2b-0001-7000-8000-000000000001',
  type: HotspotType.SCENE_LINK,
  yaw: 1.45,
  pitch: -0.35,
  arrivalYaw: 2.12,
  label: { fr: 'Hotspot existant' },
  icon: HotspotIcon.ARROW,
  targetSceneId: '018f3a2b-0001-7000-8000-000000000001',
  targetTourId: null,
  targetTourSceneId: null,
  body: { fr: '' },
  mediaAssetIds: [],
  url: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('HotspotForm', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr');
  });

  afterEach(() => {
    cleanup();
  });

  it('aucun champ yaw/pitch/arrivalYaw visible (queryByLabelText nul)', () => {
    const { container } = render(
      <HotspotForm
        defaultPosition={{ yaw: 1.2, pitch: -0.3 }}
        currentTourScenes={[dummyScene]}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />
    );

    expect(screen.queryByLabelText(/yaw/i)).toBeNull();
    expect(screen.queryByLabelText(/pitch/i)).toBeNull();
    expect(screen.queryByLabelText(/arrival/i)).toBeNull();
    expect(screen.queryByLabelText('Lacet (yaw)')).toBeNull();
    expect(screen.queryByLabelText('Tangage (pitch)')).toBeNull();
    expect(screen.queryByLabelText("Lacet d'arrivée")).toBeNull();
    expect(container.querySelector('#yaw')).toBeNull();
    expect(container.querySelector('#pitch')).toBeNull();
    expect(container.querySelector('#arrivalYaw')).toBeNull();
  });

  it('une création avec defaultPosition envoie bien cette position', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const defaultPosition = { yaw: 1.2, pitch: -0.3 };

    render(
      <HotspotForm
        defaultPosition={defaultPosition}
        currentTourScenes={[dummyScene]}
        onSubmit={onSubmit}
        isSubmitting={false}
      />
    );

    const labelInput = document.querySelector<HTMLInputElement>('input[lang="fr"]');
    if (labelInput) {
      fireEvent.change(labelInput, { target: { value: 'Vers la scène cible' } });
    }

    const targetSceneSelect = document.querySelector<HTMLSelectElement>('#targetSceneId');
    if (targetSceneSelect) {
      fireEvent.change(targetSceneSelect, { target: { value: dummyScene.id } });
    }

    const form = document.querySelector<HTMLFormElement>('form');
    if (form) {
      fireEvent.submit(form);
    }

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: HotspotType.SCENE_LINK,
        yaw: 1.2,
        pitch: -0.3,
        targetSceneId: dummyScene.id,
        label: { fr: 'Vers la scène cible' },
      })
    );
  });

  it('une modification d\'un hotspot existant conserve yaw, pitch, arrivalYaw non nuls dans l\'objet passé à onSubmit', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <HotspotForm
        initialData={initialData}
        currentTourScenes={[dummyScene]}
        onSubmit={onSubmit}
        isSubmitting={false}
      />
    );

    const labelInput = document.querySelector<HTMLInputElement>('input[lang="fr"]');
    if (labelInput) {
      fireEvent.change(labelInput, { target: { value: 'Hotspot modifié' } });
    }

    const form = document.querySelector<HTMLFormElement>('form');
    if (form) {
      fireEvent.submit(form);
    }

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: HotspotType.SCENE_LINK,
        yaw: 1.45,
        pitch: -0.35,
        arrivalYaw: 2.12,
        label: { fr: 'Hotspot modifié' },
        targetSceneId: dummyScene.id,
      })
    );
  });

  it('appelle onCancel lors du clic sur Annuler', () => {
    const onCancel = vi.fn();
    render(
      <HotspotForm
        currentTourScenes={[]}
        onSubmit={vi.fn()}
        onCancel={onCancel}
        isSubmitting={false}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: 'Annuler' });
    fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
