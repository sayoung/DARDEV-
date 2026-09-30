import { useTranslation } from 'react-i18next';

export function CategoriesPage() {
  const { t } = useTranslation();
  return <h2>{t('page.categories.title')}</h2>;
}
