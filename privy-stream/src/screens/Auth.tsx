import { useState, type FormEvent } from 'react';
import { errorText, nodeApi } from '../api';
import { useMobile } from '../lib/useMobile';
import { IS_WEB } from '../platform/mode';
import { useActiveNodeOrNull, useServers } from '../store/servers';
import { useSession } from '../store/session';
import {
  Button,
  cx,
  DateField,
  type DateParts,
  ErrorNote,
  Field,
  hostLabel,
  isoDate,
  Logo,
  PasswordField,
  NODE_STATUS,
  nodeState,
  PrefixedInput,
  StatusDot,
} from '../ui';
import s from './screens.module.css';

// Спецсимволы OWASP — тот же набор, что проверяет user_service (ValidatePassword).
const SPECIAL_CHAR = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

// Правила регистрации — те же, что в user_service (ValidateUsername / ValidatePassword).
// Длина в символах, как []rune в Go.
type Rule = { text: string; ok: (v: string) => boolean };
const len = (v: string) => [...v].length;

const LOGIN_RULES: Rule[] = [
  { text: 'от 3 до 20 символов', ok: (v) => len(v) >= 3 && len(v) <= 20 },
  { text: 'латиница, цифры и . _ -', ok: (v) => /^[a-zA-Z0-9_.-]+$/.test(v) },
  { text: 'без двух . _ - подряд', ok: (v) => !/[._-]{2}/.test(v) },
];
const PASSWORD_RULES: Rule[] = [
  { text: 'от 8 до 128 символов', ok: (v) => len(v) >= 8 && len(v) <= 128 },
  { text: 'хотя бы один спецсимвол: ! @ # $ % & * и т.п.', ok: (v) => SPECIAL_CHAR.test(v) },
];
const firstBroken = (rules: Rule[], v: string) => rules.find((r) => !r.ok(v));

type Mode = 'login' | 'register';

export function Auth() {
  const node = useActiveNodeOrNull();
  const noNodes = useServers((x) => x.nodes.length === 0);
  const nodeError = useServers((x) => x.error);
  const signIn = useSession((x) => x.signIn);
  const mobile = useMobile();

  const [mode, setMode] = useState<Mode>('login');
  const [login, setLogin] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [birth, setBirth] = useState<DateParts>({ day: '', month: '', year: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // Поле, для которого открыто окно с требованиями (только при регистрации).
  const [focus, setFocus] = useState<'login' | 'password' | null>(null);
  // Первый запуск без узлов — форма добавления сразу открыта.
  const [addOpen, setAddOpen] = useState(noNodes);

  const reg = mode === 'register';
  // Ошибка стора узлов здесь актуальна, только пока выбранный узел не отвечает;
  // ошибки добавления узла показываются в самой форме добавления.
  const shownError = err || (!addOpen && node && node.status !== 'online' ? nodeError : '');

  const edit = (setter: (v: string) => void) => (e: { target: { value: string } }) => {
    setter(e.target.value);
    setErr('');
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!node) {
      setAddOpen(true);
      return setErr('узел не выбран · добавь адрес узла, на котором создаётся аккаунт');
    }
    if (node.status !== 'online') return setErr(`503 · узел ${node.host} не отвечает`);
    // Проверки из контракта API v1 (RegisterRequest / AuthRequest) — до запроса.
    if (!login.trim()) return setErr('400 · укажи логин');
    const badLogin = reg && firstBroken(LOGIN_RULES, login);
    if (badLogin) return setErr(`400 · логин: ${badLogin.text}`);
    const badPass = reg && firstBroken(PASSWORD_RULES, pass);
    if (badPass) return setErr(`400 · пароль: ${badPass.text}`);
    if (reg && pass2 !== pass) return setErr('400 · пароли не совпадают');
    const birthDate = isoDate(birth);
    if (reg && !birthDate) return setErr('400 · дата рождения: выбери день, месяц и год');
    setBusy(true);
    try {
      const tokens = reg
        ? await nodeApi.register(node.host, { login, password: pass, birthDate: birthDate! })
        : await nodeApi.login(node.host, { login, password: pass });
      setPass('');
      setPass2('');
      await signIn(node.host, tokens);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.auth}>
      <div className={s.authLeft}>
        <Logo />
        <div className={s.pitch}>
          <h1 className={s.pitchTitle}>
            Ты сам решаешь
            <br />
            какую музыку
            <br />
            слушать
          </h1>
          <p className={s.pitchText}>
            Приватная фонотека без региональных блокировок и внешних списков запрещённого. Твой каталог, твой ключ, твоё
            правило.
          </p>
          <div className={s.pitchFacts}>
            {[
              ['ВХОД', 'JWT · RS256'],
              ['СЕССИЯ', 'РОТАЦИЯ ТОКЕНОВ'],
              ['ТЕЛЕМЕТРИЯ', 'ВЫКЛ'],
            ].map(([k, v]) => (
              <div key={k} className={s.fact}>
                <div className={s.factKey}>{k}</div>
                <div className={s.factVal}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className={s.techLine}>{node ? `${hostLabel(node.host)} · ` : ''}СБОРКА 0.4.1</div>
      </div>

      <div className={s.authRight}>
        <div className={s.card}>
          <div className={s.tabs} role="tablist">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={cx(s.tab, mode === m && s.tabActive)}
                onClick={() => {
                  setMode(m);
                  setErr('');
                }}
              >
                {m === 'login' ? 'Вход' : 'Регистрация'}
              </button>
            ))}
          </div>

          <form className={s.cardBody} onSubmit={submit}>
            {IS_WEB && node ? (
              <WebNode name={node.name} host={node.host} online={node.status === 'online'} />
            ) : (
              <NodePicker
                open={addOpen}
                setOpen={(open) => {
                  setErr('');
                  setAddOpen(open);
                }}
              />
            )}
            <div className={s.divider} />

            <div className={s.reqAnchor}>
              <Field
                label="ЛОГИН"
                value={login}
                onChange={edit(setLogin)}
                placeholder="user_name"
                autoFocus={!noNodes && !mobile}
                onFocus={() => setFocus('login')}
                onBlur={() => setFocus(null)}
                aria-describedby={reg ? 'login-rules' : undefined}
              />
              {reg && focus === 'login' && <Requirements id="login-rules" title="ТРЕБОВАНИЯ К ЛОГИНУ" rules={LOGIN_RULES} value={login} />}
            </div>
            <div className={s.reqAnchor}>
              <PasswordField
                label="ПАРОЛЬ"
                value={pass}
                onChange={edit(setPass)}
                placeholder="••••••••••"
                onFocus={() => setFocus('password')}
                onBlur={() => setFocus(null)}
                aria-describedby={reg ? 'password-rules' : undefined}
              />
              {reg && focus === 'password' && (
                <Requirements id="password-rules" title="ТРЕБОВАНИЯ К ПАРОЛЮ" rules={PASSWORD_RULES} value={pass} />
              )}
            </div>
            {reg && <PasswordField label="ПОВТОР ПАРОЛЯ" value={pass2} onChange={edit(setPass2)} placeholder="••••••••••" />}
            {reg && (
              <DateField
                label="ДАТА РОЖДЕНИЯ"
                value={birth}
                onChange={(v) => {
                  setBirth(v);
                  setErr('');
                }}
              />
            )}

            <ErrorNote>{shownError}</ErrorNote>

            <Button type="submit" variant="accent" size="lg" disabled={busy} style={{ marginTop: 4 }}>
              {busy ? '···' : reg ? 'Создать ключ' : 'Войти'}
            </Button>
            <div className={s.cardFoot}>
              <span>POST /v1/auth</span>
              <span>{reg ? 'RS256 · ключи на устройстве' : 'refresh · ротация'}</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Всплывающее окно с требованиями: каждое правило отмечается по мере ввода. */
function Requirements({ id, title, rules, value }: { id: string; title: string; rules: Rule[]; value: string }) {
  return (
    <div id={id} role="tooltip" className={s.reqs}>
      <div className={s.reqsTitle}>{title}</div>
      <ul className={s.reqsList}>
        {rules.map((r) => {
          const state = !value ? 'idle' : r.ok(value) ? 'ok' : 'bad';
          return (
            <li key={r.text} className={cx(s.req, state === 'ok' && s.reqOk, state === 'bad' && s.reqBad)}>
              <span className={s.reqMark} aria-hidden="true">
                {state === 'ok' ? '✓' : state === 'bad' ? '✕' : '·'}
              </span>
              {r.text}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Веб-версия: узел фиксирован конфигом, только показываем его. */
function WebNode({ name, host, online }: { name: string; host: string; online: boolean }) {
  return (
    <div className={s.nodePicker}>
      <span className="t-label">УЗЕЛ</span>
      <div className={s.webNode}>
        <StatusDot color={online ? 'var(--accent)' : 'var(--dot-off)'} />
        <span className={cx(s.webNodeName, 'ellipsis')}>{name}</span>
        <span className={cx(s.webNodeHost, 'ellipsis')}>{hostLabel(host)}</span>
      </div>
      <div className={s.hint}>аккаунт создаётся на этом узле</div>
    </div>
  );
}

/**
 * Выбор узла на экране входа. Здесь же можно добавить узел по адресу:
 * без узла регистрироваться негде.
 */
function NodePicker({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const { nodes, activeId, pick, add, adding, error, clearError } = useServers();
  const node = useActiveNodeOrNull();
  const [host, setHost] = useState('');
  const empty = nodes.length === 0;

  function close() {
    clearError();
    setHost('');
    setOpen(false);
  }

  async function submitAdd() {
    if (adding) return;
    const id = await add(host);
    if (!id) return; // ошибка ввода — остаётся в форме
    setHost('');
    setOpen(false);
    // pick() выставит 503, если узел не ответил на handshake.
    pick(id);
  }

  return (
    <div className={s.nodePicker}>
      <span className="t-label">УЗЕЛ ПОДКЛЮЧЕНИЯ</span>

      {empty ? (
        <p className={s.noNodes}>Узлов пока нет. Введи адрес узла, который тебе дали, — аккаунт создаётся на нём.</p>
      ) : (
        <div className={s.chips}>
          {nodes.map((n) => {
            const st = NODE_STATUS[nodeState(n, activeId, null)];
            return (
              <button
                key={n.id}
                type="button"
                className={cx(s.chip, n.id === activeId && s.chipActive)}
                onClick={() => {
                  if (open) close();
                  pick(n.id);
                }}
              >
                <StatusDot color={st.dot} />
                <span className="ellipsis">{n.name}</span>
              </button>
            );
          })}
          {!open && (
            <button
              type="button"
              className={cx(s.chip, s.chipAdd)}
              onClick={() => {
                clearError();
                setOpen(true);
              }}
            >
              + Добавить узел
            </button>
          )}
        </div>
      )}

      {open && (
        <div className={s.addNode}>
          <div className={s.addNodeRow}>
            <PrefixedInput
              prefix="://"
              className={s.addNodeInput}
              value={host}
              autoFocus
              placeholder="10.0.0.5:8443"
              onChange={(e) => {
                setHost(e.target.value);
                clearError();
              }}
              onKeyDown={(e) => {
                // Поле внутри формы входа: Enter добавляет узел, а не отправляет логин.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submitAdd();
                }
                if (e.key === 'Escape' && !empty) close();
              }}
            />
            <Button variant="accent" size="sm" className={s.addNodeBtn} disabled={adding} onClick={() => void submitAdd()}>
              {adding ? 'Проверка…' : 'Добавить'}
            </Button>
            {!empty && (
              <Button variant="quiet" size="sm" className={s.addNodeBtn} onClick={close} aria-label="Отмена">
                ✕
              </Button>
            )}
          </div>
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className={s.hint}>
        {open
          ? 'адрес вида host:port · ключ и история остаются на стороне клиента'
          : node
            ? `${node.host} · аккаунт создаётся на выбранном узле`
            : 'добавь узел, чтобы войти или зарегистрироваться'}
      </div>
    </div>
  );
}
