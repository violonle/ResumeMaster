<template>
  <StandardPage
    title="发票管理"
    subtitle="管理用户发票申请及开具记录"
  >
    <!-- 搜索与筛选 -->
    <VCard class="mb-6" elevation="0" border>
      <VCardText class="pa-4">
        <VRow dense align="center">
          <VCol cols="12" md="4">
            <VTextField
              v-model="search"
              label="搜索发票号/抬头"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              @update:model-value="handleSearch"
            />
          </VCol>
          <VCol cols="12" md="3">
            <VSelect
              v-model="statusFilter"
              :items="statusItems"
              label="状态"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              @update:model-value="handleSearch"
            />
          </VCol>
          <VSpacer />
          <VCol cols="auto">
            <VBtn color="primary" variant="tonal" prepend-icon="mdi-refresh" @click="handleRefresh" :loading="loading">
              刷新
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- 数据表格 -->
    <VCard elevation="0" border>
      <VCardText class="pa-0">
        <VDataTable
          :headers="headers"
          :items="invoices"
          :loading="loading"
          class="clean-table"
          hover
        >
          <template #item.amount="{ item }">
            <span class="font-weight-bold">¥{{ item.amount }}</span>
          </template>

          <template #item.status="{ item }">
            <VChip :color="getStatusColor(item.status)" size="small">
              {{ getStatusText(item.status) }}
            </VChip>
          </template>

          <template #item.issuedAt="{ item }">
            {{ formatDate(item.issuedAt) }}
          </template>
          
          <template #item.actions="{ item }">
            <VBtn icon="mdi-eye" size="small" variant="text" color="primary" @click="viewDetail(item)" />
          </template>
        </VDataTable>
      </VCardText>
    </VCard>
    
    <!-- 详情对话框 (简化版) -->
    <VDialog v-model="detailDialog" max-width="600">
      <VCard v-if="selectedItem">
        <VCardTitle>发票详情</VCardTitle>
        <VCardText>
          <VList density="compact">
            <VListItem title="发票号" :subtitle="selectedItem.invoiceNo" />
            <VListItem title="抬头" :subtitle="selectedItem.buyerName" />
            <VListItem title="税号" :subtitle="selectedItem.buyerTaxNumber || '-'" />
            <VListItem title="金额" :subtitle="`¥${selectedItem.amount}`" />
            <VListItem title="状态" :subtitle="getStatusText(selectedItem.status)" />
            <VListItem title="开票时间" :subtitle="formatDate(selectedItem.issuedAt)" />
          </VList>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn color="primary" variant="text" @click="detailDialog = false">关闭</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useInvoiceStore } from '@/stores/invoice'
import StandardPage from '@/components/StandardPage.vue'

const invoiceStore = useInvoiceStore()

const search = ref('')
const statusFilter = ref(null)
const detailDialog = ref(false)
const selectedItem = ref(null)

const loading = computed(() => invoiceStore.loading)
const invoices = computed(() => invoiceStore.invoices)

const headers = [
  { title: '发票号', key: 'invoiceNo', sortable: true, align: 'start' },
  { title: '抬头', key: 'buyerName', sortable: true, align: 'start' },
  { title: '金额', key: 'amount', sortable: true, align: 'end' },
  { title: '状态', key: 'status', sortable: true, align: 'center' },
  { title: '开票时间', key: 'issuedAt', sortable: true, align: 'end' },
  { title: '操作', key: 'actions', sortable: false, align: 'end' },
]

const statusItems = [
  { title: '已开票', value: 'issued' },
  { title: '已红冲', value: 'red_issued' },
]

const getStatusColor = (status) => {
  const map = {
    issued: 'success',
    red_issued: 'error',
    red_reversed: 'warning'
  }
  return map[status] || 'grey'
}

const getStatusText = (status) => {
  const map = {
    issued: '已开票',
    red_issued: '已红冲',
    red_reversed: '红冲已撤销'
  }
  return map[status] || status
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString('zh-CN')
}

const handleSearch = () => {
  invoiceStore.fetchInvoices({
    search: search.value,
    status: statusFilter.value
  })
}

const handleRefresh = () => {
  handleSearch()
}

const viewDetail = (item) => {
  selectedItem.value = item
  detailDialog.value = true
}

onMounted(() => {
  handleSearch()
})
</script>
