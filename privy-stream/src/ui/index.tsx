import { useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { motion } from 'motion/react';
import type { NodeInfo, Track } from '../api';
import { fmtTime, trackNum } from '../lib/format';
import { useCurrentTrack } from '../store/player';
import s from './ui.module.css';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** Адрес узла для показа: без схемы (https://node.example → node.example). */
export const hostLabel = (host: string) => host.replace(/^https?:\/\//, '');

export function Logo({ small }: { small?: boolean }) {
  return (
    <div className={cx(s.logo, small && s.logoSm)}>
      <div className={s.logoMark} />
      <div className={s.logoText}>
        PRIVY<span className={s.logoSlash}>/</span>STREAM
      </div>
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'accent' | 'outline' | 'quiet';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  selected?: boolean;
};

export function Button({ variant = 'outline', size = 'md', selected, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cx(s.btn, s[variant], s[size], selected && s.selected, className)} {...rest} />;
}

export function TextLink({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cx(s.link, className)} {...rest} />;
}

export function Field({ label, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={s.field}>
      <span className="t-label">{label}</span>
      <input className={s.input} spellCheck={false} autoComplete="off" {...input} />
    </label>
  );
}

/** Поле пароля с кнопкой-глазом: показать введённое, чтобы проверить опечатки. */
export function PasswordField({ label, ...input }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string }) {
  const [shown, setShown] = useState(false);
  return (
    <label className={s.field}>
      <span className="t-label">{label}</span>
      <div className={s.passWrap}>
        <input className={cx(s.input, s.passInput)} type={shown ? 'text' : 'password'} spellCheck={false} autoComplete="off" {...input} />
        <button
          type="button"
          className={s.eye}
          aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'}
          aria-pressed={shown}
          title={shown ? 'Скрыть пароль' : 'Показать пароль'}
          // Фокус и курсор остаются в поле
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShown((v) => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {!shown && <path d="M4 20 20 4" />}
          </svg>
        </button>
      </div>
    </label>
  );
}

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const daysIn = (month: number, year: number) => new Date(year, month, 0).getDate();

/** Дата по частям: пустая строка — часть ещё не выбрана. Месяц 1–12. */
export type DateParts = { day: string; month: string; year: string };

/** YYYY-MM-DD для API или null, пока дата не выбрана целиком. */
export function isoDate({ day, month, year }: DateParts): string | null {
  if (!day || !month || !year) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function Select({
  placeholder,
  options,
  ...select
}: SelectHTMLAttributes<HTMLSelectElement> & { placeholder: string; options: [string, string][] }) {
  return (
    <div className={s.selectWrap}>
      <select className={cx(s.input, s.select, !select.value && s.selectEmpty)} {...select}>
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Сколько месяцев и дней можно выбрать при уже выбранных частях: будущих дат в списках нет. */
function dateLimits({ month, year }: DateParts, today: Date) {
  const thisYear = year === String(today.getFullYear());
  const maxMonth = thisYear ? today.getMonth() + 1 : 12;
  // Пока месяц не выбран — 31 день; год нужен только для 29 февраля.
  let maxDay = month ? daysIn(Number(month), Number(year) || 2000) : 31;
  if (thisYear && Number(month) === maxMonth) maxDay = today.getDate();
  return { maxMonth, maxDay };
}

/** Дата в порядке ДД.ММ.ГГГГ — три выпадающих списка: день, месяц, год. Будущую дату выбрать нельзя. */
export function DateField({ label, value, onChange }: { label: string; value: DateParts; onChange: (v: DateParts) => void }) {
  const today = new Date();
  const thisYear = today.getFullYear();
  const { maxMonth, maxDay } = dateLimits(value, today);

  const set = (patch: Partial<DateParts>) => {
    const next = { ...value, ...patch };
    const lim = dateLimits(next, today);
    // Выбор года сделал месяц или день будущим — сбрасываем, чтобы это было видно.
    if (Number(next.month) > lim.maxMonth) next.month = next.day = '';
    else if (next.day && next.month) {
      const monthDays = daysIn(Number(next.month), Number(next.year) || 2000);
      // 31 → 30 при смене месяца, 29 февраля → 28 в невисокосный год.
      if (Number(next.day) > monthDays) next.day = String(monthDays);
      else if (Number(next.day) > lim.maxDay) next.day = '';
    }
    onChange(next);
  };

  return (
    <div className={s.field}>
      <span className="t-label">{label}</span>
      <div className={s.dateRow}>
        <Select
          aria-label="День"
          placeholder="день"
          value={value.day}
          onChange={(e) => set({ day: e.target.value })}
          options={range(1, maxDay).map((d) => [String(d), String(d).padStart(2, '0')])}
        />
        <Select
          aria-label="Месяц"
          placeholder="месяц"
          value={value.month}
          onChange={(e) => set({ month: e.target.value })}
          options={MONTHS.slice(0, maxMonth).map((m, i) => [String(i + 1), m])}
        />
        <Select
          aria-label="Год"
          placeholder="год"
          value={value.year}
          onChange={(e) => set({ year: e.target.value })}
          options={range(thisYear - 100, thisYear)
            .reverse()
            .map((y) => [String(y), String(y)])}
        />
      </div>
    </div>
  );
}

export function PrefixedInput({
  prefix,
  suffix,
  className,
  style,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { prefix: string; suffix?: ReactNode }) {
  return (
    <div className={cx(s.prefixed, className)} style={style}>
      <span className={s.prefix}>{prefix}</span>
      <input className={s.bareInput} spellCheck={false} autoComplete="off" {...input} />
      {suffix != null && <span className={s.suffix}>{suffix}</span>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className={s.error} role="alert">
      {children}
    </div>
  );
}

export type NodeVisualState = 'active' | 'connecting' | 'online' | 'offline';

export function nodeState(node: NodeInfo, activeId: string, connectingId: string | null): NodeVisualState {
  if (connectingId === node.id) return 'connecting';
  if (node.status !== 'online') return 'offline';
  return node.id === activeId ? 'active' : 'online';
}

export const NODE_STATUS: Record<NodeVisualState, { label: string; color: string; dot: string }> = {
  active: { label: 'ПОДКЛЮЧЁН', color: 'var(--accent)', dot: 'var(--accent)' },
  connecting: { label: 'ПОДКЛЮЧЕНИЕ…', color: 'var(--warn)', dot: 'var(--ok)' },
  online: { label: 'ДОСТУПЕН', color: 'var(--ok)', dot: 'var(--ok)' },
  offline: { label: 'НЕ ОТВЕЧАЕТ', color: 'var(--text-5)', dot: 'var(--dot-off)' },
};

export function StatusDot({ color, blink, size = 7, style }: { color: string; blink?: string; size?: number; style?: CSSProperties }) {
  return (
    <div
      className={s.dot}
      style={{ width: size, height: size, background: color, animation: blink ? `pv-blink ${blink} infinite` : undefined, ...style }}
    />
  );
}

export function Cover({
  caption,
  code,
  flagged,
  src,
  className,
  style,
}: {
  caption?: ReactNode;
  code?: string;
  flagged?: boolean;
  /** Реальная обложка с узла; без неё остаётся плейсхолдер. */
  src?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cx(s.cover, className)} style={style}>
      {src ? <img className={s.coverImg} src={src} alt="" /> : caption && <span className={s.coverCaption}>{caption}</span>}
      {code && <span className={s.coverCode}>{code}</span>}
      {flagged && <span className={s.coverFlag}>18+</span>}
    </div>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className={s.screen}>{children}</div>;
}

export function ScreenHeader({ eyebrow, title, aside }: { eyebrow: ReactNode; title: ReactNode; aside?: ReactNode }) {
  return (
    <div className={s.screenHeader}>
      <div className={s.screenTitle}>
        <div className="t-eyebrow">{eyebrow}</div>
        <h2 className="t-h2">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

export function EmptyState({ label, text, action }: { label: string; text: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.empty}>
      <div className="t-label" style={{ letterSpacing: '.18em' }}>
        {label}
      </div>
      <div className={s.emptyText}>{text}</div>
      {action}
    </div>
  );
}

export function Skeleton({ style }: { style?: CSSProperties }) {
  return <div className={s.skel} style={style} />;
}

/**
 * Таблица треков.
 * release — треклист релиза (с подписью «артист»; формат — в своей колонке), popular — без подписи,
 * library — шесть колонок фонотеки.
 */
export function TrackTable({
  tracks,
  variant,
  onPlay,
  header = true,
}: {
  tracks: Track[];
  variant: 'release' | 'popular' | 'library';
  onPlay: (t: Track) => void;
  header?: boolean;
}) {
  const current = useCurrentTrack();
  const cols = variant === 'library' ? s.colsLibrary : s.colsRelease;
  return (
    <div>
      {header && (
        <div className={cx(s.trackHead, cols)}>
          <span>#</span>
          <span>НАЗВАНИЕ</span>
          {variant === 'library' && (
            <>
              <span className={s.libOnly}>АРТИСТ</span>
              <span className={s.libOnly}>РЕЛИЗ</span>
            </>
          )}
          <span>ФОРМАТ</span>
          <span className={s.right}>ВРЕМЯ</span>
        </div>
      )}
      {tracks.map((t, i) => {
        const playing = current?.id === t.id;
        return (
          <button key={t.id} type="button" className={cx(s.trackRow, cols, playing && s.playing)} onClick={() => onPlay(t)}>
            {/* Подсветка играющего трека переезжает к новой строке (Motion layoutId):
                видно, что именно заиграло после клика или переключения. */}
            {playing && (
              <motion.span aria-hidden="true" className={s.playingBg} layoutId="pv-playing-row" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
            )}
            <span className={s.tNum}>{trackNum(i)}</span>
            {variant === 'release' ? (
              <span className={s.tTitleCell}>
                <span className={cx(s.tTitle, 'ellipsis')}>{t.title}</span>
                {/* Формат уже есть в своей колонке — под названием только артист. */}
                <span className={s.tSub}>{t.artist}</span>
              </span>
            ) : variant === 'library' ? (
              <span className={s.tTitleCell}>
                <span className={cx(s.tTitle, 'ellipsis')}>{t.title}</span>
                {/* На телефоне колонки артиста и релиза скрыты — показываем их строкой под названием */}
                <span className={cx(s.tSub, s.mobileOnly, 'ellipsis')}>{[t.artist, t.release].filter(Boolean).join(' · ')}</span>
              </span>
            ) : (
              <span className={cx(s.tTitle, 'ellipsis')}>{t.title}</span>
            )}
            {variant === 'library' && (
              <>
                <span className={cx(s.tArtist, s.libOnly, 'ellipsis')}>{t.artist}</span>
                <span className={cx(s.tRelease, s.libOnly, 'ellipsis')}>{t.release}</span>
              </>
            )}
            <span className={s.tFmt}>{t.format ?? (t.explicit ? '18+' : '—')}</span>
            <span className={s.tDur}>{fmtTime(t.durationSec)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TrackTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={cx(s.trackRow, s.colsRelease)} style={{ cursor: 'default' }}>
          <Skeleton style={{ height: 10, width: 16 }} />
          <Skeleton style={{ height: 12, width: `${60 - i * 6}%` }} />
          <Skeleton style={{ height: 10, width: 32 }} />
          <Skeleton style={{ height: 10, width: 30, justifySelf: 'end' }} />
        </div>
      ))}
    </div>
  );
}
