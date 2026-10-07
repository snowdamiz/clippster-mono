import { createApp } from 'vue'
import Harness from './Harness.vue'
import AuthHarness from './AuthHarness.vue'
if (new URLSearchParams(location.search).get('theme') === 'desktop') await import('./desktop.css')
else await import('../../src/style.css')
createApp(
  new URLSearchParams(location.search).get('view') === 'auth' ? AuthHarness : Harness
).mount('#app')
