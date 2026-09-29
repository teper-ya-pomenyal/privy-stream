import { useNavigate, useParams } from 'react-router';
import { errorText } from '../api';
import { useArtist } from '../api/queries';
import { fmtNumber, plural } from '../lib/format';
import { usePlayer } from '../store/player';
import { useFavControl } from '../store/favorites';
import { releaseMeta } from './Catalog';
import { useActiveNode } from '../store/servers';
import { ArtistAvatar, BackIcon, Button, Cover, EmptyState, ErrorNote, Screen, Skeleton, TextLink, TrackTable, TrackTableSkeleton } from '../ui';
import s from './screens.module.css';

export function Artist() {
  const { id = '' } = useParams();
  const node = useActiveNode();
  const navigate = useNavigate();
  const artist = useArtist(node.host, id);
  const play = usePlayer((p) => p.play);
  const fav = useFavControl();
  const a = artist.data;

  if (artist.isError) {
    return (
      <Screen>
        <TextLink className={s.back} onClick={() => navigate('/catalog')}>
          <BackIcon size={15} />
          Каталог
        </TextLink>
        <EmptyState
          label="АРТИСТ НЕДОСТУПЕН"
          text={<ErrorNote>{errorText(artist.error)}</ErrorNote>}
          action={
            <Button size="sm" onClick={() => navigate('/catalog')}>
              К поиску по узлу
            </Button>
          }
        />
      </Screen>
    );
  }

  const n = a?.releases.length ?? 0;

  return (
    <Screen>
      <TextLink className={s.back} onClick={() => navigate(-1)}>
        <BackIcon size={15} />
        Назад
      </TextLink>

      <div className={s.artistHead}>
        {a ? <ArtistAvatar name={a.name} className={s.artistHeadAva} /> : <Skeleton style={{ width: 72, height: 72 }} />}
        <div className={s.artistHeadText}>
          {a ? <h2 className={s.artistTitle}>{a.name}</h2> : <Skeleton style={{ height: 40, width: 320, maxWidth: '100%' }} />}
          <div className={s.artistMeta}>
            {a ? [`${n} ${plural(n, ['релиз', 'релиза', 'релизов'])}`, a.activeYears].filter(Boolean).join(' · ') : '—'}
          </div>
        </div>
      </div>

      {/* Статистика — только если узел её отдаёт (в API v1 её нет). */}
      {a?.stats && (
        <div className={s.stats}>
          {[
            ['СЛУШАТЕЛЕЙ', fmtNumber(a.stats.listeners)],
            ['РЕЛИЗОВ', String(n)],
            ['СТРАН БЕЗ БЛОКА', String(a.stats.countriesUnblocked)],
            ['В БИБЛИОТЕКАХ', fmtNumber(a.stats.inLibraries)],
          ].map(([k, v]) => (
            <div key={k} className={s.stat}>
              <div className={s.statKey}>{k}</div>
              <div className={s.statVal}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className={s.twoCols}>
        <div className={s.col}>
          <div className="t-section">Популярное</div>
          {a ? (
            a.popular.length ? (
              <TrackTable variant="popular" header={false} tracks={a.popular} onPlay={(t) => play(t, a.popular)} fav={fav} />
            ) : (
              <div className={s.quietNote}>треков на узле нет</div>
            )
          ) : (
            <TrackTableSkeleton />
          )}
        </div>
        <div className={s.col}>
          <div className="t-section">Дискография</div>
          <div className={s.disco}>
            {a && a.releases.length === 0 && <div className={s.quietNote}>релизов на узле нет</div>}
            {a?.releases.map((r) => (
              <div key={r.id} className={s.discoItem} onClick={() => navigate(`/album/${encodeURIComponent(r.id)}`)}>
                <Cover seed={r.id} flagged={r.flagged} />
                <div className={s.discoText}>
                  <span className={s.discoTitle}>{r.title}</span>
                  {releaseMeta(r) && <span className={s.discoMeta}>{releaseMeta(r)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Screen>
  );
}
