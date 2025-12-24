import { defineStore } from 'pinia'
import { ref } from 'vue'
import { customerAPI, companyAPI } from '@/api'

export const useCustomerStore = defineStore('customer', () => {
  const customers = ref([])
  const currentCustomer = ref(null)
  const loading = ref(false)
  const totalItems = ref(0)
  const filters = ref({
    page: 1,
    itemsPerPage: 10,
    search: '',
    role: '',
    verified: '',
    companyId: '',
    sortBy: 'created_at',
    sortOrder: 'DESC',
  })

  const fetchCustomers = async (params = {}) => {
    loading.value = true
    try {
      const queryParams = { ...filters.value, ...params }
      const response = await customerAPI.getList(queryParams)
      
      customers.value = response.data.items
      totalItems.value = response.data.total
      filters.value = { ...queryParams }
      
      return response.data
    } catch (error) {
      console.warn('Failed to fetch customers')
      customers.value = []
      totalItems.value = 0
      return { items: [], total: 0 }
    } finally {
      loading.value = false
    }
  }

  const fetchCustomerDetail = async (id) => {
    loading.value = true
    try {
      const response = await customerAPI.getDetail(id)
      currentCustomer.value = response.data
      return response.data
    } catch (error) {
      console.warn('Failed to fetch customer detail')
      return null
    } finally {
      loading.value = false
    }
  }

  const createCustomer = async (data) => {
    try {
      const payload = {
        name: data.username || data.name,
        phone: data.phone,
        email: data.email,
        company_id: data.company_id || data.companyId || null,
        role: data.role || 'HR_STAFF',
        is_verified: !!data.is_verified,
      }
      const response = await customerAPI.create(payload)
      await fetchCustomers()
      return response.data
    } catch (error) {
      console.warn('Failed to create customer')
      throw error
    }
  }

  const updateCustomer = async (id, data) => {
    try {
      const payload = {
        name: data.username || data.name,
        phone: data.phone,
        email: data.email,
        company_id: data.company_id || data.companyId,
        role: data.role,
        is_verified: data.is_verified,
        is_active: data.is_active,
      }
      const response = await customerAPI.update(id, payload)
      await fetchCustomers()
      return response.data
    } catch (error) {
      console.warn('Failed to update customer')
      throw error
    }
  }

  const deleteCustomer = async (id) => {
    try {
      await customerAPI.delete(id)
      await fetchCustomers()
    } catch (error) {
      console.warn('Failed to delete customer')
      throw error
    }
  }

  const getCustomerStats = async () => {
    try {
      const response = await customerAPI.getStats()
      return response.data
    } catch (error) {
      console.warn('Failed to get customer stats')
      return { total: 0, active: 0, paid: 0, newThisMonth: 0 }
    }
  }

  const fetchCompanies = async () => {
    try {
      const res = await companyAPI.getList({ itemsPerPage: 100, page: 1 })
      return res.data.items || []
    } catch (e) { console.error('Failed to fetch companies', e); return [] }
  }

  return {
    customers,
    currentCustomer,
    loading,
    totalItems,
    filters,
    fetchCustomers,
    fetchCustomerDetail,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerStats,
    fetchCompanies,
  }
})
