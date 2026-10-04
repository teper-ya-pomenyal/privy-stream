import { useEffect, useLayoutEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  type MotionValue,
  type PanInfo,
} from 'motion/react';
import { fmtTime, trackNum } from '../lib/format';
import { shouldClose } from '../lib/sheetClose';
import { useMobile } from '../lib/useMobile';
import { IS_WEB } from '../platform/mode';
import type { Track } from '../api/types';
import { useCurrentTrack, useDuration, usePlayer } from '../store/player';
import { useShareSheet } from '../store/shareSheet';
import { useActiveNode } from '../store/servers';
import { CoverThumb, cx, HeartIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, ShareIcon, TextLink } from '../ui';
import { RepeatControl, SeekBar, ShuffleControl, VolumeControl } from './PlayerBar';
import { sheetGesture } from './sheetGesture';
import s from './layout.module.css';

/**
 * Полноэкранный плеер-шторка: открывается снизу и так же уезжает обратно
 * (AnimatePresence в AppShell держит его в дереве на время выезда).
 * Позиция — внешний MotionValue: на мобильном мини-плеер ведёт её пальцем
 * при открытии, а саму шторку можно закрыть, потянув вниз за верхнюю панель.
 * При reduced motion — мгновенно, без трансформа.
 */
export function FullPlayer({ sheetY: externalY }: { sheetY?: MotionValue<string | number> } = {}) {
  const track = useCurrentTrack();
  const setFullscreen = usePlayer((p) => p.setFullscreen);
  const open = usePlayer((p) => p.fullscreen);
  const reducedMotion = useReducedMotion();
  const mobile = useMobile();
  const fallbackY = useMotionValue<string | number>('100%');
  const sheetY = externalY ?? fallbackY;
  const dragControls = useDragControls();
  // Флаг гасится на время выезда: drag не должен перехватывать y у exit-анимации,
  // иначе AnimatePresence не дождётся её конца и шторка-призрак останется в DOM.
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    // Пока поверх плеера открыта шторка «Поделиться», Escape закрывает только её.
    const onKey = (e: KeyboardEvent) => {
      if (useShareSheet.getState().target) return;
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setFullscreen]);

  useEffect(() => {
    if (open) setClosing(false);
  }, [open]);

  // Шторку смонтировали прямо под пальцем (тянут из мини-плеера): стартовую
  // анимацию к нулю гасим — позицией уже управляет жест. Флаг разовый.
  useLayoutEffect(() => {
    if (sheetGesture.dragging) sheetY.stop();
    sheetGesture.dragging = false;
  }, [sheetY]);

  // Отпустили далеко вниз или резко дёрнули — закрываем; иначе Motion
  // сам вернёт шторку пружиной к открытому состоянию (dragConstraints).
  const onDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (shouldClose(info, window.innerHeight)) {
      setClosing(true);
      setFullscreen(false);
    }
  };

  if (!track) return null;
  if (reducedMotion) return <div className={s.full}><FullPlayerBody dragControls={dragControls} sheetY={sheetY} /></div>;

  return (
    <motion.div
      className={s.full}
      style={{ y: sheetY }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      drag={mobile && !closing ? 'y' : false}
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 1 }}
      dragMomentum={false}
      onDragEnd={mobile && !closing ? onDragEnd : undefined}
    >
      <FullPlayerBody dragControls={dragControls} sheetY={sheetY} />
    </motion.div>
  );
}

function FullPlayerBody({ dragControls, sheetY }: { dragControls: ReturnType<typeof useDragControls>; sheetY: MotionValue<string | number> }) {
  const track = useCurrentTrack();
  const node = useActiveNode();
  const { queue, index, playing, position, error, toggle, next, prev, seek, play, setFullscreen } = usePlayer();
  const duration = useDuration();
  // Внешний компонент рендерит тело только при наличии трека, но свой guard нужен TS.
  if (!track) return null;

  // Ручка шторки — верхняя панель: тяга вниз закрывает плеер. Кнопка «Свернуть»
  // остаётся обычным тапом, содержимое ниже не участвует — там скроллится очередь.
  const startCloseDrag = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    // Палец перехватывает позицию у доигрывающей анимации открытия: без остановки
    // Motion не начинает drag на анимируемом элементе и тяга молчаливо теряется.
    sheetY.stop();
    dragControls.start(e);
  };

  return (
    <>
      <div className={s.fullBar} onPointerDown={startCloseDrag}>
        <div className={s.fullBarLabel}>СЕЙЧАС ИГРАЕТ</div>
        <span className={s.grabber} aria-hidden="true" />
        <TextLink onClick={() => setFullscreen(false)}>Свернуть</TextLink>
      </div>

      <div className={s.fullBody}>
        <div className={s.fullMain}>
          <div className={s.hero}>
            <div className={s.heroCover}>
              <CoverThumb host={track.host} releaseId={track.releaseId || track.id} seed={track.releaseId || track.id} className={s.heroArt} />
            </div>
            <div className={s.heroText}>
              {track.release && <div className={s.heroRelease}>{track.release}</div>}
              <h2 className={s.heroTitle}>{track.title}</h2>
              <div className={s.heroArtistRow}>
                <span className={s.heroArtist}>{track.artist}</span>
                {IS_WEB && (
                  <span className={s.heroFavSoon} role="img" aria-label="Лайк трека — скоро" title="Лайк трека — скоро">
                    <HeartIcon size={17} />
                    <span>скоро</span>
                  </span>
                )}
                <HeroShare track={track} />
              </div>
            </div>
          </div>

          <div className={s.waveWrap}>
            <SeekBar className={s.fullSeek} fillClassName={s.fullSeekFill} thumbClassName={s.fullSeekThumb} position={position} duration={duration} disabled={!duration} onSeek={seek} />
            <div className={s.waveMeta}>
              <span className={s.waveTime}>{fmtTime(position)}</span>
              <span className={s.waveSrc} title={error || undefined} style={error ? { color: 'var(--accent-text)' } : undefined}>
                {error || (track.format ? `${track.format} · поток с узла` : track.host ? 'поток с узла' : 'локальный трек')}
              </span>
              <span className={s.waveTime}>{fmtTime(duration)}</span>
            </div>
          </div>

          {/* Ряд как в привычных плеерах: по центру кластер «перемешать · назад ·
              play · дальше · повтор» (на одной вертикали с «поток с узла»), громкость —
              отдельно у правого края, её полоса — поповер. */}
          <div className={s.fullTransport}>
            <div className={s.transportCluster}>
              <ShuffleControl className={s.repBtn} />
              <button type="button" className={s.iconBtn} onClick={prev} aria-label="Предыдущий">
                <PrevIcon size={18} />
              </button>
              <button type="button" className={s.fullPlay} onClick={toggle} aria-label={playing ? 'Пауза' : 'Играть'}>
                {playing ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
              </button>
              <button type="button" className={s.iconBtn} onClick={next} aria-label="Следующий">
                <NextIcon size={18} />
              </button>
              <RepeatControl className={s.repBtn} />
            </div>
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
    </>
  );
}

/** «Поделиться» у артиста: открывает шторку ShareSheet за текущий трек. */
function HeroShare({ track }: { track: Track }) {
  const open = useShareSheet((st) => st.open);
  return (
    <button type="button" className={s.heroShare} onClick={() => open({ kind: 'track', track })} title="Поделиться треком">
      <ShareIcon size={13} />
      <span>поделиться</span>
    </button>
  );
}
