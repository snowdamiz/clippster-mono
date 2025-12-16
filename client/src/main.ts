import { createApp, nextTick } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { vTooltip, setupGlobalTooltips } from './directives/tooltip';
import './style.css';
import './fonts.css';

const app = createApp(App);
const pinia = createPinia();

// Register custom tooltip directive
app.directive('tooltip', vTooltip);

app.use(pinia);
app.use(router);
app.mount('#app');

// Setup global tooltip interception after Vue has mounted and rendered
nextTick(() => {
  setupGlobalTooltips();
});
