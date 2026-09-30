import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { LocalizedTextField } from './LocalizedTextField';

afterEach(() => {
  cleanup();
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('LocalizedTextField', () => {
  it('renders correctly and changes tabs', () => {
    const onChange = vi.fn();
    render(
      <LocalizedTextField
        label="Title"
        value={{ fr: 'Bonjour' }}
        onChange={onChange}
      />
    );

    // Initial state
    const input = screen.getByRole<HTMLInputElement>('textbox');
    expect(input.getAttribute('lang')).toBe('fr');
    expect(input.getAttribute('dir')).toBe('ltr');
    expect(input.value).toBe('Bonjour');

    // Tab 'ar' should have missing translation
    const arTab = screen.getByRole('tab', { name: /catalog.translation.tab.ar/ });
    expect(arTab.getAttribute('aria-selected')).toBe('false');
    
    // There should be two missing indicators (ar, en)
    const missingIndicators = screen.getAllByLabelText('catalog.translation.missing');
    expect(missingIndicators).toHaveLength(2);

    // Click 'ar' tab
    fireEvent.click(arTab);
    expect(arTab.getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('lang')).toBe('ar');
    expect(input.getAttribute('dir')).toBe('rtl');
    expect(input.value).toBe('');

    // Type in 'ar' input
    fireEvent.change(input, { target: { value: 'مرحبا' } });
    expect(onChange).toHaveBeenCalledWith({ fr: 'Bonjour', ar: 'مرحبا' });
  });

  it('removes missing indicator after input', () => {
    const { rerender } = render(
      <LocalizedTextField
        label="Title"
        value={{ fr: 'Bonjour' }}
        onChange={() => {}}
      />
    );

    expect(screen.getAllByLabelText('catalog.translation.missing')).toHaveLength(2);

    rerender(
      <LocalizedTextField
        label="Title"
        value={{ fr: 'Bonjour', ar: 'مرحبا' }}
        onChange={() => {}}
      />
    );

    expect(screen.getAllByLabelText('catalog.translation.missing')).toHaveLength(1);
  });

  it('navigates tabs with keyboard', () => {
    render(
      <LocalizedTextField
        label="Title"
        value={{ fr: 'Bonjour' }}
        onChange={() => {}}
      />
    );

    const frTab = screen.getByRole('tab', { name: /catalog.translation.tab.fr/ });
    const arTab = screen.getByRole('tab', { name: /catalog.translation.tab.ar/ });
    
    fireEvent.keyDown(frTab, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(arTab);
    
    fireEvent.keyDown(arTab, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(frTab);
  });
});
