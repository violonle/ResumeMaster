import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authAPI } from '@/api'

export const useUserStore = defineStore('user', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem('admin-token'))
  const permissions = ref([])

  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const hasPermission = computed(() => (permission) => permissions.value.includes('*') || permissions.value.includes(permission))

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials)
      
      const { user: userData, token: accessToken } = response.data
      user.value = userData
      token.value = accessToken
      permissions.value = userData.permissions || []
      
      localStorage.setItem('admin-token', accessToken)
      
      return response.data
    } catch (error) {
      throw error
    }
  }

  const logout = async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      user.value = null
      token.value = null
      permissions.value = []
      localStorage.removeItem('admin-token')
    }
  }

  const getProfile = async () => {
    try {
      const response = await authAPI.getProfile()
      user.value = response.data
      permissions.value = response.data.permissions || []
      return response.data
    } catch (error) {
      throw error
    }
  }

  const updateProfile = async (data) => {
    try {
      const response = await authAPI.updateProfile(data)
      user.value = response.data
      return response.data
    } catch (error) {
      throw error
    }
  }

  const initializeAuth = async () => {
    if (token.value) {
      try {
        await getProfile()
        return true
      } catch (error) {
        user.value = null
        token.value = null
        permissions.value = []
        localStorage.removeItem('admin-token')
        return false
      }
    }
    return false
  }

  return {
    user,
    token,
    permissions,
    isLoggedIn,
    hasPermission,
    login,
    logout,
    getProfile,
    updateProfile,
    initializeAuth,
  }
})
