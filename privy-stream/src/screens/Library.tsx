import { useLibrary } from '../api/queries';
import { plural } from '../lib/format';
import { usePlayer } from '../store/player';
import { Screen, ScreenHeader, TrackTable, TrackTableSkeleton } from '../ui';
import s from './screens.module.css';

export function Library() {
  const library = useLibrary();
  const play = usePlayer((p) => p.play);
  const tracks = library.data ?? [];

  return (
    <Screen>
      <ScreenHeader
        title="Фонотека"
        sub={
          <>
            Локальное хранилище устройства · не индексируется узлом
            {library.data && (
              <>
                {' · '}
                {tracks.length} {plural(tracks.length, ['трек', 'трека', 'треков'])}
              </>
            )}
          </>
        }
      />
      <div className={s.tracksList}>
        {library.data ? (
          <TrackTable variant="library" tracks={tracks} onPlay={(t) => play(t, tracks)} />
        ) : (
          <TrackTableSkeleton rows={9} />
        )}
      </div>
    </Screen>
  );
}
