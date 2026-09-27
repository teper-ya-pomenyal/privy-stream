import { useEffect, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import type { Track } from '../api';
import { fmtTime } from '../lib/format';
import { meterHeights } from '../lib/viz';
import { useCurrentTrack, useDuration, usePlayer } from '../store/player';
import { cx, NextIcon, PauseIcon, PlayIcon, PrevIcon } from '../ui';
import s from './layout.module.css';

/** Доля ширины элемента под курсором — для seek по полосе/волне. */
export const pointerFraction = (e: MouseEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  return (e.clientX - r.left) / r.width;
};

export const trackSubline = (t: Track) => (t.release ? `${t.artist} · ${t.release}` : t.artist);

export function PlayerBar() {
  const track = useCurrentTrack();
  const { playing, position, loading, error, toggle, next, prev, seek, setFullscreen } = usePlayer();
  const duration = useDuration();
  const tick = useMeterTick(playing && !loading);
  const pct = duration ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div className={s.player}>
      <button type="button" className={s.nowPlaying} onClick={() => track && setFullscreen(true)}>
        <div className={s.thumb} />
        <div className={s.nowText}>
          <span className={cx(s.nowTitle, 'ellipsis')}>{track?.title ?? '—'}</span>
          <span className={cx(s.nowSub, 'ellipsis')} style={error ? { color: 'var(--accent-text)' } : undefined} title={error || undefined}>
            {error || (loading ? 'загрузка с узла…' : track ? trackSubline(track) : 'очередь пуста')}
          </span>
        </div>
      </button>

      <div className={s.center}>
        <div className={s.transport}>
          <button type="button" className={s.skip} onClick={prev} aria-label="Предыдущий">
            <PrevIcon />
          </button>
          <button type="button" className={s.playBtn} onClick={toggle} aria-label={playing ? 'Пауза' : 'Играть'}>
            {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          </button>
          <button type="button" className={s.skip} onClick={next} aria-label="Следующий">
            <NextIcon />
          </button>
        </div>
        <div className={s.progressRow}>
          <span className={s.time}>{fmtTime(position)}</span>
          <div className={s.progress} onClick={(e) => seek(pointerFraction(e))}>
            <div className={s.progressFill} style={{ width: `${pct}%` }} />
          </div>
          <span className={s.time}>{fmtTime(duration)}</span>
        </div>
      </div>

      <div className={s.right}>
        <VolumeControl />
        <div className={s.meter}>
          {meterHeights(tick, playing && !loading).map((h, i) => (
            <div key={i} className={s.meterBar} style={{ height: `${h}%`, background: i > 10 ? 'var(--accent)' : 'var(--line-hover)' }} />
          ))}
        </div>
        <div className={s.spec}>
          24 BIT / 96 kHz
          <br />
          NO LOG
        </div>
      </div>
    </div>
  );
}

/**
 * Громкость: кнопка «без звука» и полоса-регулятор (тянуть, клик, стрелки, колесо).
 * На телефоне полоса скрыта CSS — в iOS громкость меняется только кнопками устройства.
 */
export function VolumeControl() {
  // Точечные селекторы: весь стор меняется на каждом тике позиции.
  const volume = usePlayer((p) => p.volume);
  const muted = usePlayer((p) => p.muted);
  const setVolume = usePlayer((p) => p.setVolume);
  const toggleMute = usePlayer((p) => p.toggleMute);
  const level = muted ? 0 : volume;

  const drag = (e: PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setVolume(pointerFraction(e));
  };
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    setVolume(level + step);
  };

  return (
    <div className={s.volume}>
      <button type="button" className={s.volBtn} onClick={toggleMute} aria-label={muted ? 'Включить звук' : 'Выключить звук'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" />
          {level === 0 ? (
            <path d="m16 9 6 6m0-6-6 6" />
          ) : (
            <>
              <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />
              {level > 0.5 && <path d="M18.5 7a7 7 0 0 1 0 10" />}
            </>
          )}
        </svg>
      </button>
      <div
        className={s.volBar}
        role="slider"
        tabIndex={0}
        aria-label="Громкость"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level * 100)}
        onPointerDown={drag}
        onPointerMove={drag}
        onKeyDown={onKey}
        onWheel={(e) => setVolume(level - Math.sign(e.deltaY) * 0.05)}
      >
        <div className={s.volFill} style={{ width: `${level * 100}%` }} />
      </div>
    </div>
  );
}

/** Такт анимации индикатора уровня (декоративный, как в макете). */
function useMeterTick(playing: boolean) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setTick((t) => t + 1), 900);
    return () => clearInterval(id);
  }, [playing]);
  return tick;
}

/** Мобильный мини-плеер над таб-баром: тап по треку раскрывает полноэкранный плеер. */
export function MiniPlayer() {
  const track = useCurrentTrack();
  const { playing, position, loading, error, toggle, seek, setFullscreen } = usePlayer();
  const duration = useDuration();
  const pct = duration ? Math.min(100, (position / duration) * 100) : 0;
  // Скраббинг по полоске таймлайна: тап и перетаскивание переставляют позицию.
  const [scrubbing, setScrubbing] = useState(false);

  const startScrub = (e: PointerEvent<HTMLDivElement>) => {
    if (!track || !duration) return;
    // Захват указателя, чтобы перетаскивание не срывалось за пределами полоски.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // pointerdown без активного указателя (синтетическое событие) — просто seek
    }
    setScrubbing(true);
    seek(pointerFraction(e));
  };
  const moveScrub = (e: PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 1) seek(pointerFraction(e));
  };

  return (
    <div className={s.mini}>
      {/* Полоска таймлайна — перемотка; остальная площадь мини-плеера открывает плеер */}
      <div
        className={s.miniSeek}
        role="slider"
        tabIndex={0}
        aria-label="Позиция в треке"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(position)}
        onPointerDown={startScrub}
        onPointerMove={moveScrub}
        onPointerUp={() => setScrubbing(false)}
        onPointerCancel={() => setScrubbing(false)}
        onKeyDown={(e) => {
          const step = { ArrowRight: 10, ArrowUp: 10, ArrowLeft: -10, ArrowDown: -10 }[e.key];
          if (step === undefined || !track || !duration) return;
          e.preventDefault();
          seek((position + step) / duration);
        }}
      >
        <div className={s.miniFill} style={{ width: `${pct}%` }} />
        {scrubbing && <span className={s.miniTime}>{fmtTime(position)}</span>}
      </div>
      <button type="button" className={s.nowPlaying} onClick={() => track && setFullscreen(true)}>
        <div className={cx(s.thumb, s.miniThumb)} />
        <div className={s.nowText}>
          <span className={cx(s.miniTitle, 'ellipsis')}>{track?.title ?? '—'}</span>
          <span className={cx(s.nowSub, 'ellipsis')} style={error ? { color: 'var(--accent-text)' } : undefined}>
            {error || (loading ? 'загрузка с узла…' : track ? track.artist : 'очередь пуста')}
          </span>
        </div>
      </button>
      <button type="button" className={cx(s.playBtn, s.miniPlay)} onClick={toggle} aria-label={playing ? 'Пауза' : 'Играть'}>
        {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
      </button>
    </div>
  );
}
