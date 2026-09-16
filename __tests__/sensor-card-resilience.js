import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Card} from '../src/components/card';

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
