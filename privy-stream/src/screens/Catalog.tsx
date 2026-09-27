import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { errorText, type Release, type SearchResult, type Track } from '../api';
import { useBrowse, useSearch } from '../api/queries';
import { IS_WEB } from '../platform/mode';
import { useMobile } from '../lib/useMobile';
import { usePlayer } from '../store/player';
import { useActiveNode } from '../store/servers';
import { Button, Cover, EmptyState, ErrorNote, hostLabel, PrefixedInput, Screen, ScreenHeader, Skeleton, TrackTable } from '../ui';
import s from './screens.module.css';

const FILTERS = ['ВСЁ', 'АРТИСТЫ', 'РЕЛИЗЫ', 'ТРЕКИ'] as const;
type Filter = (typeof FILTERS)[number];

/** Разделы, которые есть только в выдаче поиска: полка узла отдаёт одни релизы. */
const SEARCH_ONLY: readonly Filter[] = ['АРТИСТЫ', 'ТРЕКИ'];

export function Catalog() {
  const node = useActiveNode();
  // key по host: поиск и фильтр сбрасываются при смене узла.
  return <CatalogView key={node.host} host={node.host} name={node.name} />;
}

function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Релизы из найденных треков: в API v1 поиска по альбомам нет. */
function releasesOf(tracks: Track[]): Release[] {
  const byId = new Map<string, Release>();
  for (const t of tracks) {
    if (!t.releaseId) continue;
    const r = byId.get(t.releaseId);
    if (r) r.flagged ||= !!t.explicit;
    else byId.set(t.releaseId, { id: t.releaseId, title: t.release, artistId: t.artistId, artist: t.artist, flagged: !!t.explicit });
  }
  return [...byId.values()];
}

function CatalogView({ host, name }: { host: string; name: string }) {
  const navigate = useNavigate();
  const play = usePlayer((p) => p.play);
  const mobile = useMobile();
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<Filter>('ВСЁ');
  const query = useDebounced(input.trim());

  const browse = useBrowse(host);
  const search = useSearch(host, query);
  const searching = query.length > 0;
  const active = searching ? search : browse;

  // Полка не умеет показывать артистов и треки — поиск-only фильтр на ней не остаётся.
  useEffect(() => {
    if (!searching && SEARCH_ONLY.includes(filter)) setFilter('ВСЁ');
  }, [searching]);

  const result = useMemo(() => {
    const show = (section: Filter) => filter === 'ВСЁ' || filter === section;
    const res: SearchResult & { releases: Release[] } = searching
      ? { ...(search.data ?? { artists: [], tracks: [] }), releases: releasesOf(search.data?.tracks ?? []) }
      : { artists: [], tracks: [], releases: browse.data ?? [] };
    return {
      artists: show('АРТИСТЫ') ? res.artists : [],
      releases: show('РЕЛИЗЫ') ? res.releases : [],
      tracks: show('ТРЕКИ') ? res.tracks : [],
      // Найдено всего, без учёта фильтра: отличаем «ничего не нашлось» от «фильтр всё скрыл».
      total: res.artists.length + res.releases.length + res.tracks.length,
    };
  }, [searching, search.data, browse.data, filter]);

  const found = result.artists.length + result.releases.length + result.tracks.length;
  const total = result.total;
  const openRelease = (id: string) => navigate(`/album/${encodeURIComponent(id)}`);
  const openArtist = (id: string) => navigate(`/artist/${encodeURIComponent(id)}`);

  const toServers = IS_WEB ? null : (
    <Button size="sm" style={{ padding: '12px 18px', letterSpacing: '.14em' }} onClick={() => navigate('/servers')}>
      ВЫБРАТЬ ДРУГОЙ УЗЕЛ
    </Button>
  );

  let body;
  if (!searching && !browse.supported) {
    body = (
      <EmptyState
        label="ПОИСК ПО УЗЛУ"
        text="Узел отдаёт каталог только через поиск. Введи название трека или имя артиста — искать будем только здесь."
      />
    );
  } else if (active.isPending && !active.data) {
    body = <GridSkeleton />;
  } else if (active.isError) {
    body = (
      <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
        <ErrorNote>{errorText(active.error)}</ErrorNote>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button size="sm" onClick={() => void active.refetch()}>
            ПОВТОРИТЬ
          </Button>
          {toServers}
        </div>
      </div>
    );
  } else if (found === 0) {
    body =
      total > 0 ? (
        // Совпадения есть, но выбранный раздел их не показывает — это не «пустой узел».
        <EmptyState label="РАЗДЕЛ ПУСТ" text="По запросу есть совпадения в других разделах — переключи фильтр на ВСЁ." />
      ) : (
        <EmptyState
          label="ПУСТОЙ ИНДЕКС"
          text={searching ? 'На этом узле ничего не найдено по запросу.' : `Узел «${name}» пока ничего не отдаёт — владелец не залил фонотеку.`}
          action={toServers}
        />
      );
  } else {
    body = (
      <div className={s.results} style={{ opacity: search.isPlaceholderData ? 0.6 : 1 }}>
        {result.artists.length > 0 && (
          <section className={s.resultSection}>
            <div className="t-section">АРТИСТЫ · {result.artists.length}</div>
            <div className={s.artistList}>
              {result.artists.map((a) => (
                <button key={a.id} type="button" className={s.artistRow} onClick={() => openArtist(a.id)}>
                  <span className={s.nodeName}>{a.name}</span>
                  <span className={s.artistRowGo}>АРТИСТ →</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {result.releases.length > 0 && (
          <section className={s.resultSection}>
            {searching && <div className="t-section">РЕЛИЗЫ · {result.releases.length}</div>}
            <div className={s.grid} style={searching ? { paddingTop: 0 } : undefined}>
              {result.releases.map((r) => (
                <ReleaseCard key={r.id} release={r} onOpen={() => openRelease(r.id)} />
              ))}
            </div>
          </section>
        )}
        {result.tracks.length > 0 && (
          <section className={s.resultSection}>
            <div className="t-section">ТРЕКИ · {result.tracks.length}</div>
            <TrackTable variant="library" tracks={result.tracks} onPlay={(t) => play(t, result.tracks)} />
          </section>
        )}
      </div>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        eyebrow={`${hostLabel(host)} · ${searching || !browse.data ? 'ПОИСК ПО УЗЛУ' : `${browse.data.length} РЕЛИЗОВ`}`}
        title={`Полка узла «${name}»`}
        aside={
          <PrefixedInput
            prefix="/"
            className={s.search}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="трек или артист…"
            suffix={searching && search.data ? String(total) : undefined}
            // На телефоне автофокус сразу открывает клавиатуру поверх полки.
            autoFocus={!mobile}
          />
        }
      />

      <div className={s.filters}>
        {FILTERS.map((f) => {
          // Разделы поиска на полке недоступны: полка показывает только релизы.
          const offShelf = !searching && SEARCH_ONLY.includes(f);
          return (
            <Button
              key={f}
              variant="quiet"
              size="xs"
              selected={filter === f}
              disabled={offShelf}
              title={offShelf ? 'работает в поиске — введи запрос' : undefined}
              style={{ padding: '7px 12px', letterSpacing: '.12em', cursor: offShelf ? undefined : 'pointer' }}
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          );
        })}
      </div>

      {body}
    </Screen>
  );
}

function GridSkeleton() {
  return (
    <div className={s.grid}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={s.card2} style={{ cursor: 'default' }}>
          <Skeleton style={{ aspectRatio: '1' }} />
          <Skeleton style={{ height: 12, width: '70%' }} />
          <Skeleton style={{ height: 10, width: '45%' }} />
        </div>
      ))}
    </div>
  );
}

export function releaseMeta(r: Release): string {
  return [r.year, r.genre?.toUpperCase()].filter(Boolean).join(' · ');
}

function ReleaseCard({ release: r, onOpen }: { release: Release; onOpen: () => void }) {
  const meta = releaseMeta(r);
  return (
    <div className={s.card2} onClick={onOpen} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <Cover
        code={r.code}
        flagged={r.flagged}
        caption={
          <>
            обложка
            <br />
            1000×1000
          </>
        }
      />
      <div className={s.cardText}>
        <div className={s.cardTitle}>{r.title}</div>
        <div className={s.cardArtist}>{r.artist}</div>
        {meta && <div className={s.cardMeta}>{meta}</div>}
      </div>
    </div>
  );
}
