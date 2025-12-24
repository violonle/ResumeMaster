import { defineStore } from 'pinia'
import { ref } from 'vue'
import { subscriptionAPI } from '@/api'

export const useSubscriptionStore = defineStore('subscription', () => {
  const subscriptions = ref([])
  const currentSubscription = ref(null)
  const subscriptionPlans = ref([])
  const loading = ref(false)
  const totalItems = ref(0)
  const filters = ref({
    page: 1,
    itemsPerPage: 10,
    companyId: '',
    status: '',
    plan: '',
    sortBy: 'created_at',
    sortOrder: 'DESC',
  })

  const fetchSubscriptions = async (params = {}) => {
    loading.value = true
    try {
      const queryParams = { ...filters.value, ...params }
      const response = await subscriptionAPI.getList(queryParams)

      subscriptions.value = response.data.items
      totalItems.value = response.data.total
      filters.value = { ...queryParams }

      return response.data
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const fetchSubscriptionDetail = async (companyId) => {
    loading.value = true
    try {
      const response = await subscriptionAPI.getDetail(companyId)
      currentSubscription.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to fetch subscription detail:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const createSubscription = async (data) => {
    try {
      const response = await subscriptionAPI.create(data)
      await fetchSubscriptions()
      return response.data
    } catch (error) {
      console.error('Failed to create subscription:', error)
      throw error
    }
  }

  const updateSubscription = async (id, data) => {
    try {
      const response = await subscriptionAPI.update(id, data)
      await fetchSubscriptions()
      return response.data
    } catch (error) {
      console.error('Failed to update subscription:', error)
      throw error
    }
  }

  const renewSubscription = async (companyId) => {
    try {
      const response = await subscriptionAPI.renew(companyId)
      await fetchSubscriptions()
      return response.data
    } catch (error) {
      console.error('Failed to renew subscription:', error)
      throw error
    }
  }

  const cancelSubscription = async (companyId) => {
    try {
      const response = await subscriptionAPI.cancel(companyId)
      await fetchSubscriptions()
      return response.data
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
      throw error
    }
  }

  const deleteSubscription = async (id) => {
    try {
      const response = await subscriptionAPI.delete(id)
      await fetchSubscriptions()
      return response.data
    } catch (error) {
      console.error('Failed to delete subscription:', error)
      throw error
    }
  }

  const fetchSubscriptionPlans = async () => {
    try {
      const response = await subscriptionAPI.getPlans()
      subscriptionPlans.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to fetch subscription plans:', error)
      throw error
    }
  }

  const createPlan = async (data) => {
    const res = await subscriptionAPI.createPlan(data)
    await fetchSubscriptionPlans()
    return res.data
  }

  const updatePlan = async (id, data) => {
    const res = await subscriptionAPI.updatePlan(id, data)
    await fetchSubscriptionPlans()
    return res.data
  }

  const updatePlanByKey = async (key, data) => {
    const res = await subscriptionAPI.updatePlan(key, data)
    await fetchSubscriptionPlans()
    return res.data
  }

  const deletePlan = async (id) => {
    const res = await subscriptionAPI.deletePlan(id)
    await fetchSubscriptionPlans()
    return res.data
  }

  const deletePlanByKey = async (key) => {
    const res = await subscriptionAPI.deletePlan(key)
    await fetchSubscriptionPlans()
    return res.data
  }

  const getSubscriptionStats = async () => {
    try {
      const response = await subscriptionAPI.getStats()
      return response.data
    } catch (error) {
      console.error('Failed to get subscription stats:', error)
      throw error
    }
  }

  return {
    subscriptions,
    currentSubscription,
    subscriptionPlans,
    loading,
    totalItems,
    filters,
    fetchSubscriptions,
    fetchSubscriptionDetail,
    createSubscription,
    updateSubscription,
    renewSubscription,
    cancelSubscription,
    deleteSubscription,
    fetchSubscriptionPlans,
    createPlan,
    updatePlan,
    updatePlanByKey,
    deletePlan,
    deletePlanByKey,
    getSubscriptionStats,
  }
})
