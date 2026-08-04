const fs = require('fs');
const os = require('os');
const path = require('path');

const { generateTarget, TARGET_NAME, PRESETS } = require('../generateTarget');

const PACKAGE_ROOT = path.join(__dirname, '..', '..');

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ik-plugin-'));
}

function destOf(projectRoot) {
  return path.join(projectRoot, 'targets', TARGET_NAME);
}

describe('generateTarget', () => {
  let projectRoot;

  beforeEach(() => {
    projectRoot = tmpProject();
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it('writes every preset by default', () => {
    const { dest, files } = generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: {} });

    expect(dest).toBe(destOf(projectRoot));
    expect(files).toEqual(
      [
        'DeliveryAttributes.swift',
        'DeliveryLiveActivity.swift',
        'GenericProgressAttributes.swift',
        'GenericProgressLiveActivity.swift',
        'Info.plist',
        'IslandKitDefaults.swift',
        'IslandKitWidgetBundle.swift',
        'NowPlayingAttributes.swift',
        'NowPlayingLiveActivity.swift',
        'TimerAttributes.swift',
        'TimerLiveActivity.swift',
        'WidgetSupport.swift',
        'expo-target.config.js',
      ].sort()
    );
  });

  it('generates a widget bundle listing every selected widget', () => {
    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: {} });
    const bundle = fs.readFileSync(path.join(destOf(projectRoot), 'IslandKitWidgetBundle.swift'), 'utf8');

    expect(bundle).toContain('@main');
    expect(bundle).toContain('struct IslandKitWidgetBundle: WidgetBundle');
    for (const preset of Object.values(PRESETS)) {
      expect(bundle).toContain(`${preset.widgetType}()`);
    }
  });

  it('narrows the file set and the bundle when presets are selected', () => {
    const { files } = generateTarget({
      packageRoot: PACKAGE_ROOT,
      projectRoot,
      options: { presets: ['timer'] },
    });

    expect(files).toContain('TimerLiveActivity.swift');
    expect(files).toContain('TimerAttributes.swift');
    expect(files).not.toContain('NowPlayingLiveActivity.swift');
    expect(files).not.toContain('NowPlayingAttributes.swift');
    expect(files).not.toContain('DeliveryLiveActivity.swift');
    expect(files).not.toContain('GenericProgressLiveActivity.swift');

    const bundle = fs.readFileSync(path.join(destOf(projectRoot), 'IslandKitWidgetBundle.swift'), 'utf8');
    expect(bundle).toContain('TimerLiveActivity()');
    expect(bundle).not.toContain('NowPlayingLiveActivity()');
  });

  it('removes files left over from a previous wider selection', () => {
    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: {} });
    expect(fs.existsSync(path.join(destOf(projectRoot), 'NowPlayingLiveActivity.swift'))).toBe(true);

    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: { presets: ['timer'] } });
    expect(fs.existsSync(path.join(destOf(projectRoot), 'NowPlayingLiveActivity.swift'))).toBe(false);
  });

  // REGRESSION: fs.copyFileSync follows a symlink at the destination and writes THROUGH it.
  // The example app's targets/*Attributes.swift are symlinks into ios/shared/, so copying
  // onto them would overwrite the canonical single source of truth.
  it('replaces a symlink at the destination instead of writing through it', () => {
    const dest = destOf(projectRoot);
    fs.mkdirSync(dest, { recursive: true });

    const canonical = path.join(packageSharedDir(), 'TimerAttributes.swift');
    const canonicalBefore = fs.readFileSync(canonical, 'utf8');

    const decoy = path.join(projectRoot, 'decoy.swift');
    fs.writeFileSync(decoy, '// decoy — must not be overwritten\n');
    fs.symlinkSync(decoy, path.join(dest, 'TimerAttributes.swift'));

    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: { presets: ['timer'] } });

    const written = path.join(dest, 'TimerAttributes.swift');
    expect(fs.lstatSync(written).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(written, 'utf8')).toBe(canonicalBefore);
    expect(fs.readFileSync(decoy, 'utf8')).toBe('// decoy — must not be overwritten\n');
    expect(fs.readFileSync(canonical, 'utf8')).toBe(canonicalBefore);
  });

  it('is idempotent', () => {
    const first = generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: {} });
    const second = generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: {} });
    expect(second.files).toEqual(first.files);
  });

  it('writes the deployment target into the generated config, defaulting to 16.2', () => {
    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: {} });
    expect(fs.readFileSync(path.join(destOf(projectRoot), 'expo-target.config.js'), 'utf8')).toContain(
      "deploymentTarget: '16.2'"
    );

    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: { deploymentTarget: '17.0' } });
    expect(fs.readFileSync(path.join(destOf(projectRoot), 'expo-target.config.js'), 'utf8')).toContain(
      "deploymentTarget: '17.0'"
    );
  });

  it('omits bundleIdentifier unless it is set, preserving the apple-targets default', () => {
    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: {} });
    expect(fs.readFileSync(path.join(destOf(projectRoot), 'expo-target.config.js'), 'utf8')).not.toContain(
      'bundleIdentifier'
    );

    generateTarget({
      packageRoot: PACKAGE_ROOT,
      projectRoot,
      options: { bundleIdentifier: 'com.example.app.IslandKitExtension' },
    });
    expect(fs.readFileSync(path.join(destOf(projectRoot), 'expo-target.config.js'), 'utf8')).toContain(
      "bundleIdentifier: 'com.example.app.IslandKitExtension'"
    );
  });

  it('carries defaultAccentColor into the generated defaults, nil when unset', () => {
    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: {} });
    expect(fs.readFileSync(path.join(destOf(projectRoot), 'IslandKitDefaults.swift'), 'utf8')).toContain(
      'let islandKitDefaultAccentHex: String? = nil'
    );

    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: { defaultAccentColor: '#FA2D48' } });
    expect(fs.readFileSync(path.join(destOf(projectRoot), 'IslandKitDefaults.swift'), 'utf8')).toContain(
      'let islandKitDefaultAccentHex: String? = "#FA2D48"'
    );
  });

  it('throws on an unknown preset key, naming the valid ones', () => {
    expect(() =>
      generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: { presets: ['nowPlaying', 'nope'] } })
    ).toThrow(/nope/);
    expect(() =>
      generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: { presets: ['nope'] } })
    ).toThrow(/nowPlaying/);
  });

  it('throws on an empty preset list', () => {
    expect(() => generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: { presets: [] } })).toThrow(
      /at least one/i
    );
  });
});

function packageSharedDir() {
  return path.join(PACKAGE_ROOT, 'ios', 'shared');
}
