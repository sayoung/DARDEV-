import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createLangSwitcher } from './lang-switcher.js';

describe('createLangSwitcher', () => {
  let doc: Document;
  let mockOnChange: Mock<(lang: 'fr' | 'ar' | 'en') => void>;
  let destroySwitcher: (() => void) | undefined;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument();
    mockOnChange = vi.fn();
    destroySwitcher = undefined;
  });

  afterEach(() => {
    if (destroySwitcher !== undefined) destroySwitcher();
  });

  it('creates a select element with all languages', () => {
    const switcher = createLangSwitcher(doc, 'fr', 'Changer la langue', mockOnChange);
    destroySwitcher = () => { switcher.destroy(); };

    const select = doc.getElementById('lang-switcher') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.getAttribute('aria-label')).toBe('Changer la langue');

    const options = select.querySelectorAll('option');
    expect(options.length).toBe(3);
    
    const optFr = options[0];
    const optAr = options[1];
    const optEn = options[2];
    
    if (!optFr || !optAr || !optEn) throw new Error('Options missing');

    expect(optFr.value).toBe('fr');
    expect(optFr.textContent).toBe('Français');
    expect(optFr.selected).toBe(true);

    expect(optAr.value).toBe('ar');
    expect(optAr.textContent).toBe('العربية');
    expect(optAr.selected).toBe(false);

    expect(optEn.value).toBe('en');
    expect(optEn.textContent).toBe('English');
    expect(optEn.selected).toBe(false);
  });

  it('calls onChange with the selected language', () => {
    const switcher = createLangSwitcher(doc, 'fr', 'Langue', mockOnChange);
    destroySwitcher = () => { switcher.destroy(); };

    const select = doc.getElementById('lang-switcher') as HTMLSelectElement;
    
    select.value = 'ar';
    select.dispatchEvent(new Event('change'));

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith('ar');
  });

  it('removes the element when destroy is called', () => {
    const switcher = createLangSwitcher(doc, 'fr', 'Langue', mockOnChange);
    
    const select = doc.getElementById('lang-switcher');
    expect(select).not.toBeNull();
    expect(doc.body.contains(select)).toBe(true);

    switcher.destroy();
    
    expect(doc.getElementById('lang-switcher')).toBeNull();
  });
});
