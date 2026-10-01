import { useEffect, useRef, useState } from 'react';
import { errorText, nodeApi } from '../api';
import { useCurrentTrack, usePlayer } from '../store/player';

type Source =
  | { kind: 'pending' }
  /** Поток с узла — позиция из timeupdate */
  | { kind: 'audio'; url: string }
  /** Потока нет (мок, локальный трек без файла) — позиция по часам */
  | { kind: 'clock' }
  | { kind: 'error' };

/** Единственный источник времени воспроизведения. */
export function AudioEngine() {
  const track = useCurrentTrack();
  const playing = usePlayer((p) => p.playing);
  const seekNonce = usePlayer((p) => p.seekNonce);
  const volume = usePlayer((p) => p.volume);
  const muted = usePlayer((p) => p.muted);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [source, setSource] = useState<Source>({ kind: 'pending' });

  const trackId = track?.id;
  const host = track?.host;

  // Получить поток при смене трека.
  useEffect(() => {
    const { setMedia } = usePlayer.getState();
    setMedia({ mediaDuration: 0, error: '', loading: false });
    if (!trackId) return setSource({ kind: 'pending' });
    if (!host) return setSource({ kind: 'clock' });

    let cancelled = false;
    setSource({ kind: 'pending' });
    setMedia({ loading: true });
    nodeApi
      .stream(host, trackId)
      .then((u) => {
        if (cancelled) return;
        setMedia({ loading: false });
        setSource(u ? { kind: 'audio', url: u } : { kind: 'clock' });
      })
      .catch((e) => {
        if (cancelled) return;
        setMedia({ loading: false, playing: false, error: errorText(e) });
        setSource({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [trackId, host]);

  // Поток: play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (source.kind !== 'audio' || !audio) return;
    if (playing) audio.play().catch(() => usePlayer.getState().setMedia({ playing: false }));
    else audio.pause();
  }, [playing, source]);

  // Поток: seek из стора
  useEffect(() => {
    const audio = audioRef.current;
    if (source.kind !== 'audio' || !audio) return;
    audio.currentTime = usePlayer.getState().position;
  }, [seekNonce, source]);

  // Поток: громкость. Квадрат положения регулятора — на слух ход равномернее линейного.
  // В iOS Safari audio.volume только для чтения, работает лишь muted.
  useEffect(() => {
    const audio = audioRef.current;
    if (source.kind !== 'audio' || !audio) return;
    audio.volume = volume * volume;
    audio.muted = muted;
  }, [volume, muted, source]);

  // Без потока: часы
  useEffect(() => {
    if (source.kind !== 'clock' || !playing || !track) return;
    if (!track.durationSec) return usePlayer.getState().setMedia({ playing: false });
    const started = performance.now();
    const from = usePlayer.getState().position;
    const id = setInterval(() => {
      const pos = from + (performance.now() - started) / 1000;
      if (pos >= track.durationSec) usePlayer.getState().trackEnded();
      else usePlayer.getState().tick(pos);
    }, 250);
    return () => clearInterval(id);
  }, [source, playing, track, seekNonce]);

  if (source.kind !== 'audio') return null;
  return (
    <audio
      ref={audioRef}
      src={source.url}
      preload="metadata"
      onLoadedMetadata={(e) => {
        const d = e.currentTarget.duration;
        if (Number.isFinite(d) && d > 0) usePlayer.getState().setMedia({ mediaDuration: d });
      }}
      onTimeUpdate={(e) => usePlayer.getState().tick(e.currentTarget.currentTime)}
      onEnded={() => {
        const st = usePlayer.getState();
        st.trackEnded();
        // При повторе трека <audio> сам не отматывается — рестартуем вручную.
        if (st.repeat === 'one' && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
      }}
      onError={() => usePlayer.getState().setMedia({ playing: false, error: 'файл трека не воспроизводится: формат не поддерживается или файл повреждён' })}
    />
  );
}
