/** @type {(config: { name: string }) => import('@bacons/apple-targets').Config} */
module.exports = (config) => ({
  type: 'widget',
  name: 'island-kit-widget',
  deploymentTarget: '16.2',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
});
