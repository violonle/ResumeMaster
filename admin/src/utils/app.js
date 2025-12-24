import { useUserStore } from '@/stores/user'
import { useDashboardStore } from '@/stores/dashboard'

export const initializeApp = async () => {
  const userStore = useUserStore()
  const dashboardStore = useDashboardStore()
  
  if (userStore.isLoggedIn) {
    try {
      await userStore.initializeAuth()
      await Promise.all([
        dashboardStore.fetchStats(),
        dashboardStore.fetchRecentActivities()
      ])
    } catch (error) {
      console.error('Failed to initialize app data:', error)
    }
  }
}