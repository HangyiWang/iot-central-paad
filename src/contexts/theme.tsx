// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useCallback, useMemo, useState} from 'react';
import {useColorScheme} from 'react-native';
import {
  DefaultTheme,
  DarkTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native';
import {createTheme, ThemeProvider as UIThemeProvider} from '@rneui/themed';
import {ThemeMode} from 'types';

export interface ITheme {
  backgroundColor: string;
  textColor: string;
}
interface IThemeContext {
  mode: ThemeMode;
  theme: ITheme;
  set(mode: ThemeMode): void;
}
const ThemeContext = React.createContext({} as IThemeContext);

const ThemeProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [mode, setMode] = useState(ThemeMode.DEVICE);
  const system = useColorScheme();
  const dark =
    mode === ThemeMode.DARK || (mode === ThemeMode.DEVICE && system === 'dark');
  const navigationTheme = useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: dark ? '#72D5C2' : '#166B72',
        background: dark ? '#111D22' : '#F5F4F0',
        card: dark ? '#1B2A30' : '#FFFFFF',
        text: dark ? '#F0F4F3' : '#17252A',
        border: dark ? '#33464A' : '#D5DCDA',
      },
    };
  }, [dark]);
  const uiTheme = useMemo(
    () =>
      createTheme({
        mode: dark ? 'dark' : 'light',
        lightColors: {primary: '#166B72', background: '#FFFFFF'},
        darkColors: {primary: '#72D5C2', background: '#1B2A30'},
      }),
    [dark],
  );
  const set = useCallback((value: ThemeMode) => setMode(value), []);
  const value = {
    mode,
    set,
    theme: {
      backgroundColor: navigationTheme.colors.background,
      textColor: navigationTheme.colors.text,
    },
  };
  return (
    <ThemeContext.Provider value={value}>
      <NavigationThemeProvider value={navigationTheme}>
        <UIThemeProvider theme={uiTheme}>{children}</UIThemeProvider>
      </NavigationThemeProvider>
    </ThemeContext.Provider>
  );
};
export {ThemeProvider as default, ThemeContext};
