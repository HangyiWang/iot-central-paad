const light = {
  background: '#F5F4F0',
  surface: '#FFFFFF',
  inset: '#F0F2EF',
  text: '#17252A',
  muted: '#596A70',
  border: '#DCE3DF',
  controlBorder: '#788984',
  primary: '#166B72',
  onPrimary: '#FFFFFF',
  positive: '#17634F',
  positiveSurface: '#E3F3EB',
  danger: '#A73C39',
  dangerSurface: '#FBECE9',
  tints: ['#EAF5F1', '#F0EDF8', '#FBEFE7', '#F6F2E4'],
};

const dark = {
  background: '#101C20',
  surface: '#1B2A30',
  inset: '#24373D',
  text: '#F0F4F3',
  muted: '#B1C3C5',
  border: '#35494E',
  controlBorder: '#7E999E',
  primary: '#72D5C2',
  onPrimary: '#142C2A',
  positive: '#97DFC0',
  positiveSurface: '#233D35',
  danger: '#FFB4AC',
  dangerSurface: '#432F30',
  tints: ['#253C35', '#343347', '#433831', '#3D3C2F'],
};

export const palette = (isDark: boolean) => (isDark ? dark : light);

export function cardTint(key: string, isDark: boolean): string {
  const colors = palette(isDark).tints;
  let index = 0;
  for (const character of key) {
    index = (index + character.charCodeAt(0)) % colors.length;
  }
  return colors[index];
}
