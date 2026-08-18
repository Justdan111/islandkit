Pod::Spec.new do |s|
  s.name           = 'ExpoIslandKit'
  s.version        = '1.0.0'
  s.summary        = 'Drop-in iOS Live Activities and Dynamic Island presets for Expo'
  s.description    = 'Pre-built Live Activity and Dynamic Island presets — Now Playing, Generic Progress, Delivery and Timer — with a TypeScript-only API.'
  s.author         = 'Justdan111'
  s.homepage       = 'https://github.com/Justdan111/islandkit'
  # iOS-only. Deployment target is kept low so the module can be linked into
  # apps supporting older iOS; the Live Activities / ActivityKit code is guarded
  # with `@available(iOS 16.1, *)` and no-ops below it (graceful degradation).
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
