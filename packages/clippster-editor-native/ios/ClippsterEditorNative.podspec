require 'json'

package = if File.exist?(File.join(__dir__, '..', 'package.json'))
  JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))
else
  { 'version' => '0.1.0', 'description' => 'Clippster native editor engine' }
end

Pod::Spec.new do |s|
  s.name           = 'ClippsterEditorNative'
  s.version        = package['version'] || '0.1.0'
  s.summary        = package['description'] || 'Clippster native editor engine'
  s.description    = package['description'] || 'Clippster native editor engine for iOS and Android'
  s.license        = { type: 'Proprietary' }
  s.author         = 'Clippster'
  s.homepage       = 'https://clippster.app'
  s.platforms      = { ios: '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/clippster/clippster-mono.git', tag: s.version }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.public_header_files = 'GraphBridge.h'
  s.source_files = [
    '**/*.{h,m,mm,swift}',
    '../cpp/src/*.{cc,cpp,cxx}',
    '../cpp/include/**/*.{h,hpp}'
  ]
  s.header_mappings_dir = '../cpp/include'
  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'CLANG_CXX_LIBRARY' => 'libc++',
    'HEADER_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/../cpp/include"',
    'DEFINES_MODULE' => 'YES'
  }
end
