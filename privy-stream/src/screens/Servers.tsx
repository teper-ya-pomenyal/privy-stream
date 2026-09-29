import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useOnlineCount, useServers } from '../store/servers';
import { useSession } from '../store/session';
import { Button, cx, ErrorNote, NODE_STATUS, nodeState, PrefixedInput, Screen, ScreenHeader, StatusDot } from '../ui';
import s from './screens.module.css';

export function Servers() {
  const { nodes, activeId, connectingId, adding, error, connect, add, clearError } = useServers();
  const online = useOnlineCount();
  const activate = useSession((x) => x.activate);
  const navigate = useNavigate();
  const [newHost, setNewHost] = useState('');

  async function onConnect(id: string) {
    if (!(await connect(id))) return;
    const host = useServers.getState().nodes.find((n) => n.id === id)!.host;
    // Аккаунт живёт на узле: без токенов для него откроется экран входа.
    // Каталог и фильтры скоупятся по узлу и сбрасываются вместе со сменой маршрута.
    if (await activate(host)) navigate('/catalog');
  }

  async function onAdd() {
    // null — ошибка ввода: поле остаётся, причина уже показана в ErrorNote.
    // Офлайн-узел тоже попадает в список, но адрес не чистим: он может подняться позже.
    const result = await add(newHost);
    if (!result) return;
    if (result.online) setNewHost('');
  }

  return (
    <Screen>
      <ScreenHeader
        title="Узлы"
        sub={
          <>
            Единого сервера нет. Любой может поднять свой узел, залить туда фонотеку и раздать адрес. Клиент подключается к
            узлу и ищет музыку только на нём. Доступны из добавленных узлов: {online} из {nodes.length}.
          </>
        }
      />

      <form
        className={s.addBlock}
        onSubmit={(e) => {
          e.preventDefault();
          void onAdd();
        }}
      >
        <div className="t-section">Подключиться по адресу</div>
        <div className={s.addRow}>
          <PrefixedInput
            prefix="://"
            className={s.addInput}
            value={newHost}
            onChange={(e) => {
              setNewHost(e.target.value);
              clearError();
            }}
            placeholder="10.0.0.5:8443"
          />
          <Button type="submit" variant="accent" size="md" disabled={adding}>
            {adding ? 'Проверка…' : 'Добавить узел'}
          </Button>
          <div className={s.addNote}>
            ключ и история остаются
            <br />
            на стороне клиента
          </div>
        </div>
        <ErrorNote>{error}</ErrorNote>
      </form>

      <div className={s.nodeList}>
        {nodes.map((n) => {
          const state = nodeState(n, activeId, connectingId);
          const st = NODE_STATUS[state];
          const active = n.id === activeId;
          return (
            // Клик по строке не подключает: единственный путь к узлу — явная кнопка справа.
            <div key={n.id} className={cx(s.nodeRow, active && s.nodeRowActive)}>
              <div className={s.nodeMain}>
                <StatusDot color={st.dot} blink={state === 'connecting' ? '0.7s' : undefined} style={{ marginTop: 7 }} />
                <div className={s.nodeText}>
                  <div className={s.nodeTitleLine}>
                    <span className={s.nodeName}>{n.name}</span>
                    <span className={s.nodeHost}>{n.host}</span>
                  </div>
                  <span className={s.nodeSub}>
                    {n.owner} · {n.access} · {n.note}
                  </span>
                </div>
              </div>
              <div className={s.nodeSide}>
                <div className={s.nodeStatus}>
                  <span className={s.nodeStatusLabel} style={{ color: st.color }}>
                    {st.label}
                  </span>
                  <span className={s.nodePing}>{n.status === 'online' && n.ping != null ? `${n.ping} ms` : '—'}</span>
                </div>
                {/* «Текущий» — статус узла, а не действие; офлайн-текущему, кроме него, нужен и путь «Повторить». */}
                {active && <span className={s.nodeCurrent}>Текущий</span>}
                {(!active || state === 'offline') && (
                  <Button size="sm" onClick={() => void onConnect(n.id)}>
                    {n.status === 'online' ? 'Подключиться' : 'Повторить'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={s.theses}>
        <span>Релизы индексируются узлом, не клиентом</span>
        <span>Поиск идёт только по текущему узлу</span>
        <span>Смена узла не трогает локальную фонотеку</span>
      </div>
    </Screen>
  );
}
