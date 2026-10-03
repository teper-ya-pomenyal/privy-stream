import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { animate, useMotionValue, useReducedMotion, type MotionValue } from 'motion/react';
import type { Track } from '../api';
import { fmtTime } from '../lib/format';
import { useCurrentTrack, useDuration, usePlayer } from '../store/player';
import { CoverThumb, cx, NextIcon, PauseIcon, PlayIcon, PrevIcon, QueueIcon, RepeatIcon, RepeatOneIcon, ShuffleIcon } from '../ui';
import { sheetGesture } from './sheetGesture';
import s from './layout.module.css';

/** Доля ширины элемента под курсором — для seek по полосе/волне. */
export const pointerFraction = (e: MouseEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  return (e.clientX - r.left) / r.width;
};

export const trackSubline = (t: Track) => (t.release ? `${t.artist} · ${t.release}` : t.artist);

/**
 * Шкала прогресса: клик, перетаскивание, стрелки ±10 с, Home/End.
 * Презентационная — состояние в пропсах, чтобы тестировать без аудио.
 */
export function SeekBar({
  position,
  duration,
  onSeek,
  className,
  fillClassName,
  thumbClassName,
  label = 'Позиция в треке',
  disabled = false,
}: {
  position: number;
  duration: number;
  onSeek: (fraction: number) => void;
  className?: string;
  fillClassName?: string;
  thumbClassName?: string;
  label?: string;
  disabled?: boolean;
}) {
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const drag = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.buttons !== 1) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // синтетическое событие без активного указателя (jsdom, тесты) — просто seek
    }
    onSeek(pointerFraction(e));
  };
  const onKey = (e: KeyboardEvent) => {
    if (disabled || !duration) return;
    const step = { ArrowRight: 10, ArrowUp: 10, ArrowLeft: -10, ArrowDown: -10 }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      onSeek((position + step) / duration);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      onSeek(e.key === 'Home' ? 0 : 1);
    }
  };
  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(position)}
      aria-valuetext={`${fmtTime(position)} из ${fmtTime(duration)}`}
      className={className}
      onPointerDown={drag}
      onPointerMove={drag}
      onKeyDown={onKey}
    >
      <div className={fillClassName} style={{ width: `${pct}%` }} />
      {pct > 0 && <div className={thumbClassName} style={{ left: `${pct}%` }} />}
    </div>
  );
}

export function PlayerBar() {
  const track = useCurrentTrack();
  const { playing, position, loading, error, toggle, next, prev, seek, setFullscreen } = usePlayer();
  const duration = useDuration();

  return (
    <div className={s.player}>
      <button type="button" className={s.nowPlaying} onClick={() => track && setFullscreen(true)}>
        <div className={s.thumb}>{track && <CoverThumb host={track.host} releaseId={track.releaseId || track.id} seed={track.releaseId || track.id} className={s.thumbArt} />}</div>
        <div className={s.nowText}>
          <span className={cx(s.nowTitle, 'ellipsis')}>{track?.title ?? 'Очередь пуста'}</span>
          <span className={cx(s.nowSub, 'ellipsis')} style={error ? { color: 'var(--accent-text)' } : undefined} title={error || undefined}>
            {error || (loading ? 'загрузка с узла…' : track ? trackSubline(track) : 'выбери трек в каталоге')}
          </span>
        </div>
      </button>

      <div className={s.center}>
        {/* Тот же порядок кнопок, что в развёрнутом плеере: ⇄ ⏮ ▶ ⏭ ↻ */}
        <div className={s.transport}>
          <ShuffleControl className={s.skip} />
          <button type="button" className={s.skip} onClick={prev} aria-label="Предыдущий">
            <PrevIcon />
          </button>
          <button type="button" className={s.playBtn} onClick={toggle} aria-label={playing ? 'Пауза' : 'Играть'}>
            {playing ? <PauseIcon size={17} /> : <PlayIcon size={17} />}
          </button>
          <button type="button" className={s.skip} onClick={next} aria-label="Следующий">
            <NextIcon />
          </button>
          <RepeatControl className={s.skip} />
        </div>
        <div className={s.progressRow}>
          <span className={s.time}>{fmtTime(position)}</span>
          <SeekBar className={s.progress} fillClassName={s.progressFill} thumbClassName={s.progressThumb} position={position} duration={duration} disabled={!duration} onSeek={seek} />
          <span className={cx(s.time, s.timeRight)}>{fmtTime(duration)}</span>
        </div>
      </div>

      <div className={s.right}>
        <VolumeControl />
        {/* Кнопка очереди раскрывает полноэкранный плеер со списком */}
        <button type="button" className={s.iconBtn} onClick={() => setFullscreen(true)} aria-label="Очередь воспроизведения" title="Очередь">
          <QueueIcon size={20} />
        </button>
      </div>
    </div>
  );
}

/**
 * Кнопка режима повтора: выключен → вся очередь → текущий трек.
 * Вид берётся из переданного класса: в нижнем баре — как «назад/дальше»,
 * в полном плеере — бокс размером с кнопку «без звука».
 */
export function RepeatControl({ className }: { className?: string }) {
  // Точечные селекторы: кнопка не должна перерисовываться на каждом тике позиции.
  const repeat = usePlayer((p) => p.repeat);
  const cycleRepeat = usePlayer((p) => p.cycleRepeat);
  const label = repeat === 'off' ? 'Повтор выключен' : repeat === 'all' ? 'Повтор очереди' : 'Повтор трека';
  return (
    <button type="button" className={cx(className, repeat !== 'off' && s.repActive)} onClick={cycleRepeat} aria-label={label} title={label}>
      {repeat === 'one' ? <RepeatOneIcon size={18} /> : <RepeatIcon size={18} />}
    </button>
  );
}

/** Кнопка перемешивания: «дальше» и конец трека идут по случайному порядку очереди. */
export function ShuffleControl({ className }: { className?: string }) {
  const shuffle = usePlayer((p) => p.shuffle);
  const toggleShuffle = usePlayer((p) => p.toggleShuffle);
  const label = shuffle ? 'Перемешивание включено' : 'Перемешивание выключено';
  return (
    <button
      type="button"
      className={cx(className, shuffle && s.repActive)}
      onClick={toggleShuffle}
      aria-label={label}
      aria-pressed={shuffle}
      title={label}
    >
      <ShuffleIcon size={18} />
    </button>
  );
}

/** Сколько поповер громкости ждёт после ухода курсора, прежде чем скрыться. */
const VOLUME_HIDE_DELAY_MS = 400;

/**
 * Громкость: кнопка «без звука», полоса-регулятор живёт в поповере. Поповер
 * раскрывается при наведении или фокусе и не гаснет мгновенно: после ухода
 * курсора держится VOLUME_HIDE_DELAY_MS — курсор успевает дойти от кнопки до
 * полосы (невидимый «мост» в CSS докрывает зазор между ними). На телефоне
 * полоса скрыта CSS — в iOS громкость меняется только кнопками устройства.
 */
export function VolumeControl() {
  // Точечные селекторы: весь стор меняется на каждом тике позиции.
  const volume = usePlayer((p) => p.volume);
  const muted = usePlayer((p) => p.muted);
  const setVolume = usePlayer((p) => p.setVolume);
  const toggleMute = usePlayer((p) => p.toggleMute);
  const level = muted ? 0 : volume;
  // Открытие/закрытие — состоянием, а не :hover: hover умирает в зазоре между
  // кнопкой и поповером, из-за чего регулятором было не воспользоваться.
  const [open, setOpen] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const show = () => {
    window.clearTimeout(hideTimer.current);
    setOpen(true);
  };
  const hideSoon = () => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setOpen(false), VOLUME_HIDE_DELAY_MS);
  };
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

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
    // onFocus/onBlur в React всплывают: фокус с клавиатуры на полосе тоже держит поповер.
    <div className={s.volume} data-open={open || undefined} onMouseEnter={show} onMouseLeave={hideSoon} onFocus={show} onBlur={hideSoon}>
      {/* Поповер над кнопкой: из дерева доступности не исчезает (opacity, не display). */}
      <div className={s.volumePop}>
        <div
          className={s.volBar}
          role="slider"
          tabIndex={0}
          aria-label="Громкость"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level * 100)}
          onPointerDown={(e) => {
            // Зажатие полосы держит поповер открытым, даже если курсор при тяге уходит.
            show();
            drag(e);
          }}
          onPointerMove={drag}
          onKeyDown={onKey}
          onWheel={(e) => setVolume(level - Math.sign(e.deltaY) * 0.05)}
        >
          <div className={s.volFill} style={{ width: `${level * 100}%` }} />
          {level > 0 && <div className={s.volThumb} style={{ left: `${level * 100}%` }} />}
        </div>
      </div>
      <button type="button" className={s.volBtn} onClick={toggleMute} aria-label={muted ? 'Включить звук' : 'Выключить звук'}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    </div>
  );
}

/** Насколько (px) надо потянуть мини-плеер вверх, чтобы жест стал открытием шторки. */
const DRAG_OPEN_START_PX = 8;
/** Доля высоты экрана: дожал тягу на четверть экрана вверх — шторка открывается. */
const OPEN_DISTANCE_FRACTION = 0.25;
/** Скорость рывка вверх (px/мс), при которой шторка открывается из любого положения. */
const OPEN_FLING_V_PXMS = 0.5;

/** Скорость последнего рывка по выборке точек жеста: вниз — плюс, вверх — минус.
 *  Берутся точки последней сотни миллисекунд; интервал короче 8 мс (дубликаты
 *  событий) или палец, замерший перед отпусканием, рывком не считается. */
export const flingVelocity = (samples: Array<{ t: number; y: number }>) => {
  const last = samples[samples.length - 1];
  const windowStart = last.t - 100;
  let first = last;
  for (const p of samples) {
    if (p.t >= windowStart) {
      first = p;
      break;
    }
  }
  const dt = last.t - first.t;
  return dt >= 8 ? (last.y - first.y) / dt : 0;
};

/**
 * Мобильный мини-плеер над таб-баром. Тап по треку открывает полноэкранную
 * шторку, а тяга вверх открывает её «в руке»: шторка следует за пальцем,
 * дожал четверть экрана или рванул вверх — открылась, отпустил раньше — уехала
 * обратно вниз.
 */
export function MiniPlayer({ sheetY: externalY }: { sheetY?: MotionValue<string | number> } = {}) {
  const track = useCurrentTrack();
  const { playing, position, loading, error, toggle, seek, setFullscreen } = usePlayer();
  const duration = useDuration();
  const pct = duration ? Math.min(100, (position / duration) * 100) : 0;
  // Скраббинг по полоске таймлайна: тап и перетаскивание переставляют позицию.
  const [scrubbing, setScrubbing] = useState(false);
  // Позиция шторки — общий с FullPlayer MotionValue: жест ведёт её до монтирования.
  const fallbackY = useMotionValue<string | number>('100%');
  const sheetY = externalY ?? fallbackY;
  const reducedMotion = useReducedMotion();
  const gesture = useRef<{ startY: number; open: boolean; samples: Array<{ t: number; y: number }> } | null>(null);
  // Тяга съела тап: отпускание после жеста не должно снова открывать шторку кликом.
  const suppressClick = useRef(false);

  const openGesture = (dy: number) => {
    // Шторка встаёт под палец ещё до монтирования и открывается без анимации.
    sheetGesture.dragging = true;
    suppressClick.current = true;
    sheetY.jump(Math.max(0, window.innerHeight + dy));
    setFullscreen(true);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.isPrimary === false || e.button !== 0 || reducedMotion || !track) return;
    // Play и полоска перемотки работают как раньше; остальная площадь мини-плеера
    // (обложка, название, фон) — ручка шторки.
    if ((e.target as HTMLElement).closest(`[role="slider"], .${s.miniPlay}`)) return;
    suppressClick.current = false;
    gesture.current = { startY: e.clientY, open: false, samples: [{ t: e.timeStamp, y: e.clientY }] };
    // Захват указателя: шторка наедет на палец, а события продолжат приходить сюда.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // pointerdown без активного указателя (синтетическое событие, jsdom)
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const dy = e.clientY - g.startY;
    if (!g.open) {
      // Пока тяга меньше порога — это ещё возможный тап, шторку не трогаем.
      if (dy > -DRAG_OPEN_START_PX) return;
      openGesture(dy);
      g.open = true;
    } else {
      // Медленно тянет — шторка медленно открывается: один к одному за пальцем.
      sheetY.jump(Math.max(0, window.innerHeight + dy));
    }
    g.samples.push({ t: e.timeStamp, y: e.clientY });
  };

  const onGestureEnd = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.open) return;
    sheetGesture.dragging = false;
    // Точка отпускания — в выборку: без неё долгая пауза перед отпусканием
    // считалась бы рывком по устаревшим точкам.
    g.samples.push({ t: e.timeStamp, y: e.clientY });
    const pulled = g.startY - e.clientY > window.innerHeight * OPEN_DISTANCE_FRACTION;
    if (pulled || flingVelocity(g.samples) < -OPEN_FLING_V_PXMS) {
      void animate(sheetY, 0, { duration: 0.4, ease: [0.32, 0.72, 0, 1] });
    } else {
      // Не дожал: шторка уезжает вниз с того места, где её отпустили (exit).
      setFullscreen(false);
    }
  };

  // Клик доезжает до корня только когда указатель был захвачен (правило общего
  // предка): тап по кнопке «сейчас играет» там уже отработал своим onClick.
  const onRootClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (track) setFullscreen(true);
  };

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
    <div
      className={s.mini}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onGestureEnd}
      onPointerCancel={onGestureEnd}
      onClick={onRootClick}
    >
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
        <div className={cx(s.thumb, s.miniThumb)}>{track && <CoverThumb host={track.host} releaseId={track.releaseId || track.id} seed={track.releaseId || track.id} className={s.thumbArt} />}</div>
        <div className={s.nowText}>
          <span className={cx(s.miniTitle, 'ellipsis')}>{track?.title ?? 'Очередь пуста'}</span>
          <span className={cx(s.nowSub, 'ellipsis')} style={error ? { color: 'var(--accent-text)' } : undefined}>
            {error || (loading ? 'загрузка с узла…' : track ? track.artist : 'выбери трек в каталоге')}
          </span>
        </div>
      </button>
      <button type="button" className={cx(s.playBtn, s.miniPlay)} onClick={toggle} aria-label={playing ? 'Пауза' : 'Играть'}>
        {playing ? <PauseIcon size={17} /> : <PlayIcon size={17} />}
      </button>
    </div>
  );
}
