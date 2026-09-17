import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {FlatList, StyleSheet} from 'react-native';
import Logs, {LogEvent, logLevel} from '../src/Logs';
import * as hooks from '../src/hooks';
import LogsProvider, {LogsContext} from '../src/contexts/logs';

jest.mock('../src/hooks', () => ({
  useLogger: jest.fn(),
  useTheme: () => ({dark: false, colors: {text: '#17252A'}}),
}));
jest.mock('@rneui/themed', () => ({Icon: 'Icon', Text: 'Text'}));

let view;
const visibleText = () =>
  view.root
    .findAllByType('Text')
    .flatMap(node =>
      React.Children.toArray(node.props.children).filter(
        child => typeof child === 'string',
      ),
    )
    .join('\n');
const entry = (id, eventName, eventData = 'Device event') => ({
  id,
  timestamp: '9/17/2026, 5:00:00 AM',
  logItem: {eventName, eventData},
});
const press = id =>
  view.root
    .findAllByProps({testID: id})
    .find(node => node.props.onPress)
    .props.onPress();
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
  jest.clearAllMocks();
});

test('renders a chronological virtualized feed with stable keys and selectable issue filters', () => {
  const events = [
    entry(20, 'INFO'),
    entry(21, 'ERROR'),
    entry(22, 'WARNING'),
    entry(23, 'FILE UPLOAD'),
  ];
  hooks.useLogger.mockReturnValue([events]);
  act(() => {
    view = renderer.create(<Logs />);
  });
  const list = () => view.root.findByType(FlatList).props;
  expect(list().data).toBe(events);
  expect(list().keyExtractor(events[0])).toBe('20');
  expect(list().keyExtractor(events[1])).toBe('21');
  act(() => press('logs-filter-issues'));
  expect(list().data.map(item => item.id)).toEqual([21, 22]);
  expect(
    view.root.findAllByProps({testID: 'logs-filter-issues'})[0].props
      .accessibilityState.selected,
  ).toBe(true);
  act(() => press('logs-filter-all'));
  expect(list().data).toBe(events);
});

test('an event shows a severity badge and expands the exact selectable payload', () => {
  const item = entry(
    42,
    'ERROR',
    '{"message":"Transport unavailable","status":401}',
  );
  act(() => {
    view = renderer.create(<LogEvent entry={item} />);
  });
  expect(visibleText()).toContain('Error');
  expect(visibleText()).not.toContain('View details');
  expect(
    view.root.findAllByProps({testID: 'log-toggle-42'})[0].props
      .accessibilityLabel,
  ).toContain('View details');
  expect(
    StyleSheet.flatten(
      view.root.findAllByProps({testID: 'log-toggle-42'})[0].props.style,
    ),
  ).toMatchObject({minWidth: 44, minHeight: 44});
  expect(view.root.findAllByProps({testID: 'log-payload-42'})).toHaveLength(0);
  act(() => press('log-toggle-42'));
  const payload = view.root.findAllByProps({testID: 'log-payload-42'})[0];
  expect(payload.props.children).toBe(item.logItem.eventData);
  expect(payload.props.selectable).toBe(true);
  expect(
    view.root.findAllByProps({testID: 'log-toggle-42'})[0].props
      .accessibilityState.expanded,
  ).toBe(true);
  act(() => press('log-toggle-42'));
  expect(view.root.findAllByProps({testID: 'log-payload-42'})).toHaveLength(0);
});

test('empty states are explicit and the latest action is disabled without visible entries', () => {
  hooks.useLogger.mockReturnValue([[]]);
  act(() => {
    view = renderer.create(<Logs />);
  });
  expect(visibleText()).toContain('No activity yet');
  expect(
    view.root.findAllByProps({testID: 'logs-latest'})[0].props.disabled,
  ).toBe(true);
  act(() => press('logs-filter-issues'));
  expect(visibleText()).toContain('No warning or error events');
});

test('expanded cards only receive the existing sanitized stored data', () => {
  let context;
  function Probe() {
    context = React.useContext(LogsContext);
    return null;
  }
  hooks.useLogger.mockImplementation(() => [
    React.useContext(LogsContext).logs,
  ]);
  act(() => {
    view = renderer.create(
      <LogsProvider>
        <Probe />
        <Logs />
      </LogsProvider>,
    );
  });
  act(() =>
    context.append({
      eventName: 'ERROR',
      eventData: 'deviceKey=PRIVATE_UI_CANARY',
    }),
  );
  act(() => press(`log-toggle-${context.logs[0].id}`));
  expect(visibleText()).not.toContain('PRIVATE_UI_CANARY');
  expect(visibleText()).toContain('[REDACTED]');
});

test('levels come from event names, not guesses about successful payload delivery', () => {
  expect(logLevel('[CLIENT] - (ERROR)')).toBe('error');
  expect(logLevel('WARN')).toBe('warning');
  expect(logLevel('FILE UPLOAD')).toBe('info');
  expect(logLevel('INFO')).toBe('info');
});
