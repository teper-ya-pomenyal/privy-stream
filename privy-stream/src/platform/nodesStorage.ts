import { isTauri } from '@tauri-apps/api/core';
import type { Store } from '@tauri-apps/plugin-store';
import { createJSONStorage, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { IS_WEB } from './mode';

// Где живёт JSON-хранилище (список узлов, избранное):
// - приложение (Tauri): <файл>.json в app data dir
//   (macOS: ~/Library/Application Support/stream.privy.client/<файл>.json).
//   Общий для dev- и релизной сборки, в отличие от localStorage webview;
// - веб: нигде — данные узла каждый раз берутся из config.json;
// - браузер в режиме app (разработка): localStorage.

const fileStores = new Map<string, Promise<Store>>();
const fileStore = (file: string) =>
  fileStores.get(file) ??
  fileStores.set(file, import('@tauri-apps/plugin-store').then(({ load }) => load(file, { autoSave: false, defaults: {} }))).get(file)!;

function fileStorage<S>(file: string): PersistStorage<S> {
  return {
    async getItem(name) {
      const s = await fileStore(file);
      const value = await s.get<StorageValue<S>>(name);
      if (value != null) return value;
      // Версии до файлового хранилища держали список в localStorage webview — переносим один раз.
      const legacy = localStorage.getItem(name);
      if (legacy == null) return null;
      const parsed = JSON.parse(legacy) as StorageValue<S>;
      await s.set(name, parsed);
      await s.save();
      localStorage.removeItem(name);
      return parsed;
    },
    async setItem(name, value) {
      const s = await fileStore(file);
      await s.set(name, value);
      await s.save();
    },
    async removeItem(name) {
      const s = await fileStore(file);
      await s.delete(name);
      await s.save();
    },
  };
}

const noStorage: PersistStorage<unknown> = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/** PersistStorage поверх JSON-файла (десктоп) или localStorage (браузерная разработка). */
export function jsonFileStorage<S>(file: string): PersistStorage<S> | undefined {
  if (IS_WEB) return noStorage as PersistStorage<S>;
  if (isTauri()) return fileStorage<S>(file);
  return createJSONStorage<S>(() => localStorage);
}

export function nodesStorage<S>(): PersistStorage<S> | undefined {
  return jsonFileStorage<S>('nodes.json');
}
