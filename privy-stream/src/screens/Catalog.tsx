import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { errorText, type Release, type SearchResult, type Track } from '../api';
import { useBrowse, useSearch } from '../api/queries';
import { IS_WEB } from '../platform/mode';
import { useMobile } from '../lib/useMobile';
import { usePlayer } from '../store/player';
import { useFavControl } from '../store/favorites';
import { useActiveNode } from '../store/servers';
import { ArtistAvatar, Button, CloseIcon, EmptyState, ErrorNote, hostLabel, NodeCover, Screen, SearchIcon, Skeleton, TrackTable } from '../ui';
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
  const fav = useFavControl();
  const mobile = useMobile();
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<Filter>('ВСЁ');
  const query = useDebounced(input.trim());

  const browse = useBrowse(host);
  const search = useSearch(host, query);
  const searching = query.length > 0;
  const active = searching ? search : browse;

  // Полка не умеет показывать артистов и треков — поиск-only фильтр на ней не остаётся.
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
    <Button size="sm" onClick={() => navigate('/servers')}>
      Выбрать другой узел
    </Button>
  );

  const searchBox = (
    <div className={s.searchBox}>
      <span className={s.searchIco}>
        <SearchIcon size={20} />
      </span>
      <input
        className={s.searchInput}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Трек, артист или релиз…"
        aria-label="Поиск по узлу"
        // На телефоне автофокус сразу открывает клавиатуру поверх полки.
        autoFocus={!mobile}
      />
      {input && (
        <button type="button" className={s.searchClear} onClick={() => setInput('')} aria-label="Очистить поиск">
          <CloseIcon size={16} />
        </button>
      )}
    </div>
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
      <div className={s.errorRow}>
        <ErrorNote>{errorText(active.error)}</ErrorNote>
        <div className={s.errorActions}>
          <Button size="sm" onClick={() => void active.refetch()}>
            Повторить
          </Button>
          {toServers}
        </div>
      </div>
    );
  } else if (found === 0) {
    body =
      total > 0 ? (
        // Совпадения есть, но выбранный раздел их не показывает — это не «пустой узел».
        <EmptyState label="РАЗДЕЛ ПУСТ" text="По запросу есть совпадения в других разделах — переключись на «Все»." />
      ) : (
        <EmptyState
          label="НИЧЕГО НЕ НАЙДЕНО"
          text={searching ? 'На этом узле ничего не найдено по запросу.' : `На узле «${name}» пока нет музыки — владелец не залил фонотеку.`}
          action={toServers}
        />
      );
  } else {
    body = (
      <div className={s.results} style={{ opacity: search.isPlaceholderData ? 0.6 : 1 }}>
        {result.artists.length > 0 && (
          <section className={s.resultSection}>
            <div className="t-section">Артисты</div>
            <div className={s.artistList}>
              {result.artists.map((a) => (
                <button key={a.id} type="button" className={s.artistRow} onClick={() => openArtist(a.id)}>
                  <ArtistAvatar name={a.name} className={s.artistAva} />
                  <span className={s.artistName}>{a.name}</span>
                  <span className={s.artistGo}>
                    <Chevron />
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
        {result.releases.length > 0 && (
          <section className={s.resultSection}>
            <div className="t-section">Релизы</div>
            <div className={s.grid}>
              {result.releases.map((r) => (
                <ReleaseCard key={r.id} release={r} host={host} onOpen={() => openRelease(r.id)} />
              ))}
            </div>
          </section>
        )}
        {result.tracks.length > 0 && (
          <section className={s.resultSection}>
            <div className="t-section">Треки</div>
            <TrackTable variant="library" tracks={result.tracks} onPlay={(t) => play(t, result.tracks)} fav={fav} />
          </section>
        )}
      </div>
    );
  }

  return (
    <Screen>
      <div className={s.catalogHead}>
        <h2 className="t-h2">Поиск по узлу</h2>
        <div className={s.catalogSub}>
          Музыка из <span className={s.catalogHost}>{hostLabel(host)}</span> · поиск идёт только на выбранном узле
        </div>
        {searchBox}
        {/* Вкладки разделов видны только во время поиска: полка узла отдаёт одни
            релизы, поэтому вне поиска разделам «Артисты»/«Треки» нечего показывать. */}
        {searching && (
          <div className={s.filterBar}>
            {/* Имена классов не пересекаются с вкладками входа (s.tabs/s.tab заняты ими) */}
            {FILTERS.map((f) => {
              const count = f === 'ВСЁ' ? total : f === 'АРТИСТЫ' ? result.artists.length : f === 'РЕЛИЗЫ' ? result.releases.length : result.tracks.length;
              return (
                <button key={f} type="button" className={s.filterTab} data-on={filter === f ? '' : undefined} onClick={() => setFilter(f)}>
                  {f === 'ВСЁ' ? 'Все' : f === 'АРТИСТЫ' ? 'Артисты' : f === 'РЕЛИЗЫ' ? 'Релизы' : 'Треки'}
                  {count > 0 && <span className={s.filterCount}>{count}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {body}
    </Screen>
  );
}

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 5 7 7-7 7" />
  </svg>
);

function GridSkeleton() {
  return (
    <div className={s.grid} style={{ paddingTop: 'var(--grid-top)' }}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={s.card} style={{ cursor: 'default' }}>
          <Skeleton style={{ aspectRatio: '1' }} />
          <Skeleton style={{ height: 13, width: '70%' }} />
          <Skeleton style={{ height: 11, width: '45%' }} />
        </div>
      ))}
    </div>
  );
}

export function releaseMeta(r: Release): string {
  return [r.year, r.genre?.toUpperCase()].filter(Boolean).join(' · ');
}

export function ReleaseCard({ release: r, host, onOpen }: { release: Release; host: string; onOpen: () => void }) {
  return (
    <div className={s.card} onClick={onOpen} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <NodeCover host={host} releaseId={r.id} seed={r.id} code={r.code} flagged={r.flagged} />
      <div className={s.cardText}>
        <div className={s.cardTitle}>{r.title}</div>
        <div className={s.cardArtist}>{r.artist}</div>
      </div>
    </div>
  );
}

/** Заголовок раздела — единый стиль секций каталога. */
