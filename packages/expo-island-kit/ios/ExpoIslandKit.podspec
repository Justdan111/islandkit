Pod::Spec.new do |s|
  s.name           = 'ExpoIslandKit'
  s.version        = '1.0.0'
  s.summary        = 'A sample project summary'
  s.description    = 'A sample project description'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
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
