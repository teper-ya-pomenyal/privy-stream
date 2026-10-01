import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { errorText } from '../api';
import { useRelease } from '../api/queries';
import { fmtTime, plural } from '../lib/format';
import { useFavControl } from '../store/favorites';
import { usePlayer } from '../store/player';
import { releaseMeta } from './Catalog';
import { useActiveNode } from '../store/servers';
import { BackIcon, Button, EmptyState, ErrorNote, NodeCover, PlayIcon, Screen, ShareIcon, Skeleton, TextLink, TrackTable, TrackTableSkeleton } from '../ui';
import s from './screens.module.css';

/** Fallback для не-secure контекстов (web-сборка по plain http в локальной сети). */
function legacyCopy(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

/** «Поделиться»: системный шер, если есть, иначе — текст релиза в буфер обмена. */
function ShareButton({ title, artist, code, host }: { title: string; artist: string; code?: string; host: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashCopied = () => {
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    // Публичного URL у релиза нет — делимся тем, что поможет найти его на узле:
    // имя, артист, код каталога и адрес узла (в веб-режиме — ещё и ссылка на страницу).
    const url = location.protocol.startsWith('http') ? location.href : '';
    const text = [`«${title}» — ${artist} · Privy Stream`, `Узел: ${host}`, code && `Каталог: ${code}`, url]
      .filter(Boolean)
      .join('\n');
    let shared = false;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: url || undefined });
        shared = true;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return; // отменил шер — не ошибка и не копия
      }
    }
    if (shared) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      legacyCopy(text);
    }
    flashCopied();
  };

  return (
    <Button size="md" onClick={share}>
      <ShareIcon size={14} />
      {copied ? 'Скопировано' : 'Поделиться'}
    </Button>
  );
}

export function Album() {
  const { id = '' } = useParams();
  const node = useActiveNode();
  const navigate = useNavigate();
  const release = useRelease(node.host, id);
  const play = usePlayer((p) => p.play);
  const fav = useFavControl();
  const r = release.data;

  const totalSec = r?.tracks.reduce((sum, t) => sum + t.durationSec, 0) ?? 0;

  return (
    <Screen>
      <TextLink className={s.back} onClick={() => navigate('/catalog')}>
        <BackIcon size={15} />
        Каталог
      </TextLink>

      {release.isError ? (
        <EmptyState
          label="РЕЛИЗ НЕДОСТУПЕН"
          text={<ErrorNote>{errorText(release.error)}</ErrorNote>}
          action={
            <Button size="sm" onClick={() => navigate('/catalog')}>
              К поиску по узлу
            </Button>
          }
        />
      ) : (
        <div className={s.albumLayout}>
          <div className={s.albumAside}>
            <div className={s.albumCover}>{r ? <NodeCover host={node.host} releaseId={r.id} seed={r.id} code={r.code} flagged={r.flagged} /> : <Skeleton style={{ aspectRatio: '1' }} />}</div>
            {r && (
              <div className={s.metaTable}>
                {(
                  [
                    // Показываем только то, что узел отдал: в API v1 нет года, жанра и формата.
                    ['КАТАЛОГ', r.code],
                    ['ГОД', r.year && String(r.year)],
                    ['ЖАНР', r.genre],
                    ['ФОРМАТ', r.format],
                    ['УЗЕЛ', node.name],
                    ['НА УЗЛЕ С', r.createdAt && new Date(r.createdAt).toLocaleDateString('ru-RU')],
                  ].filter(([, v]) => v) as [string, string][]
                ).map(([k, v]) => (
                  <div key={k} className={s.metaRow}>
                    <span className={s.metaKey}>{k}</span>
                    <span className={s.metaVal}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={s.albumMain}>
            {r ? (
              <div className={s.albumHead}>
                <button type="button" className={s.artistLink} onClick={() => navigate(`/artist/${encodeURIComponent(r.artistId)}`)}>
                  {r.artist}
                </button>
                <h2 className={s.albumTitle}>
                  {r.title}
                  {r.flagged && <span className={s.albumFlag}>18+</span>}
                </h2>
                <div className={s.albumMeta}>
                  {[releaseMeta(r), `${r.tracks.length} ${plural(r.tracks.length, ['трек', 'трека', 'треков'])}`, totalSec > 0 && fmtTime(totalSec)]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            ) : (
              <div className={s.albumHead}>
                <Skeleton style={{ height: 13, width: 140 }} />
                <Skeleton style={{ height: 44, width: '60%' }} />
                <Skeleton style={{ height: 13, width: 260 }} />
              </div>
            )}

            <div className={s.actions}>
              <Button
                variant="accent"
                size="md"
                disabled={!r?.tracks.length}
                onClick={() => r && play(r.tracks[0], r.tracks)}
              >
                <PlayIcon size={13} />
                Слушать
              </Button>
              {r && <ShareButton title={r.title} artist={r.artist} code={r.code} host={node.host} />}
            </div>

            <div className={s.tracks}>
              {r ? (
                r.tracks.length ? (
                  <TrackTable variant="release" tracks={r.tracks} onPlay={(t) => play(t, r.tracks)} fav={fav} />
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
