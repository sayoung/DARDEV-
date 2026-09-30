import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CategoryCreateSchema,
  localize,
  Role,
  type LocalizedText,
  type CategoryResponse
} from '@xplor/shared';
import { useAuth } from '../auth/AuthProvider.js';
import { listCategories, createCategory, updateCategory, deleteCategory } from '../api/catalog.js';
import { LocalizedTextField } from '../catalog/LocalizedTextField.js';
import { ApiError } from '../api/client.js';

export function CategoriesPage() {
  const { t, i18n } = useTranslation();
  const { state } = useAuth();
  const user = state.status === 'authenticated' ? state.profile : null;
  const canWrite = user?.role === Role.ADMIN || user?.role === Role.EDITOR;

  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState<LocalizedText>({ fr: '' });
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('#000000');
  const [weight, setWeight] = useState<number | ''>(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const data = await listCategories();
      setCategories(data);
    } catch {
      setFetchError(t('catalog.errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setName({ fr: '' });
    setIcon('');
    setColor('#000000');
    setWeight(0);
    setFormError(null);
  }

  function handleEdit(category: CategoryResponse) {
    setEditingId(category.id);
    setName({ fr: category.name.fr, ar: category.name.ar, en: category.name.en });
    setIcon(category.icon);
    setColor(category.color);
    setWeight(category.weight);
    setFormError(null);
  }

  async function handleDelete(category: CategoryResponse) {
    if (!window.confirm(t('catalog.category.deleteConfirm'))) {
      return;
    }
    try {
      await deleteCategory(category.id);
      await fetchCategories();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        alert(t('catalog.errors.inUse'));
      } else {
        alert(t('catalog.errors.generic'));
      }
    }
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setFormError(null);

    const payload = {
      name,
      icon,
      color,
      weight: typeof weight === 'string' ? parseInt(weight, 10) : weight,
    };

    const parsed = CategoryCreateSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError(t('catalog.errors.invalidForm'));
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateCategory(editingId, parsed.data);
      } else {
        await createCategory(parsed.data);
      }
      resetForm();
      await fetchCategories();
    } catch {
      setFormError(t('catalog.errors.generic'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-categories">
      <h2>{t('page.categories.title')}</h2>

      {fetchError && <p className="error" role="alert">{fetchError}</p>}
      
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('catalog.category.name')}</th>
              <th>{t('catalog.category.icon')}</th>
              <th>{t('catalog.category.color')}</th>
              <th>{t('catalog.category.weight')}</th>
              {canWrite && <th>{t('catalog.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td>
                  {localize(category.name, i18n.language)}
                  {!category.name[i18n.language as keyof typeof category.name] && i18n.language !== 'fr' && (
                    <span className="missing-translation" title={t('catalog.translation.missing')}> ⚠️</span>
                  )}
                </td>
                <td>{category.icon}</td>
                <td>
                  <div style={{ width: '20px', height: '20px', backgroundColor: category.color }} />
                  {category.color}
                </td>
                <td>{category.weight}</td>
                {canWrite && (
                  <td>
                    <button type="button" onClick={() => { handleEdit(category); }}>{t('catalog.edit')}</button>
                    <button type="button" onClick={() => { void handleDelete(category); }}>{t('catalog.delete')}</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canWrite && (
        <form onSubmit={(e) => { void handleSubmit(e); }} className="category-form">
          <h3>{editingId ? t('catalog.category.editTitle') : t('catalog.category.createTitle')}</h3>
          
          {formError && <p className="error" role="alert">{formError}</p>}
          
          <LocalizedTextField
            label={t('catalog.category.name')}
            value={name}
            onChange={setName}
            required
          />
          
          <div>
            <label htmlFor="icon">{t('catalog.category.icon')}</label>
            <input
              id="icon"
              value={icon}
              onChange={(e) => { setIcon(e.target.value); }}
              required
            />
          </div>
          
          <div>
            <label htmlFor="color">{t('catalog.category.color')}</label>
            <input
              id="color"
              type="color"
              value={color}
              onChange={(e) => { setColor(e.target.value); }}
              required
            />
          </div>
          
          <div>
            <label htmlFor="weight">{t('catalog.category.weight')}</label>
            <input
              id="weight"
              type="number"
              step="1"
              value={weight}
              onChange={(e) => { setWeight(e.target.value === '' ? '' : parseInt(e.target.value, 10)); }}
              required
            />
          </div>
          
          <button type="submit" disabled={saving}>
            {saving ? t('catalog.saving') : t('catalog.save')}
          </button>
          
          {editingId && (
            <button type="button" onClick={resetForm} disabled={saving}>
              {t('catalog.cancel')}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
