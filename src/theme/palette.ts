const light = {
  background: '#F4F1EA',
  gradientStart: '#F7F6F2',
  gradientEnd: '#EFEEE8',
  surface: '#FDFBF7',
  inset: '#ECEEE5',
  text: '#26302A',
  muted: '#55635A',
  border: '#D9DFD5',
  controlBorder: '#75836F',
  primary: '#285A48',
  onPrimary: '#FFFFFF',
  positive: '#17634F',
  positiveSurface: '#E3F3EB',
  danger: '#A73C39',
  dangerSurface: '#FBECE9',
  tints: ['#E5EDE3', '#ECE6F2', '#F4E7DB', '#E7EDEB'],
  toolSurfaces: ['#DCEFE7', '#E5E1F6', '#FAE3D3', '#DBE8F7'],
  toolAccents: ['#1E7A66', '#4A46A0', '#9A5426', '#1F5B94'],
  toolOnAccent: '#FFFFFF',
};

const dark = {
  background: '#12221E',
  gradientStart: '#162720',
  gradientEnd: '#101D1A',
  surface: '#1C2D26',
  inset: '#263A30',
  text: '#ECF3EE',
  muted: '#B5C5B9',
  border: '#384D40',
  controlBorder: '#869C8A',
  primary: '#91CEB2',
  onPrimary: '#142C2A',
  positive: '#97DFC0',
  positiveSurface: '#233D35',
  danger: '#FFB4AC',
  dangerSurface: '#432F30',
  tints: ['#253C35', '#343347', '#433831', '#3D3C2F'],
  toolSurfaces: ['#1D3A33', '#2B2947', '#3C2A1E', '#1C3047'],
  toolAccents: ['#64C8AE', '#A9A2F0', '#E5A776', '#86BDF0'],
  toolOnAccent: '#142C2A',
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
