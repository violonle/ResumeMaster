import { defineStore } from 'pinia'
import { ref } from 'vue'
import { systemAPI } from '@/api'

export const useSystemStore = defineStore('system', () => {
  const settings = ref({
    siteName: '',
    siteDescription: '',
    siteLogo: '',
    contactEmail: '',
    contactPhone: '',
    icpNumber: '',
    analyticsCode: '',
  })
  
  const smsSettings = ref({
    provider: 'aliyun',
    accessKeyId: '',
    accessKeySecret: '',
    signName: '',
    templateCode: '',
    enabled: false,
  })
  
  const notificationSettings = ref({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    systemNotifications: true,
  })
  
  const roles = ref([])
  const permissions = ref([])
  const logs = ref([])
  const totalLogs = ref(0)
  const logFilters = ref({
    page: 1,
    itemsPerPage: 20,
    level: '',
    module: '',
    startDate: '',
    endDate: '',
  })
  
  const loading = ref(false)

  const fetchSettings = async () => {
    loading.value = true
    try {
      const response = await systemAPI.getSettings()
      settings.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to fetch settings:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const updateSettings = async (data) => {
    try {
      const response = await systemAPI.updateSettings(data)
      settings.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to update settings:', error)
      throw error
    }
  }

  const fetchSmsSettings = async () => {
    try {
      const response = await systemAPI.getSmsSettings()
      smsSettings.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to fetch SMS settings:', error)
      throw error
    }
  }

  const updateSmsSettings = async (data) => {
    try {
      const response = await systemAPI.updateSmsSettings(data)
      smsSettings.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to update SMS settings:', error)
      throw error
    }
  }

  const testSms = async (data) => {
    try {
      const response = await systemAPI.testSms(data)
      return response.data
    } catch (error) {
      console.error('Failed to test SMS:', error)
      throw error
    }
  }

  const checkSms = async () => {
    try {
      const response = await systemAPI.checkSms()
      return response.data
    } catch (error) {
      console.error('Failed to check SMS:', error)
      throw error
    }
  }

  const fetchNotificationSettings = async () => {
    try {
      const response = await systemAPI.getNotificationSettings()
      notificationSettings.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to fetch notification settings:', error)
      throw error
    }
  }

  const updateNotificationSettings = async (data) => {
    try {
      const response = await systemAPI.updateNotificationSettings(data)
      notificationSettings.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to update notification settings:', error)
      throw error
    }
  }

  const fetchRoles = async () => {
    try {
      const response = await systemAPI.getRoles()
      roles.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to fetch roles:', error)
      throw error
    }
  }

  const fetchPermissions = async () => {
    try {
      const response = await systemAPI.getPermissions()
      permissions.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to fetch permissions:', error)
      throw error
    }
  }

  const createRole = async (data) => {
    try {
      const response = await systemAPI.createRole(data)
      await fetchRoles()
      return response.data
    } catch (error) {
      console.error('Failed to create role:', error)
      throw error
    }
  }

  const updateRole = async (id, data) => {
    try {
      const response = await systemAPI.updateRole(id, data)
      await fetchRoles()
      return response.data
    } catch (error) {
      console.error('Failed to update role:', error)
      throw error
    }
  }

  const deleteRole = async (id) => {
    try {
      await systemAPI.deleteRole(id)
      await fetchRoles()
    } catch (error) {
      console.error('Failed to delete role:', error)
      throw error
    }
  }

  const fetchLogs = async (params = {}) => {
    loading.value = true
    try {
      const queryParams = { ...logFilters.value, ...params }
      const response = await systemAPI.getLogs(queryParams)
      
      logs.value = response.data.items
      totalLogs.value = response.data.total
      logFilters.value = { ...queryParams }
      
      return response.data
    } catch (error) {
      console.error('Failed to fetch logs:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const fetchLogDetail = async (id) => {
    try {
      const response = await systemAPI.getLogDetail(id)
      return response.data
    } catch (error) {
      console.error('Failed to fetch log detail:', error)
      throw error
    }
  }

  const exportLogs = async (params = {}) => {
    try {
      const response = await systemAPI.exportLogs(params)
      return response.data
    } catch (error) {
      console.error('Failed to export logs:', error)
      throw error
    }
  }

  return {
    settings,
    smsSettings,
    notificationSettings,
    roles,
    permissions,
    logs,
    totalLogs,
    logFilters,
    loading,
    fetchSettings,
    updateSettings,
    fetchSmsSettings,
    updateSmsSettings,
    testSms,
    checkSms,
    fetchNotificationSettings,
    updateNotificationSettings,
    fetchRoles,
    fetchPermissions,
    createRole,
    updateRole,
    deleteRole,
    fetchLogs,
    fetchLogDetail,
    exportLogs,
  }
})
