<template>
  <StandardPage
    title="订阅详情"
    subtitle="查看和管理订阅详细信息"
    show-back
    @back="goBack"
  >
    <template #actions>
      <div class="d-flex ga-2">
        <VBtn
          v-if="subscription?.status === 'active'"
          color="warning"
          prepend-icon="mdi-cancel"
          variant="tonal"
          :loading="loading"
          @click="cancelSubscription"
        >
          取消订阅
        </VBtn>
        <VBtn
          v-if="subscription?.status === 'active'"
          color="success"
          prepend-icon="mdi-refresh"
          variant="tonal"
          :loading="loading"
          @click="renewSubscription"
        >
          续费订阅
        </VBtn>
        <VBtn
          color="primary"
          prepend-icon="mdi-pencil"
          @click="openEditDialog"
        >
          编辑订阅
        </VBtn>
      </div>
    </template>

    <!-- 订阅基本信息卡片 -->
    <VRow class="mb-6">
      <VCol
        cols="12"
        md="8"
      >
        <VCard>
          <VCardTitle class="d-flex align-center pa-4">
            <VIcon
              icon="mdi-credit-card"
              class="me-2"
              size="small"
            />
            订阅信息
            <VSpacer />
            <VChip
              :color="getStatusColor(subscription?.status)"
              size="small"
              variant="tonal"
              label
            >
              {{ getStatusText(subscription?.status) }}
            </VChip>
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-4">
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">
                    订阅计划
                  </div>
                  <div class="text-body-1 font-weight-medium">
                    <VIcon
                      :icon="getPlanIcon(subscription?.plan)"
                      size="small"
                      class="me-1"
                    />
                    {{ getPlanName(subscription?.plan) || '-' }}
                  </div>
                </div>
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">
                    客户名称
                  </div>
                  <div class="text-body-1">
                    {{ subscription?.customer?.username || '-' }}
                  </div>
                </div>
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">
                    金额
                  </div>
                  <div class="text-body-1">
                    ¥{{ subscription?.amount || 0 }}
                  </div>
                </div>
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">
                    支付状态
                  </div>
                  <VChip
                    :color="getPaymentStatusColor(subscription?.paymentStatus)"
                    size="small"
                    variant="tonal"
                    label
                  >
                    {{ getPaymentStatusText(subscription?.paymentStatus) }}
                  </VChip>
                </div>
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">
                    开始时间
                  </div>
                  <div class="text-body-1">
                    {{ formatDate(subscription?.startDate) }}
                  </div>
                </div>
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">
                    结束时间
                  </div>
                  <div class="text-body-1">
                    {{ formatDate(subscription?.endDate) }}
                  </div>
                </div>
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">
                    创建时间
                  </div>
                  <div class="text-body-1">
                    {{ formatDate(subscription?.createdAt) }}
                  </div>
                </div>
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">
                    自动续费
                  </div>
                  <VChip
                    :color="subscription?.autoRenew ? 'success' : 'default'"
                    size="small"
                    variant="tonal"
                    label
                  >
                    {{ subscription?.autoRenew ? '开启' : '关闭' }}
                  </VChip>
                </div>
              </VCol>
            </VRow>
            <div
              v-if="subscription?.description"
              class="mb-4"
            >
              <div class="text-caption text-medium-emphasis mb-1">
                描述
              </div>
              <div class="text-body-2">
                {{ subscription.description }}
              </div>
            </div>
            <div v-if="subscription?.remark">
              <div class="text-caption text-medium-emphasis mb-1">
                备注
              </div>
              <div class="text-body-2">
                {{ subscription.remark }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="4"
      >
        <VCard height="100%">
          <VCardTitle class="d-flex align-center pa-4">
            <VIcon
              icon="mdi-chart-pie"
              class="me-2"
              size="small"
            />
            使用统计
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-4">
            <div class="text-center mb-6">
              <div class="text-h3 font-weight-bold text-primary mb-1">
                {{ usageStats?.totalUsage || 0 }}
              </div>
              <div class="text-caption text-medium-emphasis">
                总使用次数
              </div>
            </div>
            
            <VRow class="text-center">
              <VCol cols="6">
                <div class="text-h5 font-weight-bold text-success mb-1">
                  {{ usageStats?.remainingUsage || 0 }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  剩余次数
                </div>
              </VCol>
              <VCol cols="6">
                <div class="text-h5 font-weight-bold text-info mb-1">
                  {{ usageStats?.resumeCount || 0 }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  简历生成数
                </div>
              </VCol>
            </VRow>
            
            <div class="mt-6">
              <div class="d-flex justify-space-between mb-1">
                <span class="text-caption text-medium-emphasis">使用率</span>
                <span class="text-caption font-weight-bold">{{ Math.round((usageStats?.totalUsage / usageStats?.totalLimit) * 100) || 0 }}%</span>
              </div>
              <VProgressLinear
                :model-value="Math.round((usageStats?.totalUsage / usageStats?.totalLimit) * 100) || 0"
                color="primary"
                height="8"
                rounded
              />
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 支付记录 -->
    <VRow class="mb-6">
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center pa-4">
            <VIcon
              icon="mdi-receipt"
              class="me-2"
              size="small"
            />
            支付记录
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-0">
            <VDataTable
              :headers="paymentHeaders"
              :items="paymentHistory"
              :loading="loading"
              item-value="id"
              class="clean-table elevation-0"
              hover
            >
              <template #item.amount="{ item }">
                <div class="text-body-2 font-weight-medium">
                  ¥{{ item.amount }}
                </div>
              </template>
              <template #item.status="{ item }">
                <VChip
                  :color="getPaymentStatusColor(item.status)"
                  size="small"
                  variant="tonal"
                  label
                >
                  {{ getPaymentStatusText(item.status) }}
                </VChip>
              </template>
              <template #item.paymentDate="{ item }">
                <div class="text-body-2">
                  {{ formatDate(item.paymentDate) }}
                </div>
              </template>
              <template #item.actions="{ item }">
                <div class="d-flex ga-2">
                  <VBtn
                    icon
                    size="small"
                    variant="text"
                    color="primary"
                    @click="viewInvoice(item)"
                  >
                    <VIcon icon="mdi-file-document-outline" />
                    <VTooltip
                      activator="parent"
                      location="top"
                    >
                      查看发票
                    </VTooltip>
                  </VBtn>
                  <VBtn
                    v-if="item.status === 'pending'"
                    icon
                    size="small"
                    variant="text"
                    color="success"
                    @click="processPayment(item)"
                  >
                    <VIcon icon="mdi-cash" />
                    <VTooltip
                      activator="parent"
                      location="top"
                    >
                      支付
                    </VTooltip>
                  </VBtn>
                </div>
              </template>
              <template #no-data>
                <div class="text-center pa-8 text-medium-emphasis">
                  <VIcon
                    icon="mdi-receipt-text-outline"
                    size="48"
                    class="mb-2"
                  />
                  <div>暂无支付记录</div>
                </div>
              </template>
            </VDataTable>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 使用历史 -->
    <VRow class="mb-6">
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center pa-4">
            <VIcon
              icon="mdi-history"
              class="me-2"
              size="small"
            />
            使用历史
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-0">
            <VDataTable
              :headers="usageHeaders"
              :items="usageHistory"
              :loading="loading"
              item-value="id"
              class="clean-table elevation-0"
              hover
            >
              <template #item.type="{ item }">
                <VChip
                  :color="getUsageTypeColor(item.type)"
                  size="small"
                  variant="tonal"
                  label
                >
                  {{ getUsageTypeText(item.type) }}
                </VChip>
              </template>
              <template #item.count="{ item }">
                <div class="text-body-2 font-weight-medium">
                  {{ item.count }}
                </div>
              </template>
              <template #item.usedAt="{ item }">
                <div class="text-body-2">
                  {{ formatDate(item.usedAt) }}
                </div>
              </template>
              <template #no-data>
                <div class="text-center pa-8 text-medium-emphasis">
                  <VIcon
                    icon="mdi-history"
                    size="48"
                    class="mb-2"
                  />
                  <div>暂无使用记录</div>
                </div>
              </template>
            </VDataTable>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 最近活动 -->
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center pa-4">
            <VIcon
              icon="mdi-pulse"
              class="me-2"
              size="small"
            />
            最近活动
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-0">
            <VList
              lines="two"
              class="pa-0"
            >
              <template
                v-for="(activity, index) in recentActivities"
                :key="activity.id"
              >
                <VListItem class="pa-4">
                  <template #prepend>
                    <VAvatar
                      size="40"
                      :color="getActivityColor(activity.type)"
                      variant="tonal"
                      class="me-3"
                    >
                      <VIcon
                        :icon="getActivityIcon(activity.type)"
                        size="20"
                      />
                    </VAvatar>
                  </template>
                  
                  <VListItemTitle class="font-weight-medium mb-1">
                    {{ activity.title }}
                  </VListItemTitle>
                  <VListItemSubtitle>
                    <div class="text-body-2 mb-1">
                      {{ activity.description }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      {{ formatTime(activity.createdAt) }}
                    </div>
                  </VListItemSubtitle>
                </VListItem>
                <VDivider v-if="index < recentActivities.length - 1" />
              </template>
              
              <div
                v-if="!recentActivities.length"
                class="text-center pa-8 text-medium-emphasis"
              >
                <VIcon
                  icon="mdi-bell-sleep-outline"
                  size="48"
                  class="mb-2"
                />
                <div>暂无活动记录</div>
              </div>
            </VList>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 编辑订阅对话框 -->
    <VDialog
      v-model="editDialog"
      max-width="600"
    >
      <VCard>
        <VCardTitle class="d-flex align-center pa-4">
          <span class="text-h6">编辑订阅信息</span>
          <VSpacer />
          <VBtn
            icon="mdi-close"
            variant="text"
            @click="editDialog = false"
          />
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VForm
            ref="editForm"
            v-model="editFormValid"
          >
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="editFormData.plan"
                  label="订阅计划"
                  :items="planOptions"
                  item-title="text"
                  item-value="value"
                  :rules="[v => !!v || '请选择订阅计划']"
                  variant="outlined"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="editFormData.amount"
                  label="金额"
                  type="number"
                  prefix="¥"
                  :rules="[v => !!v || '请输入金额', v => v > 0 || '金额必须大于0']"
                  variant="outlined"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="editFormData.startDate"
                  label="开始时间"
                  type="date"
                  :rules="[v => !!v || '请选择开始时间']"
                  variant="outlined"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="editFormData.endDate"
                  label="结束时间"
                  type="date"
                  :rules="[v => !!v || '请选择结束时间']"
                  variant="outlined"
                  required
                />
              </VCol>
              <VCol cols="12">
                <VSwitch
                  v-model="editFormData.autoRenew"
                  label="自动续费"
                  color="primary"
                  hide-details
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="editFormData.remark"
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
          <VBtn
            color="grey-darken-1"
            variant="text"
            @click="editDialog = false"
          >
            取消
          </VBtn>
          <VBtn
            color="primary"
            :loading="loading"
            @click="saveEdit"
          >
            保存
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSubscriptionStore } from '@/stores/subscription'
import { useUserStore } from '@/stores/user'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import StandardPage from '@/components/StandardPage.vue'
import ui from '@/utils/ui-components.js'

const route = useRoute()
const router = useRouter()
const subscriptionStore = useSubscriptionStore()
const userStore = useUserStore()

const loading = ref(false)

// 订阅数据
const subscription = computed(() => subscriptionStore.currentSubscription)
const usageStats = ref({
  totalUsage: 156,
  remainingUsage: 344,
  resumeCount: 23,
  totalLimit: 500
})

// 支付历史（模拟数据）
const paymentHistory = ref([
  {
    id: 1,
    amount: 299,
    status: 'paid',
    paymentDate: '2024-01-01T10:30:00Z',
    paymentMethod: '支付宝',
    transactionId: 'TRX202401010001'
  },
  {
    id: 2,
    amount: 299,
    status: 'paid',
    paymentDate: '2023-12-01T14:20:00Z',
    paymentMethod: '微信支付',
    transactionId: 'TRX202312010002'
  }
])

// 使用历史（模拟数据）
const usageHistory = ref([
  {
    id: 1,
    type: 'resume',
    count: 1,
    description: '生成技术岗位简历',
    usedAt: '2024-01-15T10:30:00Z'
  },
  {
    id: 2,
    type: 'ai',
    count: 1,
    description: 'AI优化简历内容',
    usedAt: '2024-01-14T16:45:00Z'
  },
  {
    id: 3,
    type: 'template',
    count: 2,
    description: '下载商务风格模板',
    usedAt: '2024-01-13T09:15:00Z'
  }
])

// 最近活动（模拟数据）
const recentActivities = ref([
  {
    id: 1,
    type: 'subscription',
    title: '订阅续费',
    description: '专业版订阅续费成功',
    createdAt: '2024-01-01T10:30:00Z'
  },
  {
    id: 2,
    type: 'payment',
    title: '支付成功',
    description: '通过支付宝支付 ¥299',
    createdAt: '2024-01-01T10:30:00Z'
  },
  {
    id: 3,
    type: 'usage',
    title: 'AI简历生成',
    description: '使用AI生成了一份简历',
    createdAt: '2023-12-15T16:45:00Z'
  }
])

// 表格头
const paymentHeaders = [
  { title: '金额', key: 'amount', sortable: true },
  { title: '状态', key: 'status', sortable: true },
  { title: '支付方式', key: 'paymentMethod', sortable: true },
  { title: '交易号', key: 'transactionId', sortable: false },
  { title: '支付时间', key: 'paymentDate', sortable: true },
  { title: '操作', key: 'actions', sortable: false, align: 'end' }
]

const usageHeaders = [
  { title: '类型', key: 'type', sortable: true },
  { title: '次数', key: 'count', sortable: true },
  { title: '描述', key: 'description', sortable: false },
  { title: '使用时间', key: 'usedAt', sortable: true }
]

// 订阅计划选项
const planOptions = [
  { text: '免费版', value: 'free' },
  { text: '专业版', value: 'professional' },
  { text: '企业版', value: 'enterprise' }
]

// 编辑对话框
const editDialog = ref(false)
const editFormValid = ref(false)
const editFormData = ref({
  plan: '',
  amount: 0,
  startDate: '',
  endDate: '',
  autoRenew: false,
  remark: ''
})

// 获取订阅详情
const fetchSubscriptionDetail = async () => {
  loading.value = true
  try {
    await subscriptionStore.fetchSubscriptionDetail(route.params.id)
    // 初始化编辑表单数据
    if (subscription.value) {
      editFormData.value = {
        plan: subscription.value.plan,
        amount: subscription.value.amount,
        startDate: formatDateForInput(subscription.value.startDate),
        endDate: formatDateForInput(subscription.value.endDate),
        autoRenew: subscription.value.autoRenew,
        remark: subscription.value.remark || ''
      }
    }
  } catch (error) {
    console.error('Failed to fetch subscription detail:', error)
  } finally {
    loading.value = false
  }
}

// 返回上一页
const goBack = () => {
  router.push('/subscriptions')
}

// 打开编辑对话框
const openEditDialog = () => {
  editDialog.value = true
}

// 保存编辑
const saveEdit = async () => {
  if (!editFormValid.value) return
  
  loading.value = true
  try {
    const updateData = {
      ...editFormData.value,
      startDate: new Date(editFormData.value.startDate).toISOString(),
      endDate: new Date(editFormData.value.endDate).toISOString()
    }
    await subscriptionStore.updateSubscription(route.params.id, updateData)
    await fetchSubscriptionDetail()
    editDialog.value = false
  } catch (error) {
    console.error('Failed to update subscription:', error)
  } finally {
    loading.value = false
  }
}

// 续费订阅
const renewSubscription = async () => {
  loading.value = true
  try {
    await subscriptionStore.renewSubscription(route.params.id)
    await fetchSubscriptionDetail()
  } catch (error) {
    console.error('Failed to renew subscription:', error)
  } finally {
    loading.value = false
  }
}

// 取消订阅
const cancelSubscription = async () => {
  ui.showConfirm('确定要取消此订阅吗？', async () => {
    loading.value = true
    try {
      await subscriptionStore.cancelSubscription(route.params.id)
      await fetchSubscriptionDetail()
      ui.showAlert('订阅已取消', { type: 'success' })
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
      ui.showAlert('取消订阅失败', { type: 'error' })
    } finally {
      loading.value = false
    }
  }, null, { type: 'warning', title: '取消确认' })
}

// 查看发票
const viewInvoice = (payment) => {
  console.log('View invoice:', payment)
}

// 处理支付
const processPayment = (payment) => {
  console.log('Process payment:', payment)
}

// 辅助函数
const getStatusColor = (status) => {
  const colors = {
    active: 'success',
    expired: 'error',
    cancelled: 'grey',
    pending: 'warning'
  }
  return colors[status] || 'grey'
}

const getStatusText = (status) => ({ 
  active: '活跃', 
  expired: '已过期', 
  canceled: '已取消',
  pending: '待支付'
}[status] || status)

const getPlanName = (plan) => ({ 
  free: '免费版', 
  professional: '专业版', 
  enterprise: '企业版' 
}[plan] || plan)

const getPlanIcon = (plan) => ({ 
  free: 'mdi-circle-outline', 
  professional: 'mdi-star', 
  enterprise: 'mdi-crown' 
}[plan] || 'mdi-help-circle')

const getPaymentStatusColor = (status) => {
  const colors = {
    paid: 'success',
    pending: 'warning',
    failed: 'error'
  }
  return colors[status] || 'grey'
}

const getPaymentStatusText = (status) => ({ 
  paid: '已支付', 
  pending: '待支付', 
  failed: '支付失败' 
}[status] || status)

const getUsageTypeColor = (type) => {
  const colors = {
    resume: 'primary',
    ai: 'secondary',
    template: 'info'
  }
  return colors[type] || 'grey'
}

const getUsageTypeText = (type) => ({ 
  resume: '简历生成', 
  ai: 'AI优化', 
  template: '模板下载' 
}[type] || type)

const getActivityColor = (type) => {
  const colors = {
    subscription: 'primary',
    payment: 'success',
    usage: 'info'
  }
  return colors[type] || 'grey'
}

const getActivityIcon = (type) => {
  const icons = {
    subscription: 'mdi-credit-card-refresh',
    payment: 'mdi-cash-check',
    usage: 'mdi-file-document-edit'
  }
  return icons[type] || 'mdi-circle-small'
}

// 格式化日期
const formatDate = (date) => {
  if (!date) return '-'
  return format(new Date(date), 'yyyy-MM-dd HH:mm', { locale: zhCN })
}

// 格式化日期用于输入框
const formatDateForInput = (date) => {
  if (!date) return ''
  return format(new Date(date), 'yyyy-MM-dd')
}

// 格式化相对时间
const formatTime = (date) => {
  if (!date) return '-'
  return format(new Date(date), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })
}
</script>

<style scoped>
:deep(.clean-table .v-data-table__td) { }
</style>
