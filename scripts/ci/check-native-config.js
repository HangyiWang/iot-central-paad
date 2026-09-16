const assert = require('node:assert/strict');
const base = require('../../app.json').expo;
const configure = require('../../app.config');

const ci = configure({config: base});
assert.equal(ci.android.package, 'com.iot_pnp.ci');
assert.equal(ci.ios.bundleIdentifier, 'com.microsoft.iotpnp.ci');
assert.deepEqual(ci.ios.associatedDomains, []);
assert.deepEqual(ci.android.intentFilters, []);
assert.deepEqual(ci.ios.entitlements['keychain-access-groups'], [
  'com.microsoft.iotpnp.ci',
]);
assert.equal(ci.ios.appleTeamId, undefined);
const fonts = ci.plugins.find(plugin => plugin[0] === 'expo-font')[1];
assert.equal(fonts.fonts, undefined);
assert.equal(fonts.ios, undefined);
assert.deepEqual(
  fonts.android.fonts.map(font => font.split('/').pop()),
  ci.ios.infoPlist.UIAppFonts,
);

delete process.env.CI;
delete process.env.PAAD_VARIANT;
delete process.env.GITHUB_ACTIONS;
delete require.cache[require.resolve('../../app.config')];
const production = require('../../app.config')({config: base});
assert.equal(production.android.package, 'com.iot_pnp');
assert.equal(production.ios.bundleIdentifier, 'com.microsoft.iotpnp');
assert.deepEqual(production.ios.associatedDomains, [
  'applinks:apps.azureiotcentral.com',
]);
assert.equal(
  production.android.intentFilters[0].data.path,
  '/phone-as-device-app-store',
);
assert.equal(production.ios.appleTeamId, undefined);
console.log('Native production ownership and credential-free CI isolation verified.');
