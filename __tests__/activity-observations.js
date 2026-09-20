import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {FlatList} from 'react-native';
import Activity, {
  CommunicationSummary,
  communicationObservations,
  isObservationIssue,
  ObservationRow,
  observationTitle,
} from '../src/experience/Activity';
import {StorageContext} from '../src/contexts/storage';

let mockSnapshot;
jest.mock('../src/observation', () => ({
  useObservationSnapshot: () => mockSnapshot,
}));
jest.mock('../src/runtime/DeviceRuntime', () => ({
  useDeviceRuntime: () => ({client: null}),
}));
jest.mock('../src/hooks', () => ({
  useTheme: () => ({dark: false, colors: {text: '#17252A'}}),
}));
jest.mock('@rneui/themed', () => ({Icon: 'Icon', Text: 'Text'}));
jest.mock('../src/Logs', () => 'DiagnosticsViewer');
jest.mock('@react-navigation/native', () => ({useIsFocused: () => true}));

const event = (id, detail) => ({
  id,
  generation: 3,
  observedAt: 1000 + id,
  observer: 'device-app',
  simulated: false,
  identity: {
    assignedHub: 'fixture.azure-devices.net',
    deviceId: 'assigned-fixture',
    modelId: 'dtmi:azureiot:PhoneAsADevice;2',
  },
  ...detail,
});
const snapshot = (history = [], latest = {}) => ({
  active: true,
  generation: 3,
  simulated: false,
  identity: null,
  history,
  latest,
  bytes: 0,
});
let view;
const press = id =>
  view.root
    .findAllByProps({testID: id})
    .find(node => typeof node.props.onPress === 'function')
    .props.onPress();
const text = () =>
  view.root
    .findAllByType('Text')
    .flatMap(node =>
      React.Children.toArray(node.props.children).filter(
        child => typeof child === 'string',
      ),
    )
    .join('\n');
afterEach(() =>
  act(() => {
    view?.unmount();
    view = undefined;
  }),
);

it('selects latest deliberate outgoing interaction without periodic telemetry burying it', () => {
  const property = event(1, {
    kind: 'reported-property',
    names: ['readOnlyProp'],
    outcome: 'submitted',
  });
  const telemetry = event(99, {
    kind: 'telemetry',
    names: ['battery'],
    outcome: 'submitted',
  });
  const command = event(2, {
    kind: 'command',
    name: 'lightOn',
    correlation: null,
    outcome: 'observed',
  });
  const source = snapshot([], {
    'reported-property': property,
    telemetry,
    command,
  });
  expect(communicationObservations(source)).toEqual({
    outbound: property,
    inbound: command,
  });
  const upload = event(100, {
    kind: 'upload',
    outcome: 'acknowledged',
    status: 201,
  });
  expect(
    communicationObservations({...source, latest: {...source.latest, upload}})
      .outbound,
  ).toBe(upload);
  expect(communicationObservations({...source, active: false})).toEqual({
    outbound: undefined,
    inbound: undefined,
  });
  expect(communicationObservations(snapshot([], {telemetry})).outbound).toBe(
    telemetry,
  );
});

it('distinguishes initial twin observations, patch updates, local replies and physical execution', () => {
  const desired = {
    kind: 'desired-property',
    name: 'writeableProp',
    version: 8,
    outcome: 'observed',
  };
  expect(observationTitle(event(1, {...desired, source: 'twin'}))).toBe(
    'Initial twin value observed by this phone',
  );
  expect(observationTitle(event(2, {...desired, source: 'patch'}))).toBe(
    'Desired-property update observed by this phone',
  );
  expect(
    observationTitle(
      event(3, {
        kind: 'command-reply',
        name: 'lightOn',
        correlation: null,
        response: 'success',
        outcome: 'submitted',
      }),
    ),
  ).toBe('Command response submitted locally');
  expect(
    observationTitle(
      event(4, {kind: 'telemetry', names: ['battery'], outcome: 'simulated'}),
    ),
  ).toBe('Telemetry simulated locally');
  expect(
    isObservationIssue(
      event(5, {
        kind: 'command-execution',
        name: 'lightOn',
        correlation: null,
        outcome: 'rejected',
      }),
    ),
  ).toBe(true);
  expect(
    isObservationIssue(
      event(6, {
        kind: 'command-reply',
        name: 'lightOn',
        correlation: null,
        response: 'error',
        outcome: 'submitted',
      }),
    ),
  ).toBe(true);
});

it('renders truthful empty and simulated summaries without example timestamps', () => {
  mockSnapshot = snapshot();
  act(() => {
    view = renderer.create(
      <StorageContext.Provider value={{simulated: true}}>
        <CommunicationSummary />
      </StorageContext.Provider>,
    );
  });
  expect(text()).toContain('No outgoing observation in this session.');
  expect(text()).toContain('No incoming observation in this session.');
  expect(text()).toContain('Simulation - no cloud traffic');
  expect(text()).not.toContain('09:38');
});

it('preserves chronological history, Issues, diagnostics access, and explicit Latest without auto-scroll', () => {
  const good = event(1, {
    kind: 'reported-property',
    names: ['readOnlyProp'],
    outcome: 'submitted',
  });
  const failed = event(2, {
    kind: 'upload',
    outcome: 'failed',
    errorCode: 'OPERATION_FAILED',
  });
  mockSnapshot = snapshot([good, failed]);
  const scroll = jest
    .spyOn(FlatList.prototype, 'scrollToEnd')
    .mockImplementation(() => {});
  act(() => {
    view = renderer.create(<Activity />);
  });
  const list = () => view.root.findByType(FlatList).props;
  expect(list().data).toEqual([good, failed]);
  expect(scroll).not.toHaveBeenCalled();
  act(() => press('activity-filter-issues'));
  expect(list().data).toEqual([failed]);
  act(() => press('activity-latest'));
  expect(scroll).toHaveBeenCalledWith({animated: false});
  act(() => press('activity-diagnostics'));
  expect(view.root.findAllByType('DiagnosticsViewer')).toHaveLength(1);
  act(() => press('activity-observations'));
  expect(list().data).toEqual([failed]);
  const later = event(3, {kind: 'twin-request', outcome: 'submitted'});
  mockSnapshot = snapshot([good, failed, later]);
  act(() => view.update(<Activity />));
  expect(scroll).toHaveBeenCalledTimes(1);
  act(() => press('activity-filter-all'));
  expect(list().data).toEqual([good, failed, later]);
  scroll.mockRestore();
});

it('keeps latest-only telemetry inspectable without manufacturing history rows', () => {
  const telemetry = event(1, {
    kind: 'telemetry',
    names: ['battery'],
    outcome: 'submitted',
  });
  mockSnapshot = snapshot([], {telemetry});
  act(() => {
    view = renderer.create(<Activity />);
  });
  expect(view.root.findByType(FlatList).props.data).toHaveLength(0);
  expect(text()).toContain('Telemetry submitted locally');
  expect(text()).not.toContain('No communication observed in this session');
  act(() => press('activity-filter-issues'));
  expect(text()).toContain('No failed operations observed');
});

it('expands only safe typed metadata and labels command execution limitations', () => {
  const command = event(7, {
    kind: 'command-execution',
    name: 'sensors*changeInterval',
    correlation: {category: 'requestId', value: 'request-7'},
    outcome: 'requested',
  });
  act(() => {
    view = renderer.create(<ObservationRow event={command} />);
  });
  expect(text()).not.toContain('request-7');
  act(() => press('activity-toggle-7'));
  expect(text()).toContain('request-7');
  expect(text()).toContain('assigned-fixture');
  expect(text()).toContain(
    'A handler outcome is not independent confirmation of a physical effect.',
  );
  expect(
    view.root
      .findAllByType('Text')
      .some(
        node => node.props.selectable && node.props.children === 'request-7',
      ),
  ).toBe(true);
});
