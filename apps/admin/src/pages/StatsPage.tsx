import { Role } from '@xplor/shared';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { listHotels } from '../api/hotels.js';
import { downloadStatsCsv, getStats, type StatsQuery } from '../api/stats.js';
import { useAuth } from '../auth/AuthProvider.js';
import { Alert } from '../components/ui/Alert.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.js';

function dateInput(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function defaultQuery(): StatsQuery {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  const exclusiveTo = new Date(to);
  return { from: dateInput(from), to: dateInput(exclusiveTo) };
}

function displayDay(day: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(new Date(`${day}T00:00:00Z`));
}

export function StatsPage() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const [query, setQuery] = useState<StatsQuery>(defaultQuery);
  const [draft, setDraft] = useState<StatsQuery>(query);
  const [data, setData] = useState<Awaited<ReturnType<typeof getStats>> | null>(null);
  const [hotels, setHotels] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canFilterHotel = auth.state.status === 'authenticated' && auth.state.profile.role !== Role.EDITOR;

  useEffect(() => {
    let active = true;
    if (!canFilterHotel) return () => { active = false; };
    void listHotels().then((hotelRows) => {
      if (!active) return;
      setHotels(hotelRows);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [canFilterHotel]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void getStats(query).then((result) => {
      if (active) setData(result);
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);

  const metricCards = useMemo(() => data === null ? [] : [
    ['sessions', data.summary.sessions],
    ['averageDuration', Math.round(data.summary.averageSessionDurationMs / 60_000)],
    ['toursOpened', data.summary.toursOpened],
    ['scenesViewed', data.summary.scenesViewed],
    ['hotspotClicks', data.summary.hotspotClicks],
    ['vrEntries', data.summary.vrEntries],
    ['qrScans', data.summary.qrScans],
  ] as const, [data]);

  async function exportCsv(): Promise<void> {
    setExporting(true);
    try {
      const blob = await downloadStatsCsv(query);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'xplor-statistiques.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold text-primary">{t('page.stats.title')}</h2>
          <p className="text-muted-foreground">{t('page.stats.subtitle')}</p>
        </div>
        <Button type="button" variant="outline" disabled={loading || exporting} onClick={() => { void exportCsv(); }}>
          {exporting ? t('page.stats.exporting') : t('page.stats.export')}
        </Button>
      </header>

      <form className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-3 xl:grid-cols-6" onSubmit={(event) => {
        event.preventDefault();
        setQuery({ ...draft });
      }}>
        <label className="flex flex-col gap-1 text-sm">{t('page.stats.from')}<input type="date" required value={draft.from.slice(0, 10)} onChange={(event) => { setDraft({ ...draft, from: event.target.value }); }} className="rounded border p-2" /></label>
        <label className="flex flex-col gap-1 text-sm">{t('page.stats.to')}<input type="date" required value={draft.to.slice(0, 10)} onChange={(event) => { setDraft({ ...draft, to: event.target.value }); }} className="rounded border p-2" /></label>
        {canFilterHotel ? <label className="flex flex-col gap-1 text-sm">{t('page.stats.hotel')}<select value={draft.hotelId ?? ''} onChange={(event) => { setDraft({ ...draft, hotelId: event.target.value || undefined }); }} className="rounded border p-2"><option value="">{t('page.stats.allHotels')}</option>{hotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></label> : null}
        <label className="flex flex-col gap-1 text-sm">{t('page.stats.tour')}<select value={draft.tourId ?? ''} onChange={(event) => { setDraft({ ...draft, tourId: event.target.value || undefined }); }} className="rounded border p-2"><option value="">{t('page.stats.allTours')}</option>{(data?.topTours ?? []).map((tour) => <option key={tour.id} value={tour.id}>{tour.label}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm">{t('page.stats.channel')}<select value={draft.channel ?? ''} onChange={(event) => { setDraft({ ...draft, channel: event.target.value || undefined }); }} className="rounded border p-2"><option value="">{t('page.stats.allChannels')}</option><option value="WEB">WEB</option><option value="KIOSK">KIOSK</option><option value="VR">VR</option></select></label>
        <label className="flex flex-col gap-1 text-sm">{t('page.stats.language')}<select value={draft.lang ?? ''} onChange={(event) => { setDraft({ ...draft, lang: event.target.value || undefined }); }} className="rounded border p-2"><option value="">{t('page.stats.allLanguages')}</option><option value="fr">Français</option><option value="ar">العربية</option><option value="en">English</option></select></label>
        <div className="md:col-span-3 xl:col-span-6"><Button type="submit" disabled={loading}>{t('page.stats.apply')}</Button></div>
      </form>

      {error ? <Alert role="alert">{t('page.stats.error')}</Alert> : null}
      {loading ? <p role="status">{t('common.loading')}</p> : null}
      {data !== null && !loading ? <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {metricCards.map(([key, value]) => <Card key={key}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t(`page.stats.metrics.${key}`)}</CardTitle></CardHeader><CardContent><strong className="text-2xl">{value.toLocaleString(i18n.language)}</strong>{key === 'averageDuration' ? <span className="ms-1 text-sm text-muted-foreground">{t('page.stats.minutes')}</span> : null}</CardContent></Card>)}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card><CardHeader><CardTitle>{t('page.stats.daily')}</CardTitle></CardHeader><CardContent><div className="flex h-52 items-end gap-1 overflow-x-auto border-b border-s"><svg role="img" aria-label={t('page.stats.daily')} viewBox={`0 0 ${String(Math.max(1, data.daily.length) * 32)} 180`} className="h-full min-w-full"><polyline fill="none" stroke="currentColor" strokeWidth="3" points={data.daily.map((row, index) => `${String(index * 32 + 16)},${String(168 - (row.sessions / Math.max(1, ...data.daily.map((item) => item.sessions)) * 145))}`).join(' ')} />{data.daily.map((row, index) => <g key={row.day}><circle cx={index * 32 + 16} cy={168 - row.sessions / Math.max(1, ...data.daily.map((item) => item.sessions)) * 145} r="3" fill="currentColor"><title>{`${displayDay(row.day, i18n.language)}: ${String(row.sessions)}`}</title></circle></g>)}</svg></div><ol className="sr-only">{data.daily.map((row) => <li key={row.day}>{`${displayDay(row.day, i18n.language)}: ${String(row.sessions)} sessions`}</li>)}</ol><p className="mt-2 text-xs text-muted-foreground">{data.daily.map((row) => displayDay(row.day, i18n.language)).join(' · ')}</p></CardContent></Card>
          <Card><CardHeader><CardTitle>{t('page.stats.hourly')}</CardTitle></CardHeader><CardContent><div role="img" aria-label={t('page.stats.hourly')} className="flex h-52 items-end gap-1 border-b border-s">{data.hourly.map((row) => <div key={row.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${String(row.hour)}:00 — ${String(row.sessions)}`}><div className="w-full rounded-t bg-primary" style={{ height: `${String(Math.max(2, row.sessions / Math.max(1, ...data.hourly.map((item) => item.sessions)) * 85))}%` }} /><span className="text-[10px]">{row.hour % 3 === 0 ? String(row.hour) : ''}</span></div>)}</div><ol className="sr-only">{data.hourly.map((row) => <li key={row.hour}>{`${String(row.hour)}:00 — ${String(row.sessions)} sessions`}</li>)}</ol></CardContent></Card>
          <StatsList title={t('page.stats.topTours')} rows={data.topTours.map((row) => [row.label, row.opens])} />
          <StatsList title={t('page.stats.topScenes')} rows={data.topScenes.map((row) => [row.label, row.views])} />
          <StatsList title={t('page.stats.languages')} rows={data.languages.map((row) => [row.lang, row.sessions])} />
          <StatsList title={t('page.stats.channels')} rows={data.channels.map((row) => [row.channel, row.sessions])} />
        </div>
      </> : null}
    </section>
  );
}

function StatsList({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><ol className="flex flex-col gap-2">{rows.map(([label, value], index) => <li key={`${label}-${String(index)}`} className="flex justify-between gap-3 border-b pb-2 text-sm"><span className="truncate">{String(index + 1)}. {label}</span><strong>{value.toLocaleString()}</strong></li>)}{rows.length === 0 ? <li className="text-sm text-muted-foreground">—</li> : null}</ol></CardContent></Card>;
}
