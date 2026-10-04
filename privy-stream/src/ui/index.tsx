import { useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { NodeInfo, Track } from '../api';
import { useCoverUrl } from '../api/queries';
import { fmtTime, trackNum } from '../lib/format';
import { useCurrentTrack, usePlayer } from '../store/player';
import { useSettings } from '../store/settings';
import type { FavControl } from '../store/favorites';
import s from './ui.module.css';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/**
 * Транспортные и служебные значки — SVG, а не символы ▶/❙/◀: в шрифтах
 * приложения таких глифов нет, и iOS во всех браузерах подменяет их эмодзи.
 * Один набор: чистый контур 1.6, скруглённые концы.
 */
type IconProps = { size?: number };

export function PlayIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l10.5-6.5z" />
    </svg>
  );
}

export function PauseIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7.5 5.5h3.4v13H7.5zM13.1 5.5h3.4v13h-3.4z" />
    </svg>
  );
}

export function PrevIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 5.5h2.2v13H6zM19 5.8v12.4L9.9 12z" />
    </svg>
  );
}

export function NextIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M15.8 5.5H18v13h-2.2zM5 5.8v12.4L14.1 12z" />
    </svg>
  );
}

export function ShareIcon({ size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="17.5" cy="5.5" r="2.6" />
      <circle cx="17.5" cy="18.5" r="2.6" />
      <path d="M8.4 10.8l6.8-4M8.4 13.2l6.8 4" />
    </svg>
  );
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Ico({ size = 20, d }: IconProps & { d: string[] }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      {d.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

export const SearchIcon = ({ size }: IconProps) => <Ico size={size} d={['M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Z', 'm15.5 15.5 4.5 4.5']} />;
export const CloseIcon = ({ size }: IconProps) => <Ico size={size} d={['m6 6 12 12', 'm18 6-12 12']} />;
export const ChevronRightIcon = ({ size }: IconProps) => <Ico size={size} d={['m9 5 7 7-7 7']} />;
export const ChevronDownIcon = ({ size }: IconProps) => <Ico size={size} d={['m5 9 7 7 7-7']} />;
export const BackIcon = ({ size }: IconProps) => <Ico size={size} d={['M19 12H5', 'm11 6-6 6 6 6']} />;
export const CatalogIcon = ({ size }: IconProps) => <Ico size={size} d={['M4 5h16', 'M4 12h16', 'M4 19h10']} />;
export const NodesIcon = ({ size }: IconProps) => <Ico size={size} d={['M4 5.5h16v5H4z', 'M4 13.5h16v5H4z', 'M7.2 8h.01', 'M7.2 16h.01']} />;
export const LibraryIcon = ({ size }: IconProps) => <Ico size={size} d={['M5 4v16', 'M10 4v16', 'M15 5l4.2 14.4']} />;
export const GearIcon = ({ size }: IconProps) => (
  <Ico
    size={size}
    d={[
      'M12 3.6c.5 0 1 .04 1.47.13l.5 2.05c.52.15 1 .37 1.45.64l1.83-1.1c.74.56 1.38 1.23 1.9 1.98l-1.13 1.8c.27.45.47.95.6 1.47l2.04.5a8.6 8.6 0 0 1 0 2.9l-2.05.5a6 6 0 0 1-.63 1.45l1.1 1.83a8.5 8.5 0 0 1-1.99 1.9l-1.8-1.13a6 6 0 0 1-1.46.61l-.5 2.04a8.6 8.6 0 0 1-2.9 0l-.5-2.05a6 6 0 0 1-1.45-.63l-1.83 1.1a8.5 8.5 0 0 1-1.9-1.99l1.13-1.8a6 6 0 0 1-.6-1.46l-2.04-.5a8.6 8.6 0 0 1 0-2.9l2.05-.5c.14-.51.35-1 .63-1.45L4.8 8.66a8.5 8.5 0 0 1 1.99-1.9l1.8 1.13a6 6 0 0 1 1.46-.61l.5-2.04c.47-.09.96-.13 1.45-.13Z',
      'M12 9.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z',
    ]}
  />
);
export const QueueIcon = ({ size }: IconProps) => <Ico size={size} d={['M4 6h12', 'M4 12h12', 'M4 18h8', 'M19 10v8.2', 'm16.4 16.4 2.6 2.6 2.6-2.6']} />;
export const SunIcon = ({ size }: IconProps) => (
  <Ico
    size={size}
    d={[
      'M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z',
      'M12 2.6v2.2',
      'M12 19.2v2.2',
      'm4.6 4.6 1.6 1.6',
      'm17.8 17.8 1.6 1.6',
      'M2.6 12h2.2',
      'M19.2 12h2.2',
      'm6.2 17.8-1.6 1.6',
      'm19.4 4.6-1.6 1.6',
    ]}
  />
);
export const MoonIcon = ({ size }: IconProps) => <Ico size={size} d={['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z']} />;
/** Сердечко избранного: контур, а в избранном — залитое акцентом. */
export const HeartIcon = ({ size, filled = false }: IconProps & { filled?: boolean }) =>
  filled ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ) : (
    <Ico size={size} d={['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z']} />
  );
export const RepeatIcon = ({ size }: IconProps) => (
  <Ico size={size} d={['m17 2 4 4-4 4', 'M3 11v-1a4 4 0 0 1 4-4h14', 'm7 22-4-4 4-4', 'M21 13v1a4 4 0 0 1-4 4H3']} />
);
/** Повтор одной композиции — та же стрелка с единицей в центре. */
export const RepeatOneIcon = ({ size }: IconProps) => (
  <Ico size={size} d={['m17 2 4 4-4 4', 'M3 11v-1a4 4 0 0 1 4-4h14', 'm7 22-4-4 4-4', 'M21 13v1a4 4 0 0 1-4 4H3', 'M11.5 10h1v4']} />
);
/** Перемешивание — две перекрёстные стрелки (feather shuffle). */
export const ShuffleIcon = ({ size }: IconProps) => (
  <Ico size={size} d={['M16 3h5v5', 'M4 20 21 3', 'M21 16v5h-5', 'm15 15 6 6', 'M4 4l5 5']} />
);

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
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
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
  active: { label: 'ПОДКЛЮЧЁН', color: 'var(--accent-text)', dot: 'var(--accent)' },
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

/* ---------- Обложки: генеративный fallback вместо «штриховки» ---------- */

/** FNV-1a: стабильный hash строки — основа детерминированной композиции. */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const mulberry32 = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* Палитры обложек по теме. Светлая — печатные тона на бумажных подложках
   (по концепту B): терракота, ржавчина, чернильный зелёный, охра, штрихи —
   чернила. Тёмная — прежние яркие тона на графите с белыми штрихами. */
const COVER_PALETTES = {
  light: {
    tones: ['#a8462c', '#b3552f', '#263c32', '#8a6a34'],
    grounds: ['#e9e5d8', '#e3dfcd', '#edeadd', '#e0e5d9'],
    ink: '#1c2f26',
  },
  dark: {
    tones: ['#d8452b', '#c9803f', '#b3552f', '#d86a3a'],
    grounds: ['#191e1c', '#161b19', '#1b201e', '#171c1a'],
    ink: '#ffffff',
  },
};

/**
 * Обложка без картинки с узла: спокойная геометрия, устойчивая к seed
 * (releaseId/trackId) — каждый релиз выглядит по-своему, без фейковых фото.
 */
export function CoverArt({ seed, className, style }: { seed: string; className?: string; style?: CSSProperties }) {
  const theme = useSettings((st) => st.theme);
  const pal = COVER_PALETTES[theme];
  const rnd = mulberry32(hashSeed(seed));
  const ground = pal.grounds[Math.floor(rnd() * pal.grounds.length)];
  const tone = pal.tones[Math.floor(rnd() * pal.tones.length)];
  const variant = Math.floor(rnd() * 4);
  const off = 18 + rnd() * 30;
  // Якорь композиции: левый-низ или правый-верх — соседние релизы меньше похожи
  const flip = rnd() > 0.5;
  const ax = flip ? 86 - rnd() * 10 : 14 + rnd() * 10;
  const ay = flip ? 14 + rnd() * 10 : 86 - rnd() * 10;

  return (
    <svg className={cx(s.coverArt, className)} style={style} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="100" height="100" fill={ground} />
      {variant === 0 && (
        <>
          <circle cx={flip ? 70 - off * 0.6 : 30 + off * 0.6} cy={flip ? 66 : 34} r={26} fill={tone} opacity="0.16" />
          <circle cx={flip ? 70 - off * 0.6 : 30 + off * 0.6} cy={flip ? 66 : 34} r={26} fill="none" stroke={tone} strokeWidth="1.4" opacity="0.85" />
          <rect x="0" y={64 + rnd() * 8} width="100" height="1.6" fill={tone} opacity="0.5" />
        </>
      )}
      {variant === 1 && (
        <>
          {[0, 1, 2, 3, 4].map((i) => {
            const x = 12 + i * 17;
            const h = 30 + rnd() * 55;
            return <rect key={i} x={x} y={100 - h} width={7} height={h} fill={i === Math.floor(rnd() * 5) ? tone : pal.ink} opacity={i % 2 ? 0.1 : 0.16} rx="1" />;
          })}
          <circle cx={50 + (rnd() - 0.5) * 30} cy={30 + rnd() * 18} r={5} fill={tone} opacity="0.9" />
        </>
      )}
      {variant === 2 && (
        <>
          {[16, 28, 40, 52].map((r, i) => (
            <circle key={r} cx={ax} cy={ay} r={r} fill="none" stroke={i === 1 ? tone : pal.ink} strokeWidth={i === 1 ? 2 : 1.2} opacity={i === 1 ? 0.8 : 0.12} />
          ))}
          <circle cx={ax + (flip ? -1 : 1) * (46 + rnd() * 12)} cy={ay + (flip ? 1 : -1) * (46 + rnd() * 8)} r={4.5} fill={tone} opacity="0.9" />
        </>
      )}
      {variant === 3 && (
        <>
          <polygon points={flip ? `100,0 0,${34 + rnd() * 20} 0,0` : `0,100 100,${34 + rnd() * 20} 100,100`} fill={tone} opacity="0.14" />
          <rect x={14 + rnd() * 58} y={16 + rnd() * 10} width="14" height="14" fill="none" stroke={tone} strokeWidth="1.6" opacity="0.9" />
          <rect x="0" y={78 + rnd() * 6} width="100" height="1.4" fill={pal.ink} opacity="0.14" />
        </>
      )}
    </svg>
  );
}

/** Аватар артиста: первая буква имени на устойчивом тоне — без фейковых фото. */
export function ArtistAvatar({ name, className }: { name: string; className?: string }) {
  const theme = useSettings((st) => st.theme);
  const tone = COVER_PALETTES[theme].tones[hashSeed(name) % COVER_PALETTES[theme].tones.length];
  const letter = [...name.trim()][0]?.toUpperCase() ?? '·';
  return (
    <span className={cx(s.avatar, className)} style={{ background: `${tone}26`, borderColor: `${tone}59`, color: tone }} aria-hidden="true">
      {letter}
    </span>
  );
}

export function Cover({
  seed,
  code,
  flagged,
  src,
  className,
  style,
}: {
  /** Стабильный идентификатор (releaseId) для генеративного fallback. */
  seed: string;
  code?: string;
  flagged?: boolean;
  /** Реальная обложка с узла; без неё остаётся генеративная заглушка. */
  src?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cx(s.cover, className)} style={style}>
      {src ? <img className={s.coverImg} src={src} alt="" /> : <CoverArt seed={seed} className={s.coverFill} />}
      {code && <span className={s.coverCode}>{code}</span>}
      {flagged && <span className={s.coverFlag}>18+</span>}
    </div>
  );
}

/**
 * Обложка релиза с реальной картинкой узла: если у релиза есть cover_path и узел
 * отдал файл — фотография, иначе (и пока качается) генеративная заглушка по seed.
 */
export function NodeCover({
  host,
  releaseId,
  seed,
  code,
  flagged,
  className,
  style,
}: {
  host?: string;
  releaseId?: string;
  seed: string;
  code?: string;
  flagged?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const { data: src } = useCoverUrl(host, releaseId);
  return <Cover seed={seed} code={code} flagged={flagged} src={src ?? undefined} className={className} style={style} />;
}

/** Миниатюра плеера: картинка узла в том же классе, что и генеративная заглушка. */
export function CoverThumb({
  host,
  releaseId,
  seed,
  className,
}: {
  host?: string;
  releaseId?: string;
  seed: string;
  className?: string;
}) {
  const { data: src } = useCoverUrl(host, releaseId);
  return src ? <img className={className} src={src} alt="" /> : <CoverArt seed={seed} className={className} />;
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className={s.screen}>{children}</div>;
}

export function ScreenHeader({ title, sub, aside }: { title: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <div className={s.screenHeader}>
      <div className={s.screenTitle}>
        <h2 className="t-h2">{title}</h2>
        {sub && <div className={s.screenSub}>{sub}</div>}
      </div>
      {aside}
    </div>
  );
}

export function EmptyState({ label, text, action }: { label: string; text: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.empty}>
      <div className={s.emptyLabel}>{label}</div>
      <div className={s.emptyText}>{text}</div>
      {action}
    </div>
  );
}

export function Skeleton({ style }: { style?: CSSProperties }) {
  return <div className={s.skel} style={style} />;
}

/**
 * Чип имени узла: помечает, с какого узла пришла строка в мультинодовом поиске.
 * Спокойный, в стиле секционных подписей — источник, а не тревога.
 */
export function NodeBadge({ name }: { name: string }) {
  return <span className={s.nodeBadge}>{name}</span>;
}

/**
 * Таблица треков.
 * release — треклист релиза (номер, подпись «артист», формат в своей колонке),
 * popular — компактный список без подписи, library — с артистом и релизом.
 * Первая колонка: в релизе номер, в остальных — круглая кнопка play (как в макете).
 */
export function TrackTable({
  tracks,
  variant,
  onPlay,
  header = true,
  fav,
  highlightId,
  nodeName,
}: {
  tracks: Track[];
  variant: 'release' | 'popular' | 'library';
  onPlay: (t: Track) => void;
  header?: boolean;
  /** Избранное: сердечко в строке (веб — неактивное с пометкой «скоро»). */
  fav?: FavControl;
  /** id трека, пришедшего по ссылке шеринга: мягкая подсветка и скролл к строке. */
  highlightId?: string | null;
  /** Имя узла для бейджа источника: показывается у треков с host (мультипоиск). */
  nodeName?: (host: string) => string;
}) {
  const current = useCurrentTrack();
  const isPlaying = usePlayer((s) => s.playing);
  const reducedMotion = useReducedMotion();
  // Подсветка срабатывает один раз на монтирование: скролл не должен повторяться
  // при каждом перерендере таблицы.
  const didScroll = useRef(false);

  /** Подсветка общего трека: класс строки и одноразовый скролл к ней. */
  const rowRef = (t: Track) => (el: HTMLDivElement | null) => {
    if (el && highlightId === t.id && !didScroll.current) {
      didScroll.current = true;
      el.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    }
  };

  /** Клик по строке: другой трек — играть с начала, текущий — пауза/продолжить. */
  const playRow = (t: Track, isCurrent: boolean) => (isCurrent ? usePlayer.getState().toggle() : onPlay(t));
  const cols = fav
    ? variant === 'library'
      ? s.colsLibraryFav
      : variant === 'popular'
        ? s.colsPopularFav
      : s.colsReleaseFav
    : variant === 'library'
      ? s.colsLibrary
      : variant === 'popular'
        ? s.colsPopular
        : s.colsRelease;
  return (
    <div>
      {header && (
        <div className={cx(s.trackHead, cols)}>
          <span />
          <span>НАЗВАНИЕ</span>
          {variant === 'library' && (
            <>
              <span className={s.libOnly}>АРТИСТ</span>
              <span className={s.libOnly}>РЕЛИЗ</span>
            </>
          )}
          {variant !== 'popular' && <span>ФОРМАТ</span>}
          {fav && <span />}
          <span className={s.right}>ВРЕМЯ</span>
        </div>
      )}
      {tracks.map((t, i) => {
        // Играет именно эта версия трека: id совпадает И узел совпадает
        // (локальные треки без host — undefined === undefined).
        const playing = current?.id === t.id && current?.host === t.host;
        return (
          /* Клик по строке — удобство мыши; путь клавиатуры и диктора — кнопка названия ниже.
              Ключ с узлом: в мультинодовом поиске один трек может прийти с двух узлов —
              без него React получает дубликаты ключей и путает строки. */
          <div key={t.host ? `${t.host}/${t.id}` : t.id} ref={rowRef(t)} className={cx(s.trackRow, cols, playing && s.playing, highlightId === t.id && s.rowTarget)} onClick={() => playRow(t, playing)}>
            {/* Подсветка играющего трека переезжает к новой строке (Motion layoutId):
                видно, что именно заиграло после клика или переключения. */}
            {playing && (
              <motion.span aria-hidden="true" className={s.playingBg} layoutId="pv-playing-row" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
            )}
            {/* Первая колонка: в треклисте номер, круг play появляется по hover;
                в списках поиска и фонотеки круг виден всегда, как в макете */}
            <span className={s.tLead}>
              {variant === 'release' ? (
                <>
                  <span className={s.tNum}>{trackNum(i)}</span>
                  <span className={cx(s.tPlay, playing && s.tPlayShown)} aria-hidden="true">
                    {playing && isPlaying ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
                  </span>
                </>
              ) : (
                <span className={cx(s.tPlay, s.tPlayAlways, playing && s.tPlayShown)} aria-hidden="true">
                  {playing && isPlaying ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
                </span>
              )}
            </span>
            <button
              type="button"
              className={cx(s.tTitleBtn, variant !== 'popular' && s.tTitleCell)}
              onClick={(e) => {
                e.stopPropagation();
                playRow(t, playing);
              }}
              aria-label={playing && isPlaying ? `Пауза «${t.title}»` : `Играть «${t.title}»`}
            >
              {variant === 'release' ? (
                <>
                  <span className={cx(s.tTitle, 'ellipsis')}>{t.title}</span>
                  {/* Формат уже есть в своей колонке — под названием только артист. */}
                  <span className={s.tSub}>{t.artist}</span>
                </>
              ) : variant === 'library' ? (
                <>
                  <span className={cx(s.tTitle, 'ellipsis')}>{t.title}</span>
                  {/* На телефоне колонки артиста и релиза скрыты — показываем их строкой под названием */}
                  <span className={cx(s.tSub, s.mobileOnly, 'ellipsis')}>{[t.artist, t.release].filter(Boolean).join(' · ')}</span>
                  {/* Бейдж источника в мультипоиске: треки с host помечены узлом */}
                  {nodeName && t.host && <NodeBadge name={nodeName(t.host)} />}
                </>
              ) : (
                <span className={cx(s.tTitle, 'ellipsis')}>{t.title}</span>
              )}
            </button>
            {variant === 'library' && (
              <>
                <span className={cx(s.tArtist, s.libOnly, 'ellipsis')}>{t.artist}</span>
                <span className={cx(s.tRelease, s.libOnly, 'ellipsis')}>{t.release}</span>
              </>
            )}
            {variant !== 'popular' && <span className={s.tFmt}>{t.format ?? (t.explicit ? '18+' : '—')}</span>}
            {fav && (
              /* Сердечко — соседняя с названием нативная кнопка: гасим всплытие,
                  чтобы клик не играл трек; активация с клавиатуры — сама кнопка */
              <button
                type="button"
                tabIndex={fav.soon ? -1 : undefined}
                aria-disabled={fav.soon || undefined}
                aria-pressed={fav.soon ? undefined : fav.isFav(t)}
                aria-label={fav.soon ? 'Избранное — скоро' : fav.isFav(t) ? 'Убрать из фонотеки' : 'Добавить в фонотеку'}
                title={fav.soon ? 'Избранное — скоро' : fav.isFav(t) ? 'Убрать из фонотеки' : 'В фонотеку'}
                className={cx(s.tFav, fav.isFav(t) && s.tFavOn, fav.soon && s.tFavSoon)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!fav.soon) fav.toggle(t);
                }}
              >
                <HeartIcon size={14} filled={fav.isFav(t)} />
                {fav.soon && <span className={s.tFavSoonTag}>скоро</span>}
              </button>
            )}
            <span className={s.tDur}>{fmtTime(t.durationSec)}</span>
          </div>
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
