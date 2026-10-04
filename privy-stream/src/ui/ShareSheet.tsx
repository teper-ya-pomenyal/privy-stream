import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react';
import { buildShareText, buildShareUrl, copyText, shareHead, shareOrCopy, smsHref, type ShareTarget } from '../lib/share';
import { shouldClose } from '../lib/sheetClose';
import { useMobile } from '../lib/useMobile';
import { IS_WEB } from '../platform/mode';
import { useShareSheet } from '../store/shareSheet';
import { useActiveNode } from '../store/servers';
import { ArtistAvatar, Button, CloseIcon, CoverThumb, NodeCover, ShareIcon, cx, hostLabel } from './index';
import s from './ui.module.css';

/** Метка типа сущности в превью шторки. */
const KIND_LABEL = { track: 'Трек', release: 'Альбом', artist: 'Артист' } as const;

/** Превью сущности: обложка релиза/альбома трека, инициал — у артиста. */
function SharePreview({ target, host, coverClass }: { target: ShareTarget; host: string; coverClass: string }) {
  switch (target.kind) {
    case 'release':
      return <NodeCover host={host} releaseId={target.release.id} seed={target.release.id} code={target.release.code} flagged={target.release.flagged} className={coverClass} />;
    case 'track': {
      const t = target.track;
      return <CoverThumb host={t.host} releaseId={t.releaseId || t.id} seed={t.releaseId || t.id} className={coverClass} />;
    }
    case 'artist':
      return <ArtistAvatar name={target.artist.name} className={cx(coverClass, s.shareAva)} />;
  }
}

/**
 * Окно «Поделиться»: превью сущности, ссылка (или описание в app-режиме) и
 * ряд целей — мессенджеры, SMS и системный шер. На мобильном — нижняя шторка
 * с жестом закрытия (механика полного плеера), на десктопе — центрированный
 * диалог; разница только в CSS и вариантах анимации.
 */
export function ShareSheet() {
  const target = useShareSheet((st) => st.target);
  const close = useShareSheet((st) => st.close);
  return (
    <AnimatePresence>
      {target && <ShareSheetBody key="share-sheet" target={target} close={close} />}
    </AnimatePresence>
  );
}

function ShareSheetBody({ target, close }: { target: ShareTarget; close: () => void }) {
  const node = useActiveNode();
  const mobile = useMobile();
  const reducedMotion = useReducedMotion();

  // Фокус возвращается на кнопку-триггер после выезда шторки из дерева.
  useEffect(() => {
    const trigger = useShareSheet.getState().trigger;
    return () => {
      trigger?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // Скролл страницы под шторкой блокируется на всё время открытия.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const onDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (shouldClose(info, window.innerHeight)) close();
  };

  const sheetProps = {
    className: s.shareSheet,
    role: 'dialog' as const,
    'aria-modal': true,
    'aria-label': 'Поделиться',
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  };

  return (
    <div className={s.shareBackdrop} onClick={close}>
      {reducedMotion ? (
        <div {...sheetProps}>
          <ShareSheetContent target={target} url={IS_WEB ? buildShareUrl(target) : null} host={node.host} nodeName={node.name} mobile={mobile} />
        </div>
      ) : (
        <motion.div
          {...sheetProps}
          initial={mobile ? { y: '100%' } : { opacity: 0, scale: 0.96 }}
          animate={mobile ? { y: 0 } : { opacity: 1, scale: 1 }}
          exit={mobile ? { y: '100%' } : { opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          drag={mobile ? 'y' : false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 1 }}
          dragMomentum={false}
          onDragEnd={mobile ? onDragEnd : undefined}
        >
          <ShareSheetContent target={target} url={IS_WEB ? buildShareUrl(target) : null} host={node.host} nodeName={node.name} mobile={mobile} />
        </motion.div>
      )}
    </div>
  );
}

/** Содержимое шторки: превью, ссылка/описание, цели, строка узла. */
function ShareSheetContent({
  target,
  url,
  host,
  nodeName,
  mobile,
}: {
  target: ShareTarget;
  url: string | null;
  host: string;
  nodeName: string;
  mobile: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const text = buildShareText(target, url, host);
  const type = KIND_LABEL[target.kind];
  const title = target.kind === 'track' ? target.track.title : target.kind === 'release' ? target.release.title : target.artist.name;
  const sub =
    target.kind === 'artist' ? type : `${(target.kind === 'track' ? target.track : target.release).artist} · ${type}`;

  const copy = async (value: string) => {
    // Именно буфер, не системный шер: кнопка обязана сработать мгновенно.
    await copyText(value);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  const messengers: ReactNode[] = [];
  if (IS_WEB) {
    messengers.push(
      <a key="tg" className={s.shareTarget} href={`https://t.me/share/url?url=${encodeURIComponent(url ?? '')}&text=${encodeURIComponent(shareHead(target))}`} target="_blank" rel="noopener" aria-label="Отправить в Telegram">
        <TelegramMark />
        <span>Telegram</span>
      </a>,
      <a key="wa" className={s.shareTarget} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener" aria-label="Отправить в WhatsApp">
        <WhatsAppMark />
        <span>WhatsApp</span>
      </a>,
    );
    // Схемы viber:/sms: осмысленны только с телефона; на десктопе их скрываем.
    if (mobile) {
      messengers.push(
        <button key="viber" type="button" className={s.shareTarget} aria-label="Отправить в Viber" onClick={() => location.assign(`viber://forward?text=${encodeURIComponent(text)}`)}>
          <ViberMark />
          <span>Viber</span>
        </button>,
        <button key="sms" type="button" className={s.shareTarget} aria-label="Отправить сообщением (SMS)" onClick={() => location.assign(smsHref(text))}>
          <SmsMark />
          <span>SMS</span>
        </button>,
      );
    }
    if (typeof navigator.share === 'function') {
      messengers.push(
        <button key="more" type="button" className={s.shareTarget} aria-label="Ещё — системный шер" onClick={() => void shareOrCopy(text, title, url ?? undefined)}>
          <span className={cx(s.shareTargetMark, s.shareTargetPlain)}>
            <ShareIcon size={22} />
          </span>
          <span>Ещё…</span>
        </button>,
      );
    }
  }

  return (
    <>
      <span className={s.shareGrabber} aria-hidden="true" />
      <button type="button" className={s.shareClose} aria-label="Закрыть" onClick={close}>
        <CloseIcon size={16} />
      </button>

      <div className={s.shareHead}>
        <SharePreview target={target} host={host} coverClass={s.shareCover} />
        <div className={s.shareHeadText}>
          <div className={cx(s.shareTitle, 'ellipsis')}>{title}</div>
          <div className={cx(s.shareSub, 'ellipsis')}>{sub}</div>
        </div>
      </div>

      {url ? (
        <div className={s.shareLinkBox}>
          <input className={s.shareLinkInput} readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Ссылка на сущность" />
          <Button size="sm" className={cx(s.shareCopyBtn, copied && s.shareCopied)} aria-live="polite" autoFocus onClick={() => void copy(url)}>
            {copied ? 'Скопировано' : 'Копировать'}
          </Button>
        </div>
      ) : (
        <div className={s.shareLinkBox}>
          <div className={s.shareDesc}>{text}</div>
          <Button size="sm" className={cx(s.shareCopyBtn, copied && s.shareCopied)} aria-live="polite" autoFocus onClick={() => void copy(text)}>
            {copied ? 'Скопировано' : 'Скопировать описание'}
          </Button>
        </div>
      )}

      {messengers.length > 0 && (
        <div className={s.shareTargets}>
          <div className={s.shareTargetsLabel}>Отправить ссылкой</div>
          <div className={s.shareTargetsRow}>{messengers}</div>
        </div>
      )}

      <div className={s.shareNode}>
        Узел: {nodeName} · {hostLabel(host)}
      </div>
    </>
  );
}

/* ---------- Одноцветные марки мессенджеров: контур как у всех иконок
   проекта; бренд живёт только в кружке-подложке (см. .shareTargetMark). ---------- */
const Mark = ({ brand, children }: { brand: string; children: ReactNode }) => (
  <span className={cx(s.shareTargetMark, brand)}>{children}</span>
);

const TelegramMark = () => (
  <Mark brand={s.shareMarkTg}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.9 4.6 18.9 19.3c-.2 1-.8 1.2-1.6.8l-4.5-3.3-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.6 8.4-7.6c.4-.3-.1-.5-.6-.2L7.5 13.4l-4.4-1.4c-1-.3-1-1 .2-1.4l17.2-6.6c.8-.3 1.5.2 1.4 1.6Z" />
    </svg>
  </Mark>
);

const WhatsAppMark = () => (
  <Mark brand={s.shareMarkWa}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.6-1.2A9 9 0 1 0 12 3Z" />
      <path d="M8.8 8.4c-.3 2.9 3.9 7.1 6.8 6.8l.9-1.7-2.1-1.3-1 .9c-1.1-.5-2-1.4-2.5-2.5l.9-1-1.3-2.1z" fill="currentColor" stroke="none" />
    </svg>
  </Mark>
);

const ViberMark = () => (
  <Mark brand={s.shareMarkViber}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6.6 3.2h2.3c.5 0 1 .3 1.2.8l1.2 3c.2.5.1 1-.3 1.4l-1.5 1.3a11.4 11.4 0 0 0 4.8 4.8l1.3-1.5c.4-.4.9-.5 1.4-.3l3 1.2c.5.2.8.7.8 1.2v2.3c0 1.1-.9 2-2 1.9C10.5 18.6 5.4 13.5 4.7 5.2c-.1-1.1.8-2 1.9-2Z" />
    </svg>
  </Mark>
);

const SmsMark = () => (
  <Mark brand={s.shareMarkSms}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3v4l4-4h7a2 2 0 0 0 2-2z" />
      <circle cx="8" cy="10.5" r="0.6" fill="currentColor" />
      <circle cx="12" cy="10.5" r="0.6" fill="currentColor" />
      <circle cx="16" cy="10.5" r="0.6" fill="currentColor" />
    </svg>
  </Mark>
);
