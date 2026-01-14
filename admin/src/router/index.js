import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

import AppLayout from '@/layouts/AppLayout.vue'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { requiresAuth: false, title: '登录' }
  },
  {
    path: '/',
    component: AppLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: 'dashboard' },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/dashboard/PureDashboard.vue'),
        meta: { title: '仪表板', breadcrumb: '仪表板', permission: 'dashboard.view' }
      },
      {
        path: 'customers',
        name: 'customers',
        component: () => import('@/views/customers/PureCustomers.vue'),
        meta: { title: '客户管理', breadcrumb: '客户管理', permission: 'customers.view' }
      },
      {
        path: 'accounts',
        name: 'accounts',
        component: () => import('@/views/customers/PureCustomers.vue'),
        meta: { title: '账号管理', breadcrumb: '账号管理', permission: 'customers.view' }
      },
      {
        path: 'customers/:id',
        name: 'customer-detail',
        component: () => import('@/views/customers/Detail.vue'),
        meta: { title: '客户详情', breadcrumb: '客户详情', permission: 'customers.view' }
      },
      {
        path: 'companies',
        name: 'companies',
        component: () => import('@/views/companies/Index.vue'),
        meta: { title: '企业管理', breadcrumb: '企业管理', permission: 'companies.view' }
      },
      {
        path: 'companies/:id/jobs',
        name: 'company-jobs',
        component: () => import('@/views/companies/CompanyJobs.vue'),
        meta: { title: '企业职位', breadcrumb: '企业职位', permission: 'companies.view' }
      },
      {
        path: 'jobs/:id',
        name: 'job-detail',
        component: () => import('@/views/jobs/Detail.vue'),
        meta: { title: '职位详情', breadcrumb: '职位详情', permission: 'companies.view' }
      },
      {
        path: 'companies/:id',
        name: 'company-detail',
        component: () => import('@/views/companies/Detail.vue'),
        meta: { title: '企业详情', breadcrumb: '企业详情', permission: 'companies.view' }
      },
      {
        path: 'companies/:id/resumes',
        name: 'company-resumes',
        component: () => import('@/views/resumes/CompanyResumes.vue'),
        meta: { title: '企业简历', breadcrumb: '企业简历', permission: 'resumes.view' }
      },
      {
        path: 'resumes',
        name: 'resumes',
        component: () => import('@/views/resumes/Index.vue'),
        meta: { title: '简历管理', breadcrumb: '简历管理', permission: 'resumes.view' }
      },
      {
        path: 'resumes/:id',
        name: 'resume-detail',
        component: () => import('@/views/resumes/Detail.vue'),
        meta: { title: '简历详情', breadcrumb: '简历详情', permission: 'resumes.view' }
      },
      {
        path: 'subscriptions',
        name: 'subscriptions',
        component: () => import('@/views/subscriptions/Index.vue'),
        meta: { title: '订阅管理', breadcrumb: '订阅管理', permission: 'subscriptions.view' }
      },
      {
        path: 'subscriptions/:id',
        name: 'subscription-detail',
        component: () => import('@/views/subscriptions/Detail.vue'),
        meta: { title: '订阅详情', breadcrumb: '订阅详情', permission: 'subscriptions.view' }
      },
      {
        path: 'ai-models',
        name: 'ai-models',
        component: () => import('@/views/ai-models/AIModelsConfig.vue'),
        meta: { title: '大模型管理', breadcrumb: '大模型管理', permission: 'ai_models.view' }
      },
      {
        path: 'sms-config',
        name: 'sms-config',
        component: () => import('@/views/system/Settings.vue'),
        meta: { title: '短信配置', breadcrumb: '短信配置', permission: 'system.settings', defaultTab: 'sms' }
      },
      {
        path: 'email-config',
        name: 'email-config',
        component: () => import('@/views/system/Settings.vue'),
        meta: { title: '邮件配置', breadcrumb: '邮件配置', permission: 'system.settings', defaultTab: 'email' }
      },
      {
        path: 'system-settings',
        name: 'system-settings',
        component: () => import('@/views/system/Settings.vue'),
        meta: { title: '系统设置', breadcrumb: '系统设置', permission: 'system.settings', defaultTab: 'basic' }
      },
      {
        path: 'subscription-plans',
        name: 'subscription-plans',
        component: () => import('@/views/subscriptions/Plans.vue'),
        meta: { title: '订阅计划', breadcrumb: '订阅计划', permission: 'subscriptions.view' }
      },
      {
        path: 'system-logs',
        name: 'system-logs',
        component: () => import('@/views/system/CleanLogs.vue'),
        meta: { title: '系统日志', breadcrumb: '系统日志', permission: 'system.logs' }
      },
      {
        path: 'account-settings',
        name: 'account-settings',
        component: () => import('@/views/account/CleanSettings.vue'),
        meta: { title: '账号设置', breadcrumb: '账号设置' }
      },
      {
        path: 'finance',
        name: 'finance',
        component: () => import('@/views/finance/FinanceList.vue'),
        meta: { title: '财务管理', breadcrumb: '财务管理', permission: 'finance.view' }
      },
      {
        path: 'invoices',
        name: 'invoices',
        component: () => import('@/views/invoices/InvoiceList.vue'),
        meta: { title: '发票管理', breadcrumb: '发票管理', permission: 'invoices.view' }
      },
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  // 尝试初始化会话，验证本地 token 是否有效
  if (!userStore.user && localStorage.getItem('admin-token')) {
    await userStore.initializeAuth()
  }
  if (to.name === 'login' && userStore.isLoggedIn) {
    next({ name: 'dashboard' })
    return
  }
  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    next({ name: 'login' })
    return
  }
  const needPerm = to.meta && to.meta.permission
  const perms = userStore.permissions || []
  if (needPerm && Array.isArray(perms) && perms.length > 0 && !(perms.includes('*') || perms.includes(needPerm))) {
    next('/dashboard')
    return
  }
  next()
})

export default router
