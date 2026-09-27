import { useEffect } from 'react';
import { fmtTime, trackNum } from '../lib/format';
import { wavePeaks } from '../lib/viz';
import { useCurrentTrack, useDuration, usePlayer } from '../store/player';
import { useActiveNode } from '../store/servers';
import { Button, Cover, cx, NextIcon, PauseIcon, PlayIcon, PrevIcon, TextLink } from '../ui';
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
        <div className="t-eyebrow">ВОСПРОИЗВЕДЕНИЕ · ПРИВАТНАЯ СЕССИЯ</div>
        <TextLink style={{ letterSpacing: '.16em' }} onClick={() => setFullscreen(false)}>
          СВЕРНУТЬ ✕
        </TextLink>
      </div>

      <div className={s.fullBody}>
        <div className={s.fullMain}>
          <div className={s.hero}>
            <Cover
              className={s.heroCover}
              caption={
                <>
                  обложка
                  <br />
                  1000×1000
                </>
              }
            />
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
              <span style={{ color: error ? 'var(--accent-text)' : 'var(--text-6)' }}>
                {error || (track.format ? `${track.format} · 1411 kbps` : track.host ? 'ПОТОК С УЗЛА' : 'ЛОКАЛЬНО')}
              </span>
              <span>{fmtTime(duration)}</span>
            </div>
          </div>

          <div className={s.fullTransport}>
            <Button size="md" onClick={prev} style={{ padding: '12px 16px' }} aria-label="Предыдущий">
              <PrevIcon size={16} />
            </Button>
            <button type="button" className={s.fullPlay} onClick={toggle} aria-label={playing ? 'Пауза' : 'Играть'}>
              {playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
            </button>
            <Button size="md" onClick={next} style={{ padding: '12px 16px' }} aria-label="Следующий">
              <NextIcon size={16} />
            </Button>
            <div className={s.fullExtra}>
              <Button size="sm" style={{ padding: '12px 14px', color: 'var(--text-3)' }}>
                ПОВТОР
              </Button>
              <Button size="sm" style={{ padding: '12px 14px', color: 'var(--text-3)' }}>
                СЛУЧАЙНО
              </Button>
            </div>
            <VolumeControl />
          </div>
        </div>

        <div className={s.queue}>
          <div className={cx(s.queueHead, 't-section')}>ОЧЕРЕДЬ · {queue.length}</div>
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
              <span>ИСТОРИЯ</span>
              <span style={{ color: 'var(--accent)' }}>НЕ ПИШЕТСЯ</span>
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
