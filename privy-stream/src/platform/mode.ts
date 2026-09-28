import { isTauri } from '@tauri-apps/api/core';

export { isTauri };

/**
 * app — десктопное приложение (Tauri): несколько узлов, список в файле.
 * web — сайт одного узла: узел берётся из config.json, сменить его нельзя.
 * VITE_CLIENT_MODE переопределяет режим для разработки в браузере.
 */
export type ClientMode = 'app' | 'web';

const override = import.meta.env.VITE_CLIENT_MODE;

export const CLIENT_MODE: ClientMode = override === 'app' || override === 'web' ? override : isTauri() ? 'app' : 'web';
export const IS_WEB = CLIENT_MODE === 'web';
