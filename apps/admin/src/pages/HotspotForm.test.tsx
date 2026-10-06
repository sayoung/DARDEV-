import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../i18n.js';
import { HotspotForm } from './HotspotForm.js';

describe('HotspotForm', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr');
  });

  afterEach(() => {
    cleanup();
  });

  it('affiche les valeurs defaultPosition quand initialData est absent', () => {
    const defaultPosition = { yaw: 1.2, pitch: -0.3 };
    render(
      <HotspotForm 
        defaultPosition={defaultPosition} 
        currentTourScenes={[]} 
        onSubmit={vi.fn()} 
        isSubmitting={false} 
      />
    );

    const yawInput = screen.getByLabelText('Lacet (yaw)');
    const pitchInput = screen.getByLabelText('Tangage (pitch)');

    expect(yawInput).toHaveProperty('value', '1.2');
    expect(pitchInput).toHaveProperty('value', '-0.3');
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
