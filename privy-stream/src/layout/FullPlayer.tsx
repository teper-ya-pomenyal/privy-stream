import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { fmtTime, trackNum } from '../lib/format';
import { shareOrCopy } from '../lib/share';
import { IS_WEB } from '../platform/mode';
import { useCurrentTrack, useDuration, usePlayer } from '../store/player';
import { useActiveNode } from '../store/servers';
import { CoverThumb, cx, HeartIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, ShareIcon, TextLink } from '../ui';
import { RepeatControl, SeekBar, ShuffleControl, VolumeControl } from './PlayerBar';
import s from './layout.module.css';

/**
 * Полноэкранный плеер-шторка: открывается снизу и так же уезжает обратно
 * (AnimatePresence в AppShell держит его в дереве на время выезда).
 * При reduced motion — мгновенно, без трансформа.
 */
export function FullPlayer() {
  const track = useCurrentTrack();
  const setFullscreen = usePlayer((p) => p.setFullscreen);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullscreen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setFullscreen]);

  if (!track) return null;
  if (reducedMotion) return <div className={s.full}><FullPlayerBody /></div>;

  return (
    <motion.div
      className={s.full}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
    >
      <FullPlayerBody />
    </motion.div>
  );
}

function FullPlayerBody() {
  const track = useCurrentTrack();
  const node = useActiveNode();
  const { queue, index, playing, position, error, toggle, next, prev, seek, play, setFullscreen } = usePlayer();
  const duration = useDuration();
  // Внешний компонент рендерит тело только при наличии трека, но свой guard нужен TS.
  if (!track) return null;

  return (
    <>
      <div className={s.fullBar}>
        <div className={s.fullBarLabel}>СЕЙЧАС ИГРАЕТ</div>
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
                  <>
                    <span className={s.heroFavSoon} role="img" aria-label="Лайк трека — скоро" title="Лайк трека — скоро">
                      <HeartIcon size={17} />
                      <span>скоро</span>
                    </span>
                    <HeroShare title={track.title} artist={track.artist} host={node.host} />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className={s.waveWrap}>
            <SeekBar className={s.fullSeek} fillClassName={s.fullSeekFill} thumbClassName={s.fullSeekThumb} position={position} duration={duration} disabled={!duration} onSeek={seek} />
            <div className={s.waveMeta}>
              <span>{fmtTime(position)}</span>
              <span style={{ color: error ? 'var(--accent-text)' : 'var(--text-5)' }}>
                {error || (track.format ? `${track.format} · поток с узла` : track.host ? 'поток с узла' : 'локальный трек')}
              </span>
              <span>{fmtTime(duration)}</span>
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

/** «Поделиться» у артиста: текст трека — в системный шер, иначе в буфер обмена. */
function HeroShare({ title, artist, host }: { title: string; artist: string; host: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const share = async () => {
    const url = location.protocol.startsWith('http') ? location.href : '';
    const text = [`«${title}» — ${artist} · Privy Stream`, `Узел: ${host}`, url].filter(Boolean).join('\n');
    if ((await shareOrCopy(text, title, url || undefined)) === 'copied') {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button type="button" className={s.heroShare} onClick={share} title="Поделиться треком">
      <ShareIcon size={13} />
      <span>{copied ? 'скопировано' : 'поделиться'}</span>
    </button>
  );
}
