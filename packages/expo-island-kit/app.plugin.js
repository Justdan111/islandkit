// IslandKit config plugin.
//
// Generates the widget extension target from the sources shipped in this package, so
// consumers write zero Swift. Applied once via createRunOncePlugin.
//
// Ordering is load-bearing: @bacons/apple-targets' withTargetsDir globs targets/ at
// plugin-EVAL time, so the target must already be on disk before we apply it.
const { withInfoPlist, createRunOncePlugin } = require('@expo/config-plugins');
const withTargetsDir = require('@bacons/apple-targets/app.plugin');

const pkg = require('./package.json');
const { generateTarget } = require('./plugin/generateTarget');

const KNOWN_OPTIONS = ['presets', 'deploymentTarget', 'bundleIdentifier', 'defaultAccentColor'];

// Options documented in the product docs that this version does not implement, with the
// reason. Surfaced as warnings rather than errors so a consumer copying an older snippet
// gets a build, not a wall.
const UNSUPPORTED_OPTIONS = {
  appleTeamId: 'set `ios.appleTeamId` in your app config instead — the widget target signs from it',
  groupIdentifier: 'App Groups are not supported yet (requires a paid Apple Developer account)',
  enablePushNotifications: 'push updates are not supported yet (requires a paid Apple Developer account)',
};

function warnUnsupportedOptions(options) {
  for (const key of Object.keys(options)) {
    if (KNOWN_OPTIONS.includes(key)) continue;
    const reason = UNSUPPORTED_OPTIONS[key];
    if (reason) {
      console.warn(`expo-island-kit: the "${key}" option is not supported — ${reason}.`);
    } else {
      console.warn(
        `expo-island-kit: unknown option "${key}" ignored. Supported options: ${KNOWN_OPTIONS.join(', ')}.`
      );
    }
  }
}

// withTargetsDir is applied by THIS plugin. A consumer who also lists @bacons/apple-targets
// gets it applied twice, which fails with "target ... already exists"
// (withIosXcodeProjectBeta2BaseMod: Cannot read properties of undefined). Warn clearly —
// but don't throw, so an unusual setup keeps its escape hatch.
function warnOnDoubleApplication(config) {
  const plugins = config.plugins || [];
  const listed = plugins.some((entry) => {
    const name = Array.isArray(entry) ? entry[0] : entry;
    return typeof name === 'string' && name.includes('@bacons/apple-targets');
  });
  if (listed) {
    console.warn(
      'expo-island-kit: remove "@bacons/apple-targets" from your plugins array — expo-island-kit ' +
        'applies it for you, and listing both applies it twice.'
    );
  }
}

const withIslandKit = (config, options = {}) => {
  warnUnsupportedOptions(options);
  warnOnDoubleApplication(config);

  // projectRoot is available on _internal at plugin-eval during prebuild; fall back
  // defensively for other config-resolution paths (e.g. `expo config`).
  const projectRoot = (config._internal && config._internal.projectRoot) || process.cwd();

  // MUST run before withTargetsDir globs targets/. Option validation happens inside
  // generateTarget and throws with the valid preset list.
  generateTarget({ packageRoot: __dirname, projectRoot, options });

  config = withInfoPlist(config, (c) => {
    c.modResults.NSSupportsLiveActivities = true;
    return c;
  });

  return withTargetsDir(config, { root: './targets' });
};

module.exports = createRunOncePlugin(withIslandKit, pkg.name, pkg.version);
