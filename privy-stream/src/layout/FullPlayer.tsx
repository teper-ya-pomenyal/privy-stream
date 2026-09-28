import { useEffect } from 'react';
import { fmtTime, trackNum } from '../lib/format';
import { wavePeaks } from '../lib/viz';
import { useCurrentTrack, useDuration, usePlayer } from '../store/player';
import { useActiveNode } from '../store/servers';
import { CoverArt, cx, NextIcon, PauseIcon, PlayIcon, PrevIcon, TextLink } from '../ui';
import { pointerFraction, VolumeControl } from './PlayerBar';
import s from './layout.module.css';

const PEAKS = wavePeaks();

export function FullPlayer() {
  const track = useCurrentTrack();
  const node = useActiveNode();
  const { queue, index, playing, position, error, toggle, next, prev, seek, play, setFullscreen } = usePlayer();
  const duration = useDuration();
  const pct = duration ? (position / duration) * 100 : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullscreen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setFullscreen]);

  if (!track) return null;

  return (
    <div className={s.full}>
      <div className={s.fullBar}>
        <div className={s.fullBarLabel}>СЕЙЧАС ИГРАЕТ</div>
        <TextLink onClick={() => setFullscreen(false)}>Свернуть</TextLink>
      </div>

      <div className={s.fullBody}>
        <div className={s.fullMain}>
          <div className={s.hero}>
            <div className={s.heroCover}>
              <CoverArt seed={track.releaseId || track.id} className={s.heroArt} />
            </div>
            <div className={s.heroText}>
              {track.release && <div className={s.heroRelease}>{track.release}</div>}
              <h2 className={s.heroTitle}>{track.title}</h2>
              <div className={s.heroArtist}>{track.artist}</div>
            </div>
          </div>

          <div className={s.waveWrap}>
            <div className={s.wave} onClick={(e) => seek(pointerFraction(e))}>
              {PEAKS.map((h, i) => (
                <div
                  key={i}
                  className={s.waveBar}
                  style={{ height: `${h}%`, background: (i / PEAKS.length) * 100 <= pct ? 'var(--accent)' : 'var(--line-ctrl)' }}
                />
              ))}
            </div>
            <div className={s.waveMeta}>
              <span>{fmtTime(position)}</span>
              <span style={{ color: error ? 'var(--accent-text)' : 'var(--text-5)' }}>
                {error || (track.format ? `${track.format} · поток с узла` : track.host ? 'поток с узла' : 'локальный трек')}
              </span>
              <span>{fmtTime(duration)}</span>
            </div>
          </div>

          <div className={s.fullTransport}>
            <button type="button" className={s.iconBtn} onClick={prev} aria-label="Предыдущий">
              <PrevIcon size={18} />
            </button>
            <button type="button" className={s.fullPlay} onClick={toggle} aria-label={playing ? 'Пауза' : 'Играть'}>
              {playing ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
            </button>
            <button type="button" className={s.iconBtn} onClick={next} aria-label="Следующий">
              <NextIcon size={18} />
            </button>
            <VolumeControl />
          </div>
        </div>

        <div className={s.queue}>
          <div className={cx(s.queueHead, 't-section')}>Очередь · {queue.length}</div>
          <div className={s.queueList}>
            {queue.map((t, i) => (
              <button key={t.id} type="button" className={cx(s.queueRow, i === index && s.playing)} onClick={() => play(t)}>
                <span className={s.qNum}>{trackNum(i)}</span>
                <span className={s.qText}>
                  <span className={cx(s.qTitle, 'ellipsis')}>{t.title}</span>
                  <span className={cx(s.qArtist, 'ellipsis')}>{t.artist}</span>
                </span>
                <span className={s.qDur}>{fmtTime(t.durationSec)}</span>
              </button>
            ))}
          </div>
          <div className={s.queueFoot}>
            <div className={s.kv}>
              <span>ИСТОРИЯ В КЛИЕНТЕ</span>
              <span>не ведётся</span>
            </div>
            <div className={s.kv}>
              <span>УЧЁТ ПРОСЛУШИВАНИЙ</span>
              <span>счётчик на узле</span>
            </div>
            <div className={s.kv}>
              <span>УЗЕЛ</span>
              <span>
                {node.name} · {node.ping ?? '—'} ms
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
