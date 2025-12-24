import { createRouter, createWebHistory } from 'vue-router'
import { setupLayouts } from 'virtual:generated-layouts'
import { nextTick } from 'vue'
import { useUserStore } from '@/stores/user'

// 基础路由配置
const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/Login.vue'),
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/dashboard/Index.vue'),
    meta: {
      requiresAuth: true,
      layout: 'test',
      title: '仪表板'
    },
  },
  {
    path: '/customers',
    name: 'customers',
    component: () => import('@/views/customers/Index.vue'),
    meta: {
      requiresAuth: true,
      permission: 'customers.view',
      layout: 'test',
      title: '客户管理'
    },
  },
  {
    path: '/customers/:id',
    name: 'customer-detail',
    component: () => import('@/views/customers/Detail.vue'),
    meta: {
      requiresAuth: true,
      permission: 'customers.view',
      layout: 'default',
      title: '客户详情'
    },
  },
  {
    path: '/companies',
    name: 'companies',
    component: () => import('@/views/companies/Index.vue'),
    meta: {
      requiresAuth: true,
      permission: 'companies.view',
      layout: 'default',
      title: '企业管理'
    },
  },
  {
    path: '/companies/:id',
    name: 'company-detail',
    component: () => import('@/views/companies/Detail.vue'),
    meta: {
      requiresAuth: true,
      permission: 'companies.view',
      layout: 'default',
      title: '企业详情'
    },
  },
  {
    path: '/subscriptions',
    name: 'subscriptions',
    component: () => import('@/views/subscriptions/Index.vue'),
    meta: {
      requiresAuth: true,
      permission: 'subscriptions.view',
      layout: 'default',
      title: '订阅管理'
    },
  },
  {
    path: '/subscriptions/:id',
    name: 'subscription-detail',
    component: () => import('@/views/subscriptions/Detail.vue'),
    meta: {
      requiresAuth: true,
      permission: 'subscriptions.view',
      layout: 'default',
      title: '订阅详情'
    },
  },
  {
    path: '/ai-models',
    name: 'ai-models',
    component: () => import('@/views/ai-models/Index.vue'),
    meta: {
      requiresAuth: true,
      permission: 'ai_models.view',
      layout: 'default',
      title: '大模型管理'
    },
  },
  {
    path: '/system-settings',
    name: 'system-settings',
    component: () => import('@/views/system/Settings.vue'),
    meta: {
      requiresAuth: true,
      permission: 'system.settings',
      layout: 'default',
      title: '系统设置'
    },
  },
  {
    path: '/system-logs',
    name: 'system-logs',
    component: () => import('@/views/system/Logs.vue'),
    meta: {
      requiresAuth: true,
      permission: 'system.logs',
      layout: 'default',
      title: '系统日志'
    },
  },
  {
    path: '/account-settings',
    name: 'account-settings',
    component: () => import('@/views/account/Settings.vue'),
    meta: {
      requiresAuth: true,
      layout: 'default',
      title: '账号设置'
    },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: setupLayouts(routes),
})

router.beforeEach(async (to, from, next) => {
  // 等待下一个tick确保store可用
  await nextTick()
  const userStore = useUserStore()
  
  console.log('Router beforeEach:', to.path, 'requiresAuth:', to.meta.requiresAuth, 'isLoggedIn:', userStore.isLoggedIn)
  
  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    console.log('Redirecting to login - not authenticated')
    next('/login')
  } else {
    console.log('Allowing navigation to:', to.path)
    next()
  }
})

export default router