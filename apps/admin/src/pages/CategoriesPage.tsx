import { useEffect, useState, useRef } from 'react';
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
import { PageHeader } from '../components/PageHeader.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Alert } from '../components/ui/Alert.js';
import { Input } from '../components/ui/Input.js';
import { Label } from '../components/ui/Label.js';

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
  const [weight, setWeight] = useState('0');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    void fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      setFetchError(null);
      const data = await listCategories();
      setCategories(data);
    } catch {
      setFetchError(t('catalog.errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setName({ fr: '' });
    setIcon('');
    setColor('#000000');
    setWeight('0');
    setFormError(null);
  }

  function handleEdit(category: CategoryResponse) {
    setEditingId(category.id);
    setName({ fr: category.name.fr, ar: category.name.ar, en: category.name.en });
    setIcon(category.icon);
    setColor(category.color);
    setWeight(String(category.weight));
    setFormError(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleDelete(category: CategoryResponse) {
    if (!window.confirm(t('catalog.category.deleteConfirm'))) {
      return;
    }
    setFetchError(null);
    try {
      await deleteCategory(category.id);
      await fetchCategories();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'IN_USE') {
        setFetchError(t('catalog.errors.inUse'));
      } else {
        setFetchError(t('catalog.errors.deleteFailed'));
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
      weight: weight === '' ? weight : Number(weight),
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
    <div className="page-categories space-y-8">
      <PageHeader
        title={t('page.categories.title')}
        actions={
          canWrite && (
            <Button onClick={() => { formRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>
              {t('catalog.category.createTitle')}
            </Button>
          )
        }
      />

      {fetchError && <Alert variant="destructive" role="alert">{fetchError}</Alert>}
      
      {loading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('catalog.category.name')}</TableHead>
              <TableHead>{t('catalog.category.icon')}</TableHead>
              <TableHead>{t('catalog.category.color')}</TableHead>
              <TableHead>{t('catalog.category.weight')}</TableHead>
              {canWrite && <TableHead>{t('catalog.actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => {
              const baseLang = i18n.language.split('-')[0];
              const isMissingTranslation = !category.name[baseLang as keyof typeof category.name] && baseLang !== 'fr';
              return (
                <TableRow key={category.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{localize(category.name, i18n.language)}</span>
                      {isMissingTranslation && (
                        <Badge variant="destructive">{t('catalog.translation.missing')}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{category.icon}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="rounded border border-gray-200" style={{ width: '20px', height: '20px', backgroundColor: category.color }} />
                      {category.color}
                    </div>
                  </TableCell>
                  <TableCell>{category.weight}</TableCell>
                  {canWrite && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { handleEdit(category); }}>{t('catalog.edit')}</Button>
                        <Button variant="destructive" size="sm" onClick={() => { void handleDelete(category); }}>{t('catalog.delete')}</Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {canWrite && (
        <form ref={formRef} onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4 max-w-xl">
          <h3 className="text-xl font-semibold">{editingId ? t('catalog.category.editTitle') : t('catalog.category.createTitle')}</h3>
          
          {formError && <Alert variant="destructive" role="alert">{formError}</Alert>}
          
          <LocalizedTextField
            label={t('catalog.category.name')}
            value={name}
            onChange={setName}
            required
          />
          
          <div className="space-y-2">
            <Label htmlFor="icon">{t('catalog.category.icon')}</Label>
            <Input
              id="icon"
              value={icon}
              onChange={(e) => { setIcon(e.target.value); }}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="color">{t('catalog.category.color')}</Label>
            <Input
              id="color"
              type="color"
              className="h-10 w-24 p-1"
              value={color}
              onChange={(e) => { setColor(e.target.value); }}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="weight">{t('catalog.category.weight')}</Label>
            <Input
              id="weight"
              inputMode="decimal"
              value={weight}
              onChange={(e) => { setWeight(e.target.value); }}
            />
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? t('catalog.saving') : t('catalog.save')}
            </Button>
            
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                {t('catalog.cancel')}
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
