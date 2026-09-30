import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGS, type Lang, type LocalizedText } from '@xplor/shared';

import './style.css';

interface LocalizedTextFieldProps {
  label: string;
  value: LocalizedText;
  onChange: (value: LocalizedText) => void;
  maxLength?: number;
  multiline?: boolean;
  /** Exige une valeur française, quel que soit l’onglet actif. */
  required?: boolean;
}

function isBlank(text: string | undefined): boolean {
  return text === undefined || text.trim() === '';
}

export function LocalizedTextField({
  label,
  value,
  onChange,
  maxLength,
  multiline,
  required,
}: LocalizedTextFieldProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Lang>('fr');
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const valueRef = useRef(value);
  const idPrefix = useId();
  const tabRefs = useRef<Record<Lang, HTMLButtonElement | null>>({
    fr: null,
    ar: null,
    en: null,
  });

  valueRef.current = value;
  const frBlank = isBlank(value.fr);
  const showFrError = required === true && frBlank;
  const errorId = `${idPrefix}-fr-error`;
  const panelId = `${idPrefix}-panel`;
  const labelId = `${idPrefix}-label`;
  const fieldId = `${idPrefix}-field`;

  useEffect(() => {
    if (required !== true) {
      return undefined;
    }
    const form = rootRef.current?.closest('form') ?? null;
    if (form === null) {
      return undefined;
    }
    const blockSubmit = (event: Event): void => {
      if (!isBlank(valueRef.current.fr)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setActiveTab('fr');
      fieldRef.current?.focus();
    };
    form.addEventListener('submit', blockSubmit, true);
    return () => {
      form.removeEventListener('submit', blockSubmit, true);
    };
  }, [required]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const currentIndex = LANGS.indexOf(activeTab);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      nextIndex = (currentIndex + 1) % LANGS.length;
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      nextIndex = (currentIndex - 1 + LANGS.length) % LANGS.length;
    }

    if (nextIndex === currentIndex) {
      return;
    }
    const nextTab = LANGS[nextIndex];
    if (nextTab === undefined) {
      return;
    }
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  const updateLang = (lang: Lang, next: string): void => {
    onChange({
      ...value,
      [lang]: next,
    });
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    updateLang(activeTab, event.target.value);
  };

  const fieldProps = {
    id: fieldId,
    className: 'ltf-input',
    value: value[activeTab] ?? '',
    onChange: handleChange,
    maxLength,
    lang: activeTab,
    dir: activeTab === 'ar' ? 'rtl' : 'ltr',
    'aria-describedby': showFrError ? errorId : undefined,
    'aria-invalid': showFrError && activeTab === 'fr' ? true : undefined,
  } as const;

  return (
    <div className="ltf" ref={rootRef}>
      <div className="ltf-label-row">
        <label id={labelId} className="ltf-label" htmlFor={fieldId}>
          {label}
        </label>
        <div role="tablist" aria-labelledby={labelId} className="ltf-tablist">
          {LANGS.map((lang) => {
            const empty = isBlank(value[lang]);
            const tabId = `${idPrefix}-tab-${lang}`;
            return (
              <button
                key={lang}
                id={tabId}
                ref={(element) => {
                  tabRefs.current[lang] = element;
                }}
                type="button"
                role="tab"
                aria-selected={activeTab === lang}
                aria-controls={panelId}
                aria-required={lang === 'fr' && required === true ? true : undefined}
                aria-invalid={lang === 'fr' && showFrError ? true : undefined}
                tabIndex={activeTab === lang ? 0 : -1}
                onClick={() => {
                  setActiveTab(lang);
                }}
                onKeyDown={handleKeyDown}
                className="ltf-tab"
              >
                {t(`catalog.translation.tab.${lang}`)}
                {lang === 'fr' && required === true ? (
                  <span className="ltf-required">{t('catalog.translation.required')}</span>
                ) : null}
                {empty ? (
                  <span className="ltf-missing">{t('catalog.translation.missing')}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {showFrError ? (
        <p id={errorId} className="ltf-fr-error" role="alert">
          {t('catalog.translation.frRequired')}
        </p>
      ) : null}

      {required === true ? (
        <input
          className="ltf-fr-guard"
          value={value.fr}
          onChange={(event) => {
            updateLang('fr', event.target.value);
          }}
          onInvalid={(event) => {
            event.preventDefault();
            setActiveTab('fr');
            fieldRef.current?.focus();
          }}
          required
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
        />
      ) : null}

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={`${idPrefix}-tab-${activeTab}`}
        className="ltf-panel"
      >
        {multiline ? (
          <textarea
            ref={(element) => {
              fieldRef.current = element;
            }}
            {...fieldProps}
          />
        ) : (
          <input
            ref={(element) => {
              fieldRef.current = element;
            }}
            type="text"
            {...fieldProps}
          />
        )}
      </div>
    </div>
  );
}
