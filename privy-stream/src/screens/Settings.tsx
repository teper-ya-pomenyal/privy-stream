import { useSettings } from '../store/settings';
import { cx, Screen, ScreenHeader } from '../ui';
import s from './screens.module.css';

export function Settings() {
  const { dense, setDense, theme, setTheme } = useSettings();

  return (
    <Screen>
      <ScreenHeader title="Настройки" sub="Клиент хранит всё на устройстве" />
      <div className={s.settingsList}>
        <div className={s.settingRow}>
          <div className={s.settingText}>
            <span className={s.settingName}>Тема</span>
            <span className={s.settingSub}>светлая «фонотека» или тёмный графит</span>
          </div>
          <div className={s.segmented} role="radiogroup">
            {(
              [
                ['light', 'Светлая'],
                ['dark', 'Тёмная'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme === value}
                className={cx(s.segment, theme === value && s.segmentOn)}
                onClick={() => setTheme(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={s.settingRow}>
          <div className={s.settingText}>
            <span className={s.settingName}>Плотность интерфейса</span>
            <span className={s.settingSub}>отступы экранов, строк списков и размер карточек каталога</span>
          </div>
          <div className={s.segmented} role="radiogroup">
            {[
              [false, 'Воздушно'],
              [true, 'Плотно'],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                role="radio"
                aria-checked={dense === value}
                className={cx(s.segment, dense === value && s.segmentOn)}
                onClick={() => setDense(value as boolean)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={s.settingRow}>
          <div className={s.settingText}>
            <span className={s.settingName}>История прослушиваний</span>
            <span className={s.settingSub}>
              клиент историю не пишет и телеметрию не отправляет; при воспроизведении узел увеличивает только счётчик трека
            </span>
          </div>
          <span className={s.settingState}>ВЫКЛ</span>
        </div>
      </div>
    </Screen>
  );
}
