import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localize, type SelectionResponse, type SelectionUpdate, type TourResponse } from '@xplor/shared';
import { getHotelSelection, saveHotelSelection } from '../api/hotels.js';
import { getTour } from '../api/catalog.js';
import { Alert } from '../components/ui/Alert.js';
import { Button } from '../components/ui/Button.js';
import { Label } from '../components/ui/Label.js';
import { PageHeader } from '../components/PageHeader.js';
import { fromResponse, moveTour, removeTour, setFeatured, toggleAttract } from './selectionDraft.js';

type LoadedTour = Pick<TourResponse, 'id' | 'title'>;

export function SelectionPage({ hotelId }: { hotelId: string }) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<SelectionUpdate | null>(null);
  const [tourTitles, setTourTitles] = useState<Record<string, LoadedTour>>({});
  const [version, setVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setError(null);
        const response = await getHotelSelection(hotelId);
        const nextDraft = fromResponse(response);
        const tours = await Promise.all(nextDraft.tourIds.map((id) => getTour(id)));
        if (!active) return;
        setDraft(nextDraft);
        setVersion(response.version);
        setTourTitles(Object.fromEntries(tours.map((tour) => [tour.id, { id: tour.id, title: tour.title }])));
      } catch {
        if (active) setError(t('page.hotelSelection.loadError'));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [hotelId, t]);

  async function save() {
    if (draft === null || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response: SelectionResponse = await saveHotelSelection(hotelId, draft);
      setDraft(fromResponse(response));
      setVersion(response.version);
      setSaved(true);
    } catch {
      setError(t('page.hotelSelection.error'));
    } finally {
      setSaving(false);
    }
  }

  const orderedTours = draft?.tourIds.map((id) => tourTitles[id]).filter((tour): tour is LoadedTour => tour !== undefined) ?? [];

  return (
    <div className="space-y-8">
      <PageHeader title={t('page.hotelSelection.title')} />
      {version !== null ? <p className="text-sm text-muted-foreground">{t('page.hotelSelection.version', { version })}</p> : null}
      {error !== null ? <Alert variant="destructive" role="alert">{error}</Alert> : null}
      {saved ? <Alert role="status">{t('page.hotelSelection.saved')}</Alert> : null}
      {loading ? <p role="status" className="text-muted-foreground">{t('common.loading')}</p> : null}
      {!loading && draft !== null ? (
        <>
          <section className="space-y-4" aria-labelledby="selection-tours-heading">
            <h2 id="selection-tours-heading" className="text-lg font-semibold">{t('page.hotelSelection.selectedTours')}</h2>
            {orderedTours.length === 0 ? <p className="text-muted-foreground">{t('page.hotelSelection.empty')}</p> : null}
            <ol aria-labelledby="selection-tours-heading" className="space-y-3">
              {orderedTours.map((tour, index) => (
                <li key={tour.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
                  <span className="min-w-40 flex-1 font-medium">{localize(tour.title, i18n.language)}</span>
                  <Button type="button" variant="outline" size="sm" disabled={index === 0} aria-label={`${t('page.hotelSelection.moveUp')} ${localize(tour.title, i18n.language)}`} onClick={() => { setDraft((current) => current ? moveTour(current, tour.id, -1) : current); setSaved(false); }}>
                    {t('page.hotelSelection.moveUp')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={index === orderedTours.length - 1} aria-label={`${t('page.hotelSelection.moveDown')} ${localize(tour.title, i18n.language)}`} onClick={() => { setDraft((current) => current ? moveTour(current, tour.id, 1) : current); setSaved(false); }}>
                    {t('page.hotelSelection.moveDown')}
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => { setDraft((current) => current ? removeTour(current, tour.id) : current); setSaved(false); }}>
                    {t('page.hotelSelection.remove')}
                  </Button>
                  <div className="flex items-center gap-2">
                    <input id={`featured-${tour.id}`} type="radio" name="featured-tour" checked={draft.featuredTourId === tour.id} onChange={() => { setDraft((current) => current ? setFeatured(current, tour.id) : current); setSaved(false); }} />
                    <Label htmlFor={`featured-${tour.id}`}>{t('page.hotelSelection.featured')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input id={`attract-${tour.id}`} type="checkbox" checked={draft.attractTourIds.includes(tour.id)} onChange={() => { setDraft((current) => current ? toggleAttract(current, tour.id) : current); setSaved(false); }} />
                    <Label htmlFor={`attract-${tour.id}`}>{t('page.hotelSelection.attract')}</Label>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <Button type="button" disabled={saving} onClick={() => { void save(); }}>
            {saving ? t('page.hotelSelection.saving') : t('page.hotelSelection.save')}
          </Button>
        </>
      ) : null}
    </div>
  );
}
