import { defineStore } from 'pinia'
import { ref } from 'vue'
import { financeAPI } from '@/api'

export const useFinanceStore = defineStore('finance', () => {
    const orders = ref([])
    const loading = ref(false)
    const totalItems = ref(0)
    const stats = ref(null)

    const fetchOrders = async (params = {}) => {
        loading.value = true
        try {
            const response = await financeAPI.getOrders(params)
            orders.value = response.data.items
            totalItems.value = response.data.total
            return response.data
        } catch (error) {
            console.error('Failed to fetch orders:', error)
            throw error
        } finally {
            loading.value = false
        }
    }

    const fetchStats = async () => {
        try {
            // If backend doesn't have stats endpoint yet, we might fail here.
            // But let's assume we might add it or just handle error.
            const response = await financeAPI.getStats()
            stats.value = response.data
            return response.data
        } catch (error) {
            console.warn('Failed to fetch finance stats:', error)
        }
    }

    return {
        orders,
        loading,
        totalItems,
        stats,
        fetchOrders,
        fetchStats
    }
})
