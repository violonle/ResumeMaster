import apiClient from './client'

export const authAPI = {
  login: (credentials) => apiClient.post('/admin/login', credentials),
  logout: () => apiClient.post('/auth/logout'),
  getProfile: () => apiClient.get('/admin/profile'),
  updateProfile: (data) => apiClient.put('/admin/profile', data),
}

export const customerAPI = {
  getList: (params) => apiClient.get('/admin/accounts', { params }),
  getDetail: (id) => apiClient.get(`/admin/accounts/${id}`),
  create: (data) => apiClient.post('/admin/accounts', data),
  update: (id, data) => apiClient.patch(`/admin/accounts/${id}`, data),
  delete: (id) => apiClient.delete(`/admin/accounts/${id}`),
  getStats: () => apiClient.get('/admin/accounts/stats'),
}

export const companyAPI = {
  getList: (params) => apiClient.get('/admin/companies', { params }),
  getDetail: (id) => apiClient.get(`/admin/companies/${id}`),
  create: (data) => apiClient.post('/admin/companies', data),
  update: (id, data) => apiClient.patch(`/admin/companies/${id}`, data),
  delete: (id) => apiClient.delete(`/admin/companies/${id}`),
  verify: (id, data) => apiClient.post(`/admin/companies/${id}/verify`, data),
  getStats: () => apiClient.get('/admin/companies/stats'),
  upload: (id, formData) => apiClient.post(`/admin/companies/${id}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
}

export const jobAPI = {
  getList: (params) => apiClient.get('/admin/jobs', { params }),
  getDetail: (id) => apiClient.get(`/admin/jobs/${id}`),
  create: (data) => apiClient.post('/admin/jobs', data),
  update: (id, data) => apiClient.patch(`/admin/jobs/${id}`, data),
  delete: (id) => apiClient.delete(`/admin/jobs/${id}`),
  getStats: () => apiClient.get('/admin/jobs/stats'),
}

export const resumeAPI = {
  getList: (params) => apiClient.get('/admin/resumes', { params }),
  getDetail: (id) => apiClient.get(`/admin/resumes/${id}`),
  getStats: () => apiClient.get('/admin/resumes/stats'),
}

export const subscriptionAPI = {
  getList: (params) => apiClient.get('/admin/subscriptions', { params }),
  getDetail: (companyId) => apiClient.get(`/admin/subscriptions/${companyId}`),
  create: (data) => apiClient.post(`/admin/subscriptions/${data.companyId}/change`, data),
  update: (id, data) => apiClient.patch(`/admin/subscriptions/${id}`, data),
  delete: (id) => apiClient.delete(`/admin/subscriptions/${id}`),
  renew: (companyId) => apiClient.post(`/admin/subscriptions/${companyId}/change`, { action: 'renew' }),
  cancel: (companyId) => apiClient.post(`/admin/subscriptions/${companyId}/change`, { action: 'cancel', plan: 'free' }),
  getPlans: () => apiClient.get('/admin/subscriptions/plans'),
  getStats: () => apiClient.get('/admin/subscriptions/stats'),
  createPlan: (data) => apiClient.post('/admin/subscriptions/plans', data),
  updatePlan: (id, data) => {
    if (typeof id === 'number') return apiClient.put(`/admin/subscriptions/plans/${id}`, data)
    return apiClient.put(`/admin/subscriptions/plans/by-key/${id}`, data)
  },
  deletePlan: (id) => {
    if (typeof id === 'number') return apiClient.delete(`/admin/subscriptions/plans/${id}`)
    return apiClient.delete(`/admin/subscriptions/plans/by-key/${id}`)
  },
}

export const aiModelAPI = {
  getList: (params) => apiClient.get('/admin/models/providers', { params }),
  getDetail: (id) => apiClient.get(`/admin/models/providers/${id}`),
  create: (data) => apiClient.post('/admin/models/providers', data),
  update: (id, data) => apiClient.patch(`/admin/models/providers/${id}`, data),
  delete: (id) => apiClient.delete(`/admin/models/providers/${id}`),
  test: (id, data) => apiClient.post(`/admin/models/keys/${id}/test`, data),
  batchTest: (data) => apiClient.post('/admin/models/keys/batch-test', { keyIds: data.modelIds, testType: data.testType, prompt: data.prompt }),
  getPlatforms: () => apiClient.get('/admin/ai-providers/platforms'),
  getModelsByPlatform: (platform) => apiClient.get('/admin/ai-providers/models', { params: { provider: platform } }),
  getKeys: (params) => apiClient.get('/admin/models/keys', { params }),
  createKey: (data) => apiClient.post('/admin/models/keys', data),
  updateKey: (id, data) => apiClient.patch(`/admin/models/keys/${id}`, data),
  deleteKey: (id) => apiClient.delete(`/admin/models/keys/${id}`),
  getAIConfig: () => apiClient.get('/admin/ai-config'),
  updateAIConfig: (data) => apiClient.put('/admin/ai-config', data),
  testAIProvider: (provider) => apiClient.post('/admin/ai-config/test', { provider }),
  listProviderModels: (provider) => apiClient.get('/admin/ai-providers/models', { params: { provider } }),
}

export const promptAPI = {
  getList: () => apiClient.get('/admin/prompts'),
  getDetail: (key) => apiClient.get(`/admin/prompts/${key}`),
  create: (data) => apiClient.post('/admin/prompts', data),
  update: (key, data) => apiClient.put(`/admin/prompts/${key}`, data),
}

export const interviewAPI = {
  createSession: (data) => apiClient.post('/interview/sessions', data),
  findUnfinishedSession: (resumeId) => apiClient.get(`/interview/sessions/unfinished/${resumeId}`),
  getSession: (sessionId) => apiClient.get(`/interview/sessions/${sessionId}`),
}

export const systemAPI = {
  // 系统设置
  getSettings: () => apiClient.get('/admin/system/settings'),
  updateSettings: (data) => apiClient.put('/admin/system/settings', data),

  // 短信设置
  getSmsSettings: () => apiClient.get('/admin/system/sms'),
  updateSmsSettings: (data) => apiClient.put('/admin/system/sms', data),
  testSms: (data) => apiClient.post('/admin/system/sms/test', data),
  checkSms: () => apiClient.get('/admin/system/sms/check'),

  // 邮件设置
  getEmailSettings: () => apiClient.get('/admin/system/email'),
  updateEmailSettings: (data) => apiClient.put('/admin/system/email', data),
  testEmail: (data) => apiClient.post('/admin/system/email/test', data),

  // 通知设置
  getNotificationSettings: () => apiClient.get('/admin/system/notifications'),
  updateNotificationSettings: (data) => apiClient.put('/admin/system/notifications', data),

  // 权限管理
  getRoles: () => apiClient.get('/admin/system/roles'),
  createRole: (data) => apiClient.post('/admin/system/roles', data),
  updateRole: (id, data) => apiClient.put(`/admin/system/roles/${id}`, data),
  deleteRole: (id) => apiClient.delete(`/admin/system/roles/${id}`),
  getPermissions: () => apiClient.get('/admin/system/permissions'),

  // 日志管理
  getLogs: (params) => apiClient.get('/admin/system/logs', { params }),
  getLogDetail: (id) => apiClient.get(`/admin/system/logs/${id}`),
  exportLogs: (params) => apiClient.get('/admin/system/logs/export', { params, responseType: 'blob' }),
}

export const dashboardAPI = {
  getStats: () => apiClient.get('/admin/dashboard/stats'),
  getChartData: (type) => apiClient.get(`/admin/dashboard/charts/${type}`),
  getRecentActivities: () => apiClient.get('/admin/dashboard/activities'),
}

export const financeAPI = {
  getOrders: (params) => apiClient.get('/payment/orders', { params }),
  getStats: () => apiClient.get('/payment/stats'), // Need to implement this backend endpoint if not exists, or use orders count
}

export const invoiceAPI = {
  getList: (params) => apiClient.get('/invoices/all', { params }),
  getDetail: (id) => apiClient.get(`/invoices/${id}`),
  create: (data) => apiClient.post('/invoices', data),
  update: (id, data) => apiClient.put(`/invoices/${id}`, data),
  red: (id, data) => apiClient.post(`/invoices/${id}/red`, data),
  getStats: () => apiClient.get('/invoices/stats'),
}
