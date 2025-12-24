<template>
  <StandardPage
    title="订阅管理"
    subtitle="管理企业订阅：计划、周期、用量与续费"
  >
    <template #actions>
      <VBtn
        color="primary"
        prepend-icon="mdi-plus"
        @click="showCreateDialog = true"
      >
        变更订阅
      </VBtn>
    </template>

    <!-- 统计卡片 -->
    <VRow class="mb-6">
      <VCol cols="12" md="3" sm="6">
        <VCard>
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded
              color="primary"
              variant="tonal"
              class="me-4"
              size="48"
            >
              <VIcon icon="mdi-credit-card" size="24" />
            </VAvatar>
            <div>
              <div class="text-h4 font-weight-bold">{{ subscriptionStore.totalItems }}</div>
              <div class="text-caption text-medium-emphasis">总订阅数</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" md="3" sm="6">
        <VCard>
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded
              color="success"
              variant="tonal"
              class="me-4"
              size="48"
            >
              <VIcon icon="mdi-check-circle" size="24" />
            </VAvatar>
            <div>
              <div class="text-h4 font-weight-bold">{{ activeSubscriptions }}</div>
              <div class="text-caption text-medium-emphasis">活跃订阅</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" md="3" sm="6">
        <VCard>
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded
              color="warning"
              variant="tonal"
              class="me-4"
              size="48"
            >
              <VIcon icon="mdi-clock-alert" size="24" />
            </VAvatar>
            <div>
              <div class="text-h4 font-weight-bold">{{ expiringSubscriptions }}</div>
              <div class="text-caption text-medium-emphasis">即将到期</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" md="3" sm="6">
        <VCard>
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded
              color="error"
              variant="tonal"
              class="me-4"
              size="48"
            >
              <VIcon icon="mdi-cancel" size="24" />
            </VAvatar>
            <div>
              <div class="text-h4 font-weight-bold">{{ expiredSubscriptions }}</div>
              <div class="text-caption text-medium-emphasis">已过期</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 搜索和筛选 -->
    <VCard class="mb-6" elevation="0" border>
      <VCardText class="pa-4">
        <VRow dense align="center">
          <VCol cols="12" md="3">
            <VTextField
              v-model="searchQuery"
              placeholder="输入公司ID筛选"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              @input="handleSearch"
            />
          </VCol>
          <VCol cols="12" md="3">
            <VSelect 
              v-model="planFilter" 
              :items="planOptions" 
              label="订阅计划" 
              variant="outlined"
              density="compact"
              hide-details
              clearable 
              @update:model-value="handleFilter" 
            />
          </VCol>
          <VCol cols="12" md="3">
            <VSelect 
              v-model="statusFilter" 
              :items="statusOptions" 
              label="订阅状态" 
              variant="outlined"
              density="compact"
              hide-details
              clearable 
              @update:model-value="handleFilter" 
            />
          </VCol>
          <VSpacer />
          <VCol cols="12" md="auto">
            <VBtn
              color="primary"
              variant="tonal"
              prepend-icon="mdi-refresh"
              @click="handleRefresh"
              :loading="subscriptionStore.loading"
            >
              刷新
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- 订阅列表 -->
    <VCard elevation="0" border>
      <VCardText class="pa-0">
        <VDataTable
          :headers="headers"
          :items="subscriptionStore.subscriptions"
          :loading="subscriptionStore.loading"
          :items-per-page="subscriptionStore.filters.itemsPerPage"
          :items-length="subscriptionStore.totalItems"
          v-model:page="currentPage"
          @update:page="handlePageChange"
          @update:items-per-page="handleItemsPerPageChange"
          hover
          class="clean-table"
        >
          <!-- 订阅类型列 -->
          <template #item.plan="{ item }">
            <VChip 
              :color="getPlanColor((item.raw || item).plan)" 
              size="small"
              variant="tonal"
              label
            >
              <VIcon :icon="getPlanIcon((item.raw || item).plan)" start size="small" />
              {{ getPlanText((item.raw || item).plan) }}
            </VChip>
          </template>

          <!-- 状态列 -->
          <template #item.status="{ item }">
            <VChip 
              :color="getStatusColor((item.raw || item).status)" 
              size="small"
              variant="tonal"
              label
            >
              {{ getStatusText((item.raw || item).status) }}
            </VChip>
          </template>

          <!-- 到期日期列 -->
          <template #item.end_at="{ item }">
            <div>
              <div>{{ formatDate((item.raw || item).end_at) }}</div>
              <VChip
                v-if="isExpiringSoon((item.raw || item).end_at)"
                color="warning"
                size="x-small"
                variant="outlined"
                class="mt-1"
              >
                {{ getDaysUntilExpiry((item.raw || item).end_at) }}
              </VChip>
            </div>
          </template>

          <!-- 操作列 -->
          <template #item.actions="{ item }">
            <div class="d-flex justify-end">
              <VBtn
                icon
                size="small"
                variant="text"
                color="default"
                class="me-1"
                @click="viewSubscription(item.raw || item)"
              >
                <VIcon icon="mdi-eye-outline" size="20" />
                <VTooltip activator="parent" location="top">查看详情</VTooltip>
              </VBtn>
              
              <VBtn
                v-if="(item.raw || item).status === 'active' && isExpiringSoon((item.raw || item).end_at)"
                icon
                size="small"
                color="success"
                variant="text"
                class="me-1"
                @click="renewSubscription(item.raw || item)"
              >
                <VIcon icon="mdi-refresh" size="20" />
                <VTooltip activator="parent" location="top">续费</VTooltip>
              </VBtn>
              
              <VBtn
                v-if="(item.raw || item).status === 'active'"
                icon
                size="small"
                color="warning"
                variant="text"
                class="me-1"
                @click="cancelSubscription(item.raw || item)"
              >
                <VIcon icon="mdi-cancel" size="20" />
                <VTooltip activator="parent" location="top">取消订阅</VTooltip>
              </VBtn>
              
              <VBtn
                icon
                size="small"
                color="primary"
                variant="text"
                class="me-1"
                @click="editSubscription(item.raw || item)"
              >
                <VIcon icon="mdi-pencil-outline" size="20" />
                <VTooltip activator="parent" location="top">编辑</VTooltip>
              </VBtn>
              
              <VBtn
                icon
                size="small"
                color="error"
                variant="text"
                @click="confirmDelete(item.raw || item)"
              >
                <VIcon icon="mdi-delete-outline" size="20" />
                <VTooltip activator="parent" location="top">删除</VTooltip>
              </VBtn>
            </div>
          </template>

          <!-- 空状态 -->
          <template #no-data>
            <div class="text-center pa-8">
              <VAvatar color="surface-variant" size="64" class="mb-4">
                <VIcon icon="mdi-credit-card-off" size="32" />
              </VAvatar>
              <div class="text-h6 text-medium-emphasis">暂无订阅数据</div>
              <div class="text-body-2 text-medium-emphasis mt-1">
                请点击右上角“变更订阅”以创建新的订阅记录
              </div>
            </div>
          </template>
        </VDataTable>
      </VCardText>
    </VCard>

    <!-- 创建/编辑对话框 -->
    <VDialog v-model="showCreateDialog" max-width="600px">
      <VCard>
        <VCardTitle class="d-flex align-center pa-4">
          <span class="text-h6">{{ editingSubscription ? '编辑订阅' : '变更订阅' }}</span>
          <VSpacer />
          <VBtn icon="mdi-close" variant="text" @click="closeDialog" />
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VForm ref="subscriptionForm" @submit.prevent="handleSubmit">
            <VRow>
              <VCol cols="12" md="6">
                <VTextField 
                  v-model="subscriptionFormData.companyId" 
                  label="公司ID" 
                  :rules="[v => !!v || '请输入公司ID']" 
                  variant="outlined"
                  required 
                />
              </VCol>
              <VCol cols="12" md="6">
                <VSelect 
                  v-model="subscriptionFormData.plan" 
                  :items="planOptions" 
                  label="订阅计划" 
                  :rules="[v => !!v || '请选择订阅计划']" 
                  variant="outlined"
                  required 
                />
              </VCol>
              <VCol cols="12" md="6">
                <VSelect 
                  v-model="subscriptionFormData.billing_cycle" 
                  :items="cycleOptions" 
                  label="计费周期" 
                  variant="outlined"
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="subscriptionFormData.notes"
                  label="备注"
                  rows="3"
                  variant="outlined"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn color="grey-darken-1" variant="text" @click="closeDialog">取消</VBtn>
          <VBtn color="primary" @click="handleSubmit" :loading="saving">保存</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 续订对话框 -->
    <VDialog v-model="showRenewDialog" max-width="400px">
      <VCard>
        <VCardTitle class="pa-4">续订订阅</VCardTitle>
        <VCardText class="pa-4">
          确定要为公司ID "{{ renewingSubscription?.company_id }}" 续订 {{ getPlanText(renewingSubscription?.plan) }} 吗？
        </VCardText>
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn color="grey-darken-1" variant="text" @click="showRenewDialog = false">取消</VBtn>
          <VBtn color="success" @click="handleRenew" :loading="renewing">续订</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 取消订阅对话框 -->
    <VDialog v-model="showCancelDialog" max-width="400px">
      <VCard>
        <VCardTitle class="pa-4">取消订阅</VCardTitle>
        <VCardText class="pa-4">
          确定要取消公司ID "{{ cancelingSubscription?.company_id }}" 的 {{ getPlanText(cancelingSubscription?.plan) }} 订阅吗？
        </VCardText>
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn color="grey-darken-1" variant="text" @click="showCancelDialog = false">取消</VBtn>
          <VBtn color="warning" @click="handleCancel" :loading="canceling">确认取消</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 删除确认对话框 -->
    <VDialog v-model="showDeleteDialog" max-width="400px">
      <VCard>
        <VCardTitle class="pa-4">确认删除</VCardTitle>
        <VCardText class="pa-4">
          确定要删除订阅 "公司ID {{ deletingSubscription?.company_id }} - {{ getPlanText(deletingSubscription?.plan) }}" 吗？此操作不可恢复。
        </VCardText>
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn color="grey-darken-1" variant="text" @click="showDeleteDialog = false">取消</VBtn>
          <VBtn color="error" @click="handleDelete" :loading="deleting">删除</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSubscriptionStore } from '@/stores/subscription'
import { format, differenceInDays } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import StandardPage from '@/components/StandardPage.vue'

const router = useRouter()
const subscriptionStore = useSubscriptionStore()

// 搜索和筛选
const searchQuery = ref('')
const planFilter = ref(null)
const statusFilter = ref(null)

// 对话框状态
const showCreateDialog = ref(false)
const showRenewDialog = ref(false)
const showCancelDialog = ref(false)
const showDeleteDialog = ref(false)
const saving = ref(false)
const renewing = ref(false)
const canceling = ref(false)
const deleting = ref(false)

// 表单数据
const subscriptionForm = ref()
const editingSubscription = ref(null)
const renewingSubscription = ref(null)
const cancelingSubscription = ref(null)
const deletingSubscription = ref(null)

const subscriptionFormData = reactive({
  companyId: '',
  plan: null,
  billing_cycle: null,
  notes: '',
})

// 表格配置
const headers = [
  { title: 'ID', key: 'id', width: '80px', align: 'start' },
  { title: '公司ID', key: 'company_id', width: '120px' },
  { title: '订阅计划', key: 'plan', width: '150px' },
  { title: '计费周期', key: 'billing_cycle', width: '120px' },
  { title: '状态', key: 'status', width: '100px' },
  { title: '开始日期', key: 'start_at', width: '150px' },
  { title: '到期日期', key: 'end_at', width: '180px' },
  { title: '操作', key: 'actions', width: '180px', align: 'end', sortable: false },
]

const planOptions = [
  { title: '全部', value: null },
  { title: '免费版', value: 'free' },
  { title: '专业版', value: 'pro' },
  { title: '企业版', value: 'enterprise' },
]

const statusOptions = [
  { title: '全部', value: null },
  { title: '活跃', value: 'active' },
  { title: '已过期', value: 'expired' },
]

const cycleOptions = [
  { title: '月付', value: 'monthly' },
  { title: '年付', value: 'yearly' },
]

// 计算属性
const activeSubscriptions = computed(() => 
  subscriptionStore.subscriptions.filter(s => s.status === 'active').length
)

const expiringSubscriptions = computed(() => 
  subscriptionStore.subscriptions.filter(s => {
    if (s.status !== 'active') return false
    const daysUntilExpiry = differenceInDays(new Date(s.end_at), new Date())
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0
  }).length
)

const expiredSubscriptions = computed(() => 
  subscriptionStore.subscriptions.filter(s => s.status === 'expired').length
)

const currentPage = computed({
  get: () => subscriptionStore.filters.page,
  set: (val) => subscriptionStore.filters.page = val
})

// 方法
const getPlanColor = (plan) => ({ free:'grey', pro:'primary', enterprise:'warning' }[plan] || 'grey')

const getPlanIcon = (plan) => ({ free:'mdi-circle-outline', pro:'mdi-star', enterprise:'mdi-crown' }[plan] || 'mdi-help-circle')

const getPlanText = (plan) => ({ free:'免费版', pro:'专业版', enterprise:'企业版' }[plan] || plan)

const getStatusColor = (status) => {
  const colors = {
    active: 'success',
    expired: 'error',
    cancelled: 'grey',
  }
  return colors[status] || 'grey'
}

const getStatusText = (status) => ({ active:'活跃', expired:'已过期', canceled:'已取消' }[status] || status)

const formatDate = (date) => {
  if (!date) return '-'
  return format(new Date(date), 'yyyy-MM-dd', { locale: zhCN })
}

const getDaysUntilExpiry = (date) => {
  const days = differenceInDays(new Date(date), new Date())
  if (days < 0) return '已过期'
  if (days === 0) return '今天到期'
  if (days === 1) return '明天到期'
  return `${days}天后到期`
}

const isExpiringSoon = (date) => {
  const days = differenceInDays(new Date(date), new Date())
  return days <= 30 && days > 0
}

const handleSearch = () => { subscriptionStore.filters.companyId = searchQuery.value; subscriptionStore.fetchSubscriptions() }

const handleFilter = () => {
  subscriptionStore.filters.plan = planFilter.value
  subscriptionStore.filters.status = statusFilter.value
  subscriptionStore.fetchSubscriptions()
}

const handleRefresh = () => {
  subscriptionStore.fetchSubscriptions()
}

const handlePageChange = (page) => {
  subscriptionStore.fetchSubscriptions({ page })
}

const handleItemsPerPageChange = (itemsPerPage) => {
  subscriptionStore.filters.itemsPerPage = itemsPerPage
  subscriptionStore.fetchSubscriptions()
}

const viewSubscription = (subscription) => {
  router.push(`/subscriptions/${subscription.id}`)
}

const renewSubscription = (subscription) => { renewingSubscription.value = subscription; showRenewDialog.value = true }

const cancelSubscription = (subscription) => { cancelingSubscription.value = subscription; showCancelDialog.value = true }

const editSubscription = (subscription) => {
  editingSubscription.value = subscription
  Object.assign(subscriptionFormData, {
    companyId: subscription.company_id,
    plan: subscription.plan,
    billing_cycle: subscription.billing_cycle,
    notes: subscription.notes || '',
  })
  showCreateDialog.value = true
}

const confirmDelete = (subscription) => {
  deletingSubscription.value = subscription
  showDeleteDialog.value = true
}

const closeDialog = () => {
  showCreateDialog.value = false
  editingSubscription.value = null
  Object.assign(subscriptionFormData, {
    companyId: '',
    plan: null,
    billing_cycle: null,
    notes: '',
  })
}

const handleSubmit = async () => {
  const { valid } = await subscriptionForm.value.validate()
  if (!valid) return

  saving.value = true
  try {
    if (editingSubscription.value) {
      await subscriptionStore.updateSubscription(editingSubscription.value.id, subscriptionFormData)
    } else {
      await subscriptionStore.createSubscription(subscriptionFormData)
    }
    closeDialog()
    await subscriptionStore.fetchSubscriptions()
  } catch (error) {
    console.error('Failed to save subscription:', error)
  } finally {
    saving.value = false
  }
}

const handleRenew = async () => {
  if (!renewingSubscription.value) return
  
  renewing.value = true
  try {
    await subscriptionStore.renewSubscription(renewingSubscription.value.id)
    showRenewDialog.value = false
    renewingSubscription.value = null
    await subscriptionStore.fetchSubscriptions()
  } catch (error) {
    console.error('Failed to renew subscription:', error)
  } finally {
    renewing.value = false
  }
}

const handleCancel = async () => {
  if (!cancelingSubscription.value) return
  
  canceling.value = true
  try {
    await subscriptionStore.cancelSubscription(cancelingSubscription.value.id)
    showCancelDialog.value = false
    cancelingSubscription.value = null
    await subscriptionStore.fetchSubscriptions()
  } catch (error) {
    console.error('Failed to cancel subscription:', error)
  } finally {
    canceling.value = false
  }
}

const handleDelete = async () => {
  if (!deletingSubscription.value) return
  
  deleting.value = true
  try {
    await subscriptionStore.deleteSubscription(deletingSubscription.value.id)
    showDeleteDialog.value = false
    deletingSubscription.value = null
    await subscriptionStore.fetchSubscriptions()
  } catch (error) {
    console.error('Failed to delete subscription:', error)
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  subscriptionStore.fetchSubscriptions()
})
</script>

<style scoped>
:deep(.clean-table .v-data-table-header__content) {
  font-weight: 600;
  color: #424242;
}
:deep(.clean-table .v-data-table__th) {
  background-color: #f8f9fa !important;
}
</style>
