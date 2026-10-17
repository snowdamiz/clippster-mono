import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { router, route, RouterLink } from './accountRouter'
const app = createApp(App)
app.config.globalProperties.$router = router
app.config.globalProperties.$route = route
app.component('RouterLink', RouterLink)
app.mount('#app')
