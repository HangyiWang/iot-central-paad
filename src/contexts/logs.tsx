// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useCallback, useState} from 'react';
import {LogItem, TimedLog} from '../types';
import {redactLog} from '../tools/CustomLogger';

export const MAX_LOG_ENTRIES = 500;

interface ILogsContext {
  logs: TimedLog;
  append: (logItem: LogItem) => void;
  clear: () => void;
}

const initialState: TimedLog = [];
const LogsContext = React.createContext({} as ILogsContext);
const {Provider} = LogsContext;

const LogsProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [logs, setLogs] = useState<TimedLog>(initialState);
  const append = useCallback(
    (logItem: LogItem) => {
      setLogs(current => [
        ...current.slice(-(MAX_LOG_ENTRIES - 1)),
        {
          logItem: {
            eventName: redactLog(logItem.eventName),
            eventData: redactLog(logItem.eventData),
          },
          timestamp: new Date(Date.now()).toLocaleString(),
        },
      ]);
    },
    [setLogs],
  );
  const clear = useCallback(() => {
    setLogs([
      {
        logItem: {
          eventData: 'Application just reset',
          eventName: 'INFO',
        },
        timestamp: new Date(Date.now()).toLocaleString(),
      },
    ]);
  }, [setLogs]);

  return <Provider value={{logs, append, clear}}>{children}</Provider>;
};

export {LogsProvider as default, LogsContext};
