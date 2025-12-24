import { createApp } from 'vue'
import App from './App.vue'
import router from './router'  // 使用新的路由配置
import vuetify from './plugins/vuetify'
import { createPinia } from 'pinia'
import { initializeApp } from './utils/app'

const app = createApp(App)
const pinia = createPinia()

app.use(vuetify)
app.use(router)
app.use(pinia)

initializeApp().then(() => {
  app.mount('#app')
}).catch(error => {
  console.error('App initialization failed:', error)
  // Try to mount anyway so we can see errors
  app.mount('#app')
})