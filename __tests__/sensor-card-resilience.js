import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Card} from '../src/components/card';
import {StyleSheet, TouchableOpacity} from 'react-native';
import {Properties} from '../src/properties';

jest.mock('../src/hooks', () => ({
  useTheme: () => ({dark: false, colors: {text: '#111', card: '#fff'}}),
}));
jest.mock('../src/components', () => ({Button: 'Button'}));
jest.mock('../src/components/typography', () => ({
  Text: 'Text',
  Name: 'Name',
  Headline: 'Headline',
  getRandomColor: () => '#000',
  normalize: value => value,
  bytesToSize: value => `${value} bytes`,
}));
jest.mock('@rneui/themed', () => ({Icon: 'Icon', Input: 'Input'}));

let view;
const render = props =>
  act(() => {
    view = renderer.create(<Card title="Location" enabled={true} {...props} />);
  });
const text = () => JSON.stringify(view.toJSON());
afterEach(() => act(() => view?.unmount()));

it('renders null location fields safely with units and explicit simulation metadata', () => {
  render({
    dataType: 'object',
    value: {lat: 0, lon: 0, alt: null},
    simulated: true,
    unit: '°',
  });
  expect(text()).toContain('N/A');
  expect(text()).toContain('Simulated data');
  expect(text()).toContain('°');
});
it('shows availability instead of presenting stale readings as current', () => {
  render({value: 987, dataType: 'number', availability: 'unavailable'});
  expect(text()).toContain('Unavailable');
  expect(text()).not.toContain('"987"');
});
it('does not show a disabled sensor value as live', () => {
  render({value: 987, enabled: false});
  expect(text()).toContain('Disabled');
  expect(text()).not.toContain('"987"');
});

it('lets long readings grow instead of clipping them into a fixed-height tile', () => {
  render({value: {x: 12.5, y: -100.125, altitude: null}, dataType: 'object'});
  const style = StyleSheet.flatten(
    view.root.findByType(TouchableOpacity).props.style,
  );
  expect(style.height).toBeUndefined();
  expect(style.minHeight).toBeGreaterThanOrEqual(140);
  expect(text()).toContain('altitude');
  expect(text()).toContain('N/A');
});

it('shows a purposeful cloud empty state instead of an unavailable-value abbreviation', () => {
  const property = Properties.find(item => item.id === 'writeableProp');
  render({...property, title: property.name, accentKey: property.id});
  expect(text()).toContain('Waiting for a cloud update');
  expect(text()).toContain('Values set in your IoT application appear here.');
  expect(text()).not.toContain('N/A');
});

it('starts the editable device property empty with an accessible input and a real placeholder', () => {
  const property = Properties.find(item => item.id === 'readOnlyProp');
  const edit = jest.fn();
  expect(property.value).toBeUndefined();
  render({
    ...property,
    title: property.name,
    accentKey: property.id,
    onEdit: edit,
  });
  const input = view.root.findByType('Input');
  expect(input.props.value).toBe('');
  expect(input.props.placeholder).toBe('Enter a value to share');
  expect(input.props.accessibilityLabel).toBe('Device property');
  expect(input.props.inputStyle.minHeight).toBeGreaterThanOrEqual(48);
  expect(view.root.findByType('Button').props.disabled).toBe(true);
  act(() => input.props.onChangeText('A real device value'));
  expect(view.root.findByType('Button').props.disabled).toBe(false);
  act(() => view.root.findByType('Button').props.onPress());
  expect(edit).toHaveBeenCalledWith('A real device value');
  expect(text()).not.toContain('N/A');
});

it.each([0, false])(
  'does not confuse the valid value %s with an empty property',
  value => {
    render({value, presentation: {emptyLabel: 'Waiting for a cloud update'}});
    expect(view.root.findByType('Headline').props.children).toBe(String(value));
    expect(text()).not.toContain('Waiting for a cloud update');
  },
);

it('lets an existing editable value be deliberately cleared and follows new source values', () => {
  const edit = jest.fn();
  render({value: 'old value', editable: true, onEdit: edit});
  act(() => view.root.findByType('Input').props.onChangeText(''));
  expect(view.root.findByType('Button').props.disabled).toBe(false);
  act(() => view.root.findByType('Button').props.onPress());
  expect(edit).toHaveBeenCalledWith('');
  act(() =>
    view.update(
      <Card
        title="Property"
        enabled
        value="new value"
        editable
        onEdit={edit}
      />,
    ),
  );
  expect(view.root.findByType('Input').props.value).toBe('new value');
});

it('uses the same clear label/value hierarchy for property and telemetry cards', () => {
  render({value: 12.5, dataType: 'number'});
  const label = view.root.findByProps({testID: 'card-label'});
  const value = view.root.findByProps({testID: 'card-value'});
  expect(StyleSheet.flatten(label.props.style).fontSize).toBeLessThan(
    StyleSheet.flatten(value.props.style).fontSize,
  );
  expect(StyleSheet.flatten(label.props.style).color).not.toBe(
    StyleSheet.flatten(value.props.style).color,
  );
});
