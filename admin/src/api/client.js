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
    return response
  },
  (error) => {
    const status = error?.response?.status
    const url = error?.config?.url
    const msg = error?.response?.data?.message || error?.message || 'API Error'
    console.error('[api:error]', status, url, msg)
    if (status === 401 || status === 403) {
      localStorage.removeItem('admin-token')
      window.location.href = '/admin/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
