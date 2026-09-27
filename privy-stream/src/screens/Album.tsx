import { useNavigate, useParams } from 'react-router';
import { errorText } from '../api';
import { useRelease } from '../api/queries';
import { fmtTime, plural } from '../lib/format';
import { usePlayer } from '../store/player';
import { releaseMeta } from './Catalog';
import { useActiveNode } from '../store/servers';
import { Button, Cover, EmptyState, ErrorNote, PlayIcon, Screen, Skeleton, TextLink, TrackTable, TrackTableSkeleton } from '../ui';
import s from './screens.module.css';

export function Album() {
  const { id = '' } = useParams();
  const node = useActiveNode();
  const navigate = useNavigate();
  const release = useRelease(node.host, id);
  const play = usePlayer((p) => p.play);
  const r = release.data;

  const totalSec = r?.tracks.reduce((sum, t) => sum + t.durationSec, 0) ?? 0;

  return (
    <Screen>
      <TextLink className={s.back} onClick={() => navigate('/catalog')}>
        ← КАТАЛОГ
      </TextLink>

      {release.isError ? (
        <EmptyState
          label="РЕЛИЗ НЕДОСТУПЕН"
          text={<ErrorNote>{errorText(release.error)}</ErrorNote>}
          action={
            <Button size="sm" onClick={() => navigate('/catalog')}>
              К ПОЛКЕ УЗЛА
            </Button>
          }
        />
      ) : (
        <div className={s.albumLayout}>
          <div className={s.albumAside}>
            <Cover
              caption={
                <span className={s.albumCoverCaption}>
                  обложка релиза
                  <br />
                  1000×1000
                </span>
              }
            />
            <div className={s.metaTable}>
              {(r
                ? // Показываем только то, что узел отдал: в API v1 нет года, жанра, формата и кода.
                  ([
                    ['КАТАЛОГ', r.code],
                    ['ГОД', r.year && String(r.year)],
                    ['ЖАНР', r.genre],
                    ['ФОРМАТ', r.format],
                    ['УЗЕЛ', node.name],
                    ['НА УЗЛЕ С', r.createdAt && new Date(r.createdAt).toLocaleDateString('ru-RU')],
                    ['ГЕОБЛОК', 'НЕТ'],
                    ['МЕТКА', r.flagged ? '18+ / БЕЗ ФИЛЬТРА' : 'БЕЗ МЕТОК'],
                  ].filter(([, v]) => v) as [string, string][])
                : Array.from({ length: 7 }, () => ['', ''])
              ).map(([k, v], i) => (
                <div key={i} className={s.metaRow}>
                  {r ? <span className={s.metaKey}>{k}</span> : <Skeleton style={{ height: 10, width: 50 }} />}
                  {r ? <span className={s.metaVal}>{v}</span> : <Skeleton style={{ height: 10, width: 40 }} />}
                </div>
              ))}
            </div>
          </div>

          <div className={s.albumMain}>
            {r ? (
              <div className={s.albumHead}>
                <button type="button" className={s.artistLink} onClick={() => navigate(`/artist/${encodeURIComponent(r.artistId)}`)}>
                  {r.artist} →
                </button>
                <h2 className={s.albumTitle}>{r.title}</h2>
                <div className={s.albumMeta}>
                  {[releaseMeta(r), `${r.tracks.length} ${plural(r.tracks.length, ['ТРЕК', 'ТРЕКА', 'ТРЕКОВ'])}`, totalSec > 0 && fmtTime(totalSec)]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            ) : (
              <div className={s.albumHead}>
                <Skeleton style={{ height: 11, width: 140 }} />
                <Skeleton style={{ height: 44, width: '60%' }} />
                <Skeleton style={{ height: 12, width: 260 }} />
              </div>
            )}

            <div className={s.actions}>
              <Button
                variant="accent"
                size="md"
                style={{ padding: '13px 22px', letterSpacing: '.16em' }}
                disabled={!r?.tracks.length}
                onClick={() => r && play(r.tracks[0], r.tracks)}
              >
                <PlayIcon size={12} />
                СЛУШАТЬ
              </Button>
              <Button size="md">+ В БИБЛИОТЕКУ</Button>
              <Button size="md">СКАЧАТЬ FLAC</Button>
            </div>

            <div className={s.tracks}>
              {r ? (
                r.tracks.length ? (
                  <TrackTable variant="release" tracks={r.tracks} onPlay={(t) => play(t, r.tracks)} />
                ) : (
                  <EmptyState label="ПУСТОЙ ТРЕКЛИСТ" text="Узел отдал релиз без треков." />
                )
              ) : (
                <TrackTableSkeleton />
              )}
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
