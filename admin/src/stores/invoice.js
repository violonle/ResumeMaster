import { defineStore } from 'pinia'
import { ref } from 'vue'
import { invoiceAPI } from '@/api'

export const useInvoiceStore = defineStore('invoice', () => {
    const invoices = ref([])
    const currentInvoice = ref(null)
    const loading = ref(false)
    const totalItems = ref(0)
    const stats = ref(null)

    const fetchInvoices = async (params = {}) => {
        loading.value = true
        try {
            const response = await invoiceAPI.getList(params)
            invoices.value = response.data.items
            totalItems.value = response.data.total
            return response.data
        } catch (error) {
            console.error('Failed to fetch invoices:', error)
            throw error
        } finally {
            loading.value = false
        }
    }

    const fetchInvoiceDetail = async (id) => {
        loading.value = true
        try {
            const response = await invoiceAPI.getDetail(id)
            currentInvoice.value = response.data
            return response.data
        } catch (error) {
            console.error('Failed to fetch invoice detail:', error)
            throw error
        } finally {
            loading.value = false
        }
    }

    const createInvoice = async (data) => {
        try {
            const response = await invoiceAPI.create(data)
            await fetchInvoices()
            return response.data
        } catch (error) {
            console.error('Failed to create invoice:', error)
            throw error
        }
    }

    const updateInvoice = async (id, data) => {
        try {
            const response = await invoiceAPI.update(id, data)
            await fetchInvoices()
            return response.data
        } catch (error) {
            console.error('Failed to update invoice:', error)
            throw error
        }
    }

    const applyRedInvoice = async (id, reason) => {
        try {
            const response = await invoiceAPI.red(id, { reason })
            await fetchInvoices()
            return response.data
        } catch (error) {
            console.error('Failed to apply red invoice:', error)
            throw error
        }
    }

    const fetchStats = async () => {
        try {
            const response = await invoiceAPI.getStats()
            stats.value = response.data
            return response.data
        } catch (error) {
            console.warn('Failed to fetch invoice stats:', error)
        }
    }

    return {
        invoices,
        currentInvoice,
        loading,
        totalItems,
        stats,
        fetchInvoices,
        fetchInvoiceDetail,
        createInvoice,
        updateInvoice,
        applyRedInvoice,
        fetchStats
    }
})
