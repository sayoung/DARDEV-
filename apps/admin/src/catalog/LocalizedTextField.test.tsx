import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { LocalizedText } from '@xplor/shared';
import { useState, type SubmitEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../i18n.js';
import { LocalizedTextField } from './LocalizedTextField.js';

function IndicatorHarness() {
  const [value, setValue] = useState<LocalizedText>({ fr: 'Bonjour' });
  return <LocalizedTextField label="Titre" value={value} onChange={setValue} />;
}

describe('LocalizedTextField', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr');
  });

  afterEach(() => {
    cleanup();
  });

  it('change d’onglet, pose dir=rtl sur l’arabe et ne modifie que la langue active', () => {
    const onChange = vi.fn();
    render(<LocalizedTextField label="Titre" value={{ fr: 'Bonjour' }} onChange={onChange} />);

    const tablist = screen.getByRole('tablist', { name: 'Titre' });
    const frTab = screen.getByRole('tab', { name: /Français/ });
    const arTab = screen.getByRole('tab', { name: /Arabe/ });
    const panel = screen.getByRole('tabpanel');
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Titre' });

    expect(tablist.getAttribute('aria-labelledby')).toBeTruthy();
    expect(frTab.getAttribute('aria-controls')).toBe(panel.id);
    expect(arTab.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(frTab.id);
    expect(input.getAttribute('lang')).toBe('fr');
    expect(input.getAttribute('dir')).toBe('ltr');
    expect(input.value).toBe('Bonjour');
    expect(screen.getAllByText('Traduction manquante')).toHaveLength(2);

    fireEvent.click(arTab);
    expect(arTab.getAttribute('aria-selected')).toBe('true');
    expect(panel.getAttribute('aria-labelledby')).toBe(arTab.id);
    expect(input.getAttribute('lang')).toBe('ar');
    expect(input.getAttribute('dir')).toBe('rtl');
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { value: 'مرحبا' } });
    expect(onChange).toHaveBeenCalledWith({ fr: 'Bonjour', ar: 'مرحبا' });
  });

  it('retire l’indicateur de traduction manquante après une saisie', () => {
    render(<IndicatorHarness />);

    expect(screen.getAllByText('Traduction manquante')).toHaveLength(2);

    fireEvent.click(screen.getByRole('tab', { name: /Arabe/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Titre' }), {
      target: { value: 'مرحبا' },
    });

    const arTab = screen.getByRole('tab', { name: /Arabe/ });
    expect(screen.getAllByText('Traduction manquante')).toHaveLength(1);
    expect(arTab.textContent.includes('Traduction manquante')).toBe(false);
  });

  it('passe d’un onglet à l’autre avec les flèches', () => {
    render(<LocalizedTextField label="Titre" value={{ fr: 'Bonjour' }} onChange={() => {}} />);

    const frTab = screen.getByRole('tab', { name: /Français/ });
    const arTab = screen.getByRole('tab', { name: /Arabe/ });

    fireEvent.keyDown(frTab, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(arTab);
    expect(arTab.getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(arTab, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(frTab);
    expect(frTab.getAttribute('aria-selected')).toBe('true');
  });

  it('exige le français même lorsque l’onglet arabe est actif', () => {
    const onSubmit = vi.fn((event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <LocalizedTextField
          label="Titre"
          required
          value={{ fr: '', ar: 'مرحبا' }}
          onChange={() => {}}
        />
        <button type="submit">Envoyer</button>
      </form>,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Arabe/ }));

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Titre' });
    const frTab = screen.getByRole('tab', { name: /Français/ });
    expect(screen.getByRole('tab', { name: /Arabe/ }).getAttribute('aria-selected')).toBe('true');
    expect(frTab.getAttribute('aria-selected')).toBe('false');
    expect(frTab.getAttribute('aria-required')).toBe('true');
    expect(input.getAttribute('lang')).toBe('ar');
    expect(input.getAttribute('dir')).toBe('rtl');
    expect(input.value).toBe('مرحبا');
    expect(input.hasAttribute('required')).toBe(false);
    expect(screen.getByText('obligatoire')).toBeTruthy();
    expect(screen.getByText('Le français est obligatoire.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
