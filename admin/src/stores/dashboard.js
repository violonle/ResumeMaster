import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dashboardAPI } from '@/api'

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref({
    totalUsers: 0,
    totalCompanies: 0,
    activeSubscriptions: 0,
    aiCalls: 0,
  })
  
  const chartData = ref({
    userGrowth: [],
    subscriptionDistribution: [],
    revenueTrend: [],
    aiUsage: [],
  })
  
  const recentActivities = ref([])
  const loading = ref(false)

  const fetchStats = async () => {
    loading.value = true
    try {
      const response = await dashboardAPI.getStats()
      const defaults = { totalUsers: 0, totalCompanies: 0, activeSubscriptions: 0, aiCalls: 0 }
      stats.value = { ...defaults, ...(response.data || {}) }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      loading.value = false
    }
  }

  const fetchChartData = async (type) => {
    try {
      const response = await dashboardAPI.getChartData(type)
      chartData.value[type] = Array.isArray(response.data) ? response.data : []
    } catch (error) {
      console.error(`Failed to fetch chart data for ${type}:`, error)
      chartData.value[type] = []
    }
  }

  const fetchRecentActivities = async () => {
    try {
      const response = await dashboardAPI.getRecentActivities()
      recentActivities.value = response.data
    } catch (error) {
      console.error('Failed to fetch recent activities:', error)
    }
  }

  return {
    stats,
    chartData,
    recentActivities,
    loading,
    fetchStats,
    fetchChartData,
    fetchRecentActivities,
  }
})
