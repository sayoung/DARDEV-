import React, { useState, KeyboardEvent, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LocalizedText } from '@xplor/shared';
import './style.css';

interface LocalizedTextFieldProps {
  label: string;
  value: LocalizedText;
  onChange: (value: LocalizedText) => void;
  maxLength?: number;
  multiline?: boolean;
  required?: boolean;
}

type LangTab = 'fr' | 'ar' | 'en';

export function LocalizedTextField({
  label,
  value,
  onChange,
  maxLength,
  multiline,
  required,
}: LocalizedTextFieldProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<LangTab>('fr');
  const idPrefix = useId();
  const tabRefs = useRef<Record<LangTab, HTMLButtonElement | null>>({ fr: null, ar: null, en: null });

  const tabs: LangTab[] = ['fr', 'ar', 'en'];

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = tabs.indexOf(activeTab);
    let nextIndex = currentIndex;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    }

    if (nextIndex !== currentIndex) {
      const nextTab = tabs[nextIndex];
      if (nextTab) {
        setActiveTab(nextTab);
        tabRefs.current[nextTab]?.focus();
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...value,
      [activeTab]: e.target.value,
    });
  };

  return (
    <div className="localized-text-field">
      <div className="label-row">
        <label htmlFor={`${idPrefix}-field-${activeTab}`}>
          {label}
        </label>
        <div role="tablist" className="tab-list">
          {tabs.map((lang) => {
            const isEmpty = !value[lang];
            return (
              <button
                key={lang}
                id={`${idPrefix}-tab-${lang}`}
                ref={(el) => {
                  tabRefs.current[lang] = el;
                }}
                type="button"
                role="tab"
                aria-selected={activeTab === lang}
                tabIndex={activeTab === lang ? 0 : -1}
                onClick={() => { setActiveTab(lang); }}
                onKeyDown={handleKeyDown}
                className={`tab-button ${activeTab === lang ? 'active' : ''}`}
              >
                {t(`catalog.translation.tab.${lang}`)}
                {isEmpty && (
                  <span
                    className="missing-indicator"
                    aria-label={t('catalog.translation.missing')}
                  >
                    {t('catalog.translation.missing')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="input-container">
        {multiline ? (
          <textarea
            id={`${idPrefix}-field-${activeTab}`}
            className="text-input"
            value={value[activeTab] || ''}
            onChange={handleChange}
            maxLength={maxLength}
            lang={activeTab}
            dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
            required={required && activeTab === 'fr'}
          />
        ) : (
          <input
            id={`${idPrefix}-field-${activeTab}`}
            type="text"
            className="text-input"
            value={value[activeTab] || ''}
            onChange={handleChange}
            maxLength={maxLength}
            lang={activeTab}
            dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
            required={required && activeTab === 'fr'}
          />
        )}
      </div>
    </div>
  );
}
