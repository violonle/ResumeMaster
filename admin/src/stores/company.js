import { defineStore } from 'pinia'
import { ref } from 'vue'
import { companyAPI } from '@/api'

export const useCompanyStore = defineStore('company', () => {
  const companies = ref([])
  const currentCompany = ref(null)
  const loading = ref(false)
  const totalItems = ref(0)
  const filters = ref({
    page: 1,
    itemsPerPage: 10,
    search: '',
    status: '',
    verified: '',
    sortBy: 'created_at',
    sortOrder: 'DESC',
  })

  const fetchCompanies = async (params = {}) => {
    loading.value = true
    try {
      const queryParams = { ...filters.value, ...params }
      const response = await companyAPI.getList(queryParams)
      
      companies.value = response.data.items
      totalItems.value = response.data.total
      filters.value = { ...queryParams }
      
      return response.data
    } catch (error) {
      console.error('Failed to fetch companies:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const fetchCompanyDetail = async (id) => {
    loading.value = true
    try {
      const response = await companyAPI.getDetail(id)
      currentCompany.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to fetch company detail:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const createCompany = async (data) => {
    try {
      const payload = {
        name: data.name,
        address: data.address,
        province: data.province || '',
        city: data.city || '',
        district: data.district || '',
        contact_account_id: data.contact_account_id || null,
        contact_person: data.contact_person || '',
        contact_email: data.contact_email || '',
        contact_phone: data.contact_phone || '',
        status: data.status || 'active',
        is_verified: !!data.is_verified,
        verification_info: data.verification_info || null,
      }
      const response = await companyAPI.create(payload)
      await fetchCompanies()
      return response.data
    } catch (error) {
      console.error('Failed to create company:', error)
      throw error
    }
  }

  const updateCompany = async (id, data) => {
    try {
      const payload = {
        name: data.name,
        address: data.address,
        province: data.province,
        city: data.city,
        district: data.district,
        contact_account_id: data.contact_account_id || null,
        contact_person: data.contact_person,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone,
        status: data.status,
        is_verified: !!data.is_verified,
        verification_info: data.verification_info || null,
      }
      const response = await companyAPI.update(id, payload)
      await fetchCompanies()
      return response.data
    } catch (error) {
      console.error('Failed to update company:', error)
      throw error
    }
  }

  const uploadCompanyFiles = async (id, files = {}) => {
    try {
      const form = new FormData()
      if (files.license) form.append('license', files.license)
      if (files.orgCodeCert) form.append('orgCodeCert', files.orgCodeCert)
      const response = await companyAPI.upload(id, form)
      await fetchCompanies()
      return response.data
    } catch (error) {
      console.error('Failed to upload company files:', error)
      throw error
    }
  }

  const deleteCompany = async (id) => {
    try {
      await companyAPI.delete(id)
      await fetchCompanies()
    } catch (error) {
      console.error('Failed to delete company:', error)
      throw error
    }
  }

  const verifyCompany = async (id, data = {}) => {
    try {
      const response = await companyAPI.verify(id, data)
      await fetchCompanies()
      return response.data
    } catch (error) {
      console.error('Failed to verify company:', error)
      throw error
    }
  }

  const getCompanyStats = async () => {
    try {
      const response = await companyAPI.getStats()
      return response.data
    } catch (error) {
      console.error('Failed to get company stats:', error)
      throw error
    }
  }

  return {
    companies,
    currentCompany,
    loading,
    totalItems,
    filters,
    fetchCompanies,
    fetchCompanyDetail,
    createCompany,
    updateCompany,
    deleteCompany,
    verifyCompany,
    getCompanyStats,
    uploadCompanyFiles,
  }
})
