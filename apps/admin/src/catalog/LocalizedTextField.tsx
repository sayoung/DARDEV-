import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGS, type Lang, type LocalizedText } from '@xplor/shared';
import { Badge } from '../components/ui/Badge.js';
import { Input } from '../components/ui/Input.js';
import { Textarea } from '../components/ui/Textarea.js';
import { Label } from '../components/ui/Label.js';

interface LocalizedTextFieldProps {
  label: string;
  value: LocalizedText;
  onChange: (value: LocalizedText) => void;
  maxLength?: number;
  multiline?: boolean;
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
    value: value[activeTab] ?? '',
    onChange: handleChange,
    maxLength,
    lang: activeTab,
    dir: activeTab === 'ar' ? 'rtl' : 'ltr',
    'aria-describedby': showFrError ? errorId : undefined,
    'aria-invalid': showFrError && activeTab === 'fr' ? true : undefined,
  } as const;

  return (
    <div className="space-y-4" ref={rootRef}>
      <div className="flex flex-col gap-2">
        <Label id={labelId} htmlFor={fieldId}>
          {label}
        </Label>
        <div role="tablist" aria-labelledby={labelId} className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground max-w-fit">
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
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${activeTab === lang ? 'bg-card text-foreground shadow-sm' : 'hover:bg-accent hover:text-foreground'}`}
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
              >
                {t(`catalog.translation.tab.${lang}`)}
                {lang === 'fr' && required === true ? (
                  <span className="ms-1 text-destructive">{t('catalog.translation.required')}</span>
                ) : null}
                {empty ? (
                  <Badge variant="secondary" className="ms-2 text-[10px] leading-none px-1 py-0.5 font-normal h-4">
                    {t('catalog.translation.missing')}
                  </Badge>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {showFrError ? (
        <p id={errorId} className="text-[0.8rem] font-medium text-destructive" role="alert">
          {t('catalog.translation.frRequired')}
        </p>
      ) : null}

      {required === true ? (
        <Input
          className="sr-only pointer-events-none"
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
        className="mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {multiline ? (
          <Textarea
            ref={(element: HTMLTextAreaElement) => {
              fieldRef.current = element;
            }}
            {...fieldProps}
          />
        ) : (
          <Input
            ref={(element: HTMLInputElement) => {
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
