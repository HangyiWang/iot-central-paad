// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useCallback, useRef, useState} from 'react';
import * as Keychain from 'react-native-keychain';
import {DeviceCredentials, decodeCredentials} from '../connection';
import {ThemeMode} from '../types';

const USERNAME = 'IOTC_PAD_CLIENT';

export type IStorageState = {
  themeMode: ThemeMode;
  simulated: boolean;
  skipVersion: string | null;
  deliveryInterval: number;
  credentials: DeviceCredentials | null;
  initialized: boolean;
};

const initialState: IStorageState = {
  themeMode: ThemeMode.DEVICE,
  credentials: null,
  simulated: false,
  initialized: false,
  skipVersion: null,
  deliveryInterval: 5,
};

export function restoreStoredState(value: unknown): IStorageState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Stored application data is invalid.');
  }
  const saved = value as Record<string, unknown>;
  const themeMode = saved.themeMode ?? ThemeMode.DEVICE;
  const simulated = saved.simulated ?? false;
  const deliveryInterval = saved.deliveryInterval ?? 5;
  const skipVersion = saved.skipVersion ?? null;
  if (
    !Object.values(ThemeMode).includes(themeMode as ThemeMode) ||
    typeof simulated !== 'boolean' ||
    typeof deliveryInterval !== 'number' ||
    !Number.isFinite(deliveryInterval) ||
    deliveryInterval < 1 ||
    deliveryInterval > 3600 ||
    (skipVersion !== null && typeof skipVersion !== 'string')
  ) {
    throw new Error('Stored application settings are invalid.');
  }
  return {
    themeMode: themeMode as ThemeMode,
    simulated,
    deliveryInterval,
    skipVersion,
    credentials: saved.credentials
      ? decodeCredentials(saved.credentials)
      : null,
    initialized: true,
  };
}

export type IStorageContext = IStorageState & {
  save(state: Partial<IStorageState>, store?: boolean): Promise<void>;
  read(): Promise<IStorageState>;
  clear(): Promise<void>;
};

const StorageContext = React.createContext({} as IStorageContext);

const StorageProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [state, setState] = useState(initialState);
  const current = useRef(initialState);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const replace = useCallback((next: IStorageState) => {
    current.current = next;
    setState(next);
  }, []);
  const enqueue = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const result = pending.current.then(operation);
    // Callers receive the original rejection; only the scheduling tail recovers.
    pending.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

  const save = useCallback(
    (data: Partial<IStorageState>, store = true) =>
      enqueue(async () => {
        const next = {...current.current, ...data};
        if (store) {
          const written = await Keychain.setGenericPassword(
            USERNAME,
            JSON.stringify(next),
          );
          if (!written) {
            throw new Error('Secure storage could not be updated.');
          }
        }
        replace(next);
      }),
    [enqueue, replace],
  );

  const read = useCallback(
    () =>
      enqueue(async () => {
        const data = await Keychain.getGenericPassword();
        const next = data
          ? restoreStoredState(JSON.parse(data.password))
          : {...initialState, initialized: true};
        replace(next);
        return next;
      }),
    [enqueue, replace],
  );

  const clear = useCallback(
    () =>
      enqueue(async () => {
        const cleared = await Keychain.resetGenericPassword();
        if (!cleared) {
          throw new Error('Secure storage could not be cleared.');
        }
        replace({...initialState, initialized: true});
      }),
    [enqueue, replace],
  );

  return (
    <StorageContext.Provider value={{...state, save, read, clear}}>
      {children}
    </StorageContext.Provider>
  );
};

export {StorageProvider as default, StorageContext};
