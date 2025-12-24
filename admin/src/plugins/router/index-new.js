import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'
import { useUserStore } from '@/stores/user'

// 导入布局组件
import DefaultLayout from '@/layouts/default.vue'

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
    component: DefaultLayout, // 直接使用布局组件
    meta: {
      requiresAuth: true,
      title: '仪表板'
    },
    children: [
      {
        path: '',
        component: () => import('@/views/dashboard/Index.vue')
      }
    ]
  },
  {
    path: '/customers',
    name: 'customers',
    component: DefaultLayout,
    meta: {
      requiresAuth: true,
      permission: 'customers.view',
      title: '客户管理'
    },
    children: [
      {
        path: '',
        component: () => import('@/views/customers/Index.vue')
      }
    ]
  },
  {
    path: '/customers/:id',
    name: 'customer-detail',
    component: DefaultLayout,
    meta: {
      requiresAuth: true,
      permission: 'customers.view',
      title: '客户详情'
    },
    children: [
      {
        path: '',
        component: () => import('@/views/customers/Detail.vue')
      }
    ]
  },
  {
    path: '/companies',
    name: 'companies',
    component: DefaultLayout,
    meta: {
      requiresAuth: true,
      permission: 'companies.view',
      title: '企业管理'
    },
    children: [
      {
        path: '',
        component: () => import('@/views/companies/Index.vue')
      }
    ]
  },
  {
    path: '/companies/:id',
    name: 'company-detail',
    component: DefaultLayout,
    meta: {
      requiresAuth: true,
      permission: 'companies.view',
      title: '企业详情'
    },
    children: [
      {
        path: '',
        component: () => import('@/views/companies/Detail.vue')
      }
    ]
  },
  {
    path: '/subscriptions',
    name: 'subscriptions',
    component: DefaultLayout,
    meta: {
      requiresAuth: true,
      permission: 'subscriptions.view',
      title: '订阅管理'
    },
    children: [
      {
        path: '',
        component: () => import('@/views/subscriptions/Index.vue')
      }
    ]
  },
  {
    path: '/subscriptions/:id',
    name: 'subscription-detail',
    component: DefaultLayout,
    meta: {
      requiresAuth: true,
      permission: 'subscriptions.view',
      title: '订阅详情'
    },
    children: [
      {
        path: '',
        component: () => import('@/views/subscriptions/Detail.vue')
      }
    ]
  },
  {
    path: '/ai-models',
    name: 'ai-models',
    component: DefaultLayout,
    meta: {
      requiresAuth: true,
      permission: 'ai_models.view',
      title: '大模型管理'
    },
    children: [
      {
        path: '',
        component: () => import('@/views/ai-models/Index.vue')
      }
    ]
  },
  {
    path: '/system-settings',
    name: 'system-settings',
    component: DefaultLayout,
    meta: {
      requiresAuth: true,
      permission: 'system.settings',
      title: '系统设置'
    },
    children: [
      {
        path: '',
        component: () => import('@/views/system/Settings.vue')
      }
    ]
  },
  {
    path: '/system-logs',
    name: 'system-logs',
    component: DefaultLayout,
    meta: {
      requiresAuth: true,
      permission: 'system.logs',
      title: '系统日志'
    },
    children: [
      {
        path: '',
        component: () => import('@/views/system/Logs.vue')
      }
    ]
  },
  {
    path: '/account-settings',
    name: 'account-settings',
    component: DefaultLayout,
    meta: {
      requiresAuth: true,
      title: '账号设置'
    },
    children: [
      {
        path: '',
        component: () => import('@/views/account/Settings.vue')
      }
    ]
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: routes,
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