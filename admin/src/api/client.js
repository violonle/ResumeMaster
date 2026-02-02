import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const DEBUG = Boolean(import.meta.env.VITE_DEBUG_API)
if (DEBUG) console.log('API Client base URL:', API_BASE_URL)

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin-token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    console.log('[apiClient:req]', config.method.toUpperCase(), config.url, 'Token exists:', !!token)
    if (DEBUG) {
      console.log('[api:req]', (config.method||'get').toUpperCase(), config.url)
    }
    return config
  },
  (error) => {
    if (DEBUG) console.warn('[api:req:error]', error?.message || error)
    return Promise.reject(error)
  }
)

apiClient.interceptors.response.use(
  (response) => {
    if (DEBUG) console.log('[api:res]', response.status, response.config.url)
    
    // 兼容性处理：如果后端返回了 { success: true, data: ... } 结构
    // 则自动解包，让 store 拿到的是真正的业务数据
    if (response.data && response.data.success === true && Object.prototype.hasOwnProperty.call(response.data, 'data')) {
      return {
        ...response,
        data: response.data.data
      }
    }
    
    return response
  },
  (error) => {
    const status = error?.response?.status
    const url = error?.config?.url
    const msg = error?.response?.data?.message || error?.message || 'API Error'
    console.error('[api:error]', status, url, msg)
    if (status === 401 || status === 403) {
      console.warn('[apiClient] Authentication failed, clearing token');
      localStorage.removeItem('admin-token');
      // 不在此处执行 window.location.href 跳转，由路由守卫或 Store 处理
    }
    return Promise.reject(error)
  }
)

export default apiClient
