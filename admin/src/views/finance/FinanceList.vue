<template>
  <StandardPage
    title="财务概览"
    subtitle="查看所有支付订单及财务统计"
  >
    <!-- 搜索与筛选 -->
    <VCard class="mb-6" elevation="0" border>
      <VCardText class="pa-4">
        <VRow dense align="center">
          <VCol cols="12" md="4">
            <VTextField
              v-model="search"
              label="搜索订单号"
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
          :items="orders"
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

          <template #item.paymentMethod="{ item }">
             <VIcon :icon="getPaymentIcon(item.paymentMethod)" :color="getPaymentColor(item.paymentMethod)" class="mr-1" />
             {{ getPaymentText(item.paymentMethod) }}
          </template>

          <template #item.createdAt="{ item }">
            {{ formatDate(item.createdAt) }}
          </template>
          
          <template #item.user="{ item }">
            {{ item.User?.username || item.userId }}
          </template>
        </VDataTable>
      </VCardText>
    </VCard>
  </StandardPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import StandardPage from '@/components/StandardPage.vue'

const financeStore = useFinanceStore()

const search = ref('')
const statusFilter = ref(null)

const loading = computed(() => financeStore.loading)
const orders = computed(() => financeStore.orders)

const headers = [
  { title: '订单号', key: 'orderNo', sortable: true, align: 'start' },
  { title: '用户', key: 'user', sortable: false, align: 'start' },
  { title: '套餐', key: 'planType', sortable: true, align: 'start' },
  { title: '金额', key: 'amount', sortable: true, align: 'end' },
  { title: '支付方式', key: 'paymentMethod', sortable: true, align: 'center' },
  { title: '状态', key: 'status', sortable: true, align: 'center' },
  { title: '创建时间', key: 'createdAt', sortable: true, align: 'end' },
]

const statusItems = [
  { title: '已支付', value: 'paid' },
  { title: '待支付', value: 'pending' },
  { title: '已退款', value: 'refunded' },
  { title: '失败', value: 'failed' },
]

const getStatusColor = (status) => {
  const map = {
    paid: 'success',
    pending: 'warning',
    refunded: 'grey',
    failed: 'error'
  }
  return map[status] || 'grey'
}

const getStatusText = (status) => {
  const map = {
    paid: '已支付',
    pending: '待支付',
    refunded: '已退款',
    failed: '失败'
  }
  return map[status] || status
}

const getPaymentIcon = (method) => {
  if (method === 'wechat') return 'mdi-wechat'
  if (method === 'alipay') return 'mdi-alipay'
  return 'mdi-credit-card'
}

const getPaymentColor = (method) => {
  if (method === 'wechat') return 'success'
  if (method === 'alipay') return 'info'
  return 'grey'
}

const getPaymentText = (method) => {
  if (method === 'wechat') return '微信支付'
  if (method === 'alipay') return '支付宝'
  return method
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString('zh-CN')
}

const handleSearch = () => {
  financeStore.fetchOrders({
    search: search.value,
    status: statusFilter.value
  })
}

const handleRefresh = () => {
  handleSearch()
}

onMounted(() => {
  handleSearch()
})
</script>
