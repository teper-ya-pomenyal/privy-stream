import { useNavigate } from 'react-router';
import { plural } from '../lib/format';
import { useFavControl, useFavorites, useFavoritesHydrated } from '../store/favorites';
import { usePlayer } from '../store/player';
import { Button, EmptyState, Screen, ScreenHeader, TrackTable, TrackTableSkeleton } from '../ui';
import s from './screens.module.css';

export function Library() {
  const navigate = useNavigate();
  const hydrated = useFavoritesHydrated();
  const ids = useFavorites((f) => f.ids);
  const snapshots = useFavorites((f) => f.tracks);
  const fav = useFavControl();
  const play = usePlayer((p) => p.play);

  // Порядок из списка UUID; снимки под капотом дают название/артиста/время.
  const tracks = ids.map((id) => snapshots[id]).filter((t) => t != null);

  return (
    <Screen>
      <ScreenHeader
        title="Фонотека"
        sub={
          <>
            Избранные треки · хранятся на устройстве
            {tracks.length > 0 && (
              <>
                {' · '}
                {tracks.length} {plural(tracks.length, ['трек', 'трека', 'треков'])}
              </>
            )}
          </>
        }
      />
      <div className={s.tracksList}>
        {!hydrated ? (
          <TrackTableSkeleton rows={9} />
        ) : tracks.length ? (
          <TrackTable variant="library" tracks={tracks} onPlay={(t) => play(t, tracks)} fav={fav} />
        ) : (
          <EmptyState
            label="ФОНОТЕКА ПУСТА"
            text="Отмечай треки сердечком в треклистах релизов — они соберутся здесь. Список хранится на устройстве и не уходит на узел."
            action={
              <Button size="sm" onClick={() => navigate('/catalog')}>
                К поиску по узлу
              </Button>
            }
          />
        )}
      </div>
    </Screen>
  );
}
