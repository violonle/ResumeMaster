import { defineStore } from 'pinia'
import { ref } from 'vue'
import { aiModelAPI } from '@/api'

export const useAIModelStore = defineStore('aiModel', () => {
  const providers = ref([])
  const currentProvider = ref(null)
  const modelKeys = ref([])
  const loading = ref(false)
  const totalItems = ref(0)
  const filters = ref({ page:1, itemsPerPage:10, provider:'', enabled:'', sortBy:'created_at', sortOrder:'DESC' })

  const fetchProviders = async (params = {}) => {
    loading.value = true
    try {
      const queryParams = { ...filters.value, ...params }
      const response = await aiModelAPI.getList(queryParams)
      providers.value = response.data.items
      totalItems.value = response.data.total
      filters.value = { ...queryParams }
      
      return response.data
    } catch (error) {
      console.error('Failed to fetch providers:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const fetchProviderDetail = async (id) => {
    loading.value = true
    try {
      const response = await aiModelAPI.getDetail(id)
      currentProvider.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to fetch provider detail:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const createProvider = async (data) => {
    try {
      const response = await aiModelAPI.create(data)
      await fetchProviders()
      return response.data
    } catch (error) {
      console.error('Failed to create provider:', error)
      throw error
    }
  }

  const updateProvider = async (id, data) => {
    try {
      const response = await aiModelAPI.update(id, data)
      await fetchProviders()
      return response.data
    } catch (error) {
      console.error('Failed to update provider:', error)
      throw error
    }
  }

  const deleteProvider = async (id) => {
    try {
      await aiModelAPI.delete(id)
      await fetchProviders()
    } catch (error) {
      console.error('Failed to delete provider:', error)
      throw error
    }
  }

  const testModelKey = async (id, testData = {}) => {
    try {
      const response = await aiModelAPI.test(id, testData)
      return response.data
    } catch (error) {
      console.error('Failed to test model key:', error)
      throw error
    }
  }

  const batchTestModelKeys = async (keyIds, testData = {}) => {
    try {
      const response = await aiModelAPI.batchTest({ modelIds: keyIds, testType: testData.testType || 'basic', prompt: testData.prompt })
      return response.data
    } catch (error) {
      console.error('Failed to batch test model keys:', error)
      throw error
    }
  }

  const fetchPlatforms = async () => {
    try {
      const response = await aiModelAPI.getPlatforms()
      return response.data
    } catch (error) {
      console.error('Failed to fetch platforms:', error)
      throw error
    }
  }

  const fetchModelKeys = async (params = {}) => {
    try {
      const response = await aiModelAPI.getKeys(params)
      modelKeys.value = response.data.items || []
      return response.data
    } catch (error) {
      console.error('Failed to fetch model keys:', error)
      throw error
    }
  }

  const createKey = async (data) => {
    try {
      const response = await aiModelAPI.createKey(data)
      await fetchModelKeys({ company_id: data.company_id, provider: data.provider })
      return response.data
    } catch (error) {
      console.error('Failed to create model key:', error)
      throw error
    }
  }

  const updateKey = async (id, data) => {
    try {
      const response = await aiModelAPI.updateKey(id, data)
      await fetchModelKeys({ company_id: data.company_id, provider: data.provider })
      return response.data
    } catch (error) {
      console.error('Failed to update model key:', error)
      throw error
    }
  }

  const deleteKey = async (id) => {
    try {
      const response = await aiModelAPI.deleteKey(id)
      const last = currentProvider.value
      await fetchModelKeys({ provider: last?.provider })
      return response?.data
    } catch (error) {
      console.error('Failed to delete model key:', error)
      throw error
    }
  }

  return {
    providers,
    currentProvider,
    modelKeys,
    loading,
    totalItems,
    filters,
    fetchProviders,
    fetchProviderDetail,
    createProvider,
    updateProvider,
    deleteProvider,
    testModelKey,
    batchTestModelKeys,
    fetchPlatforms,
    fetchModelKeys,
    createKey,
    updateKey,
    deleteKey,
  }
})
