import axios, { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = '/api';

const instance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
instance.interceptors.response.use(
  (response: AxiosResponse) => {
    // 后端返回的结构通常是 { success: true, data: ... } 或 { success: false, error: ... }
    const res = response.data;
    if (res.success) {
      return res.data;
    } else {
      const errorMsg = typeof res.error === 'object' ? (res.error.message || JSON.stringify(res.error)) : (res.error || '请求失败');
      return Promise.reject(new Error(errorMsg));
    }
  },
  (error: any) => {
    let message = '网络错误';
    if (error.response?.data?.error) {
      const apiError = error.response.data.error;
      message = typeof apiError === 'object' ? (apiError.message || JSON.stringify(apiError)) : apiError;
    } else if (error.message) {
      message = error.message;
    }
    return Promise.reject(new Error(message));
  }
);

export const request = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return instance.get(url, config);
  },
  post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return instance.post(url, data, config);
  },
  put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return instance.put(url, data, config);
  },
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return instance.delete(url, config);
  },
};
