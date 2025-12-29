<template>
  <StandardPage
    title="账号详情"
    subtitle="查看和管理客户详细信息"
    show-back
    @back="goBack"
  >
    <template #actions>
      <VBtn
        color="primary"
        prepend-icon="mdi-pencil"
        @click="openEditDialog"
      >
        编辑账号
      </VBtn>
    </template>

    <!-- 客户基本信息卡片 -->
    <VRow class="mb-6">
      <VCol cols="12" md="8">
        <VCard class="h-100">
          <VCardTitle class="d-flex align-center pa-4">
            <VIcon icon="mdi-account" class="me-2" size="small" />
            基本信息
            <VSpacer />
            <VChip
              :color="getStatusColor(customer?.status)"
              size="small"
              variant="tonal"
              label
            >
              {{ getStatusText(customer?.status) }}
            </VChip>
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-4">
            <VRow>
              <VCol cols="12" md="6">
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">用户名</div>
                  <div class="text-body-1 font-weight-medium">{{ customer?.username || '-' }}</div>
                </div>
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">邮箱</div>
                  <div class="text-body-1">{{ customer?.email || '-' }}</div>
                </div>
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">手机号</div>
                  <div class="text-body-1">{{ customer?.phone || '-' }}</div>
                </div>
              </VCol>
              <VCol cols="12" md="6">
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">注册时间</div>
                  <div class="text-body-1">{{ formatDate(customer?.createdAt) }}</div>
                </div>
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">最后登录</div>
                  <div class="text-body-1">{{ formatDate(customer?.lastLoginAt) || '从未登录' }}</div>
                </div>
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">备注</div>
                  <div class="text-body-1">{{ customer?.remark || '无备注' }}</div>
                </div>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" md="4">
        <VCard class="h-100">
          <VCardTitle class="d-flex align-center pa-4">
            <VIcon icon="mdi-chart-pie" class="me-2" size="small" />
            统计信息
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-4">
            <div class="d-flex flex-column gap-4">
              <div class="d-flex align-center justify-space-between pa-3 bg-grey-lighten-4 rounded">
                <div>
                  <div class="text-h5 font-weight-bold text-primary">{{ customerStats?.totalResumes || 0 }}</div>
                  <div class="text-caption text-medium-emphasis">总简历数</div>
                </div>
                <VAvatar color="primary" variant="tonal" rounded>
                  <VIcon icon="mdi-file-document" />
                </VAvatar>
              </div>
              
              <div class="d-flex align-center justify-space-between pa-3 bg-grey-lighten-4 rounded">
                <div>
                  <div class="text-h5 font-weight-bold text-success">{{ customerStats?.totalDownloads || 0 }}</div>
                  <div class="text-caption text-medium-emphasis">下载次数</div>
                </div>
                <VAvatar color="success" variant="tonal" rounded>
                  <VIcon icon="mdi-download" />
                </VAvatar>
              </div>

              <div class="d-flex align-center justify-space-between pa-3 bg-grey-lighten-4 rounded">
                <div>
                  <div class="text-h5 font-weight-bold text-info">{{ customerStats?.totalResumes || 0 }}</div>
                  <div class="text-caption text-medium-emphasis">总简历数</div>
                </div>
                <VAvatar color="info" variant="tonal" rounded>
                  <VIcon icon="mdi-file-document-outline" />
                </VAvatar>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 订阅信息 -->
    <VRow class="mb-6">
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center pa-4">
            <VIcon icon="mdi-credit-card" class="me-2" size="small" />
            订阅信息
            <VSpacer />
            <VBtn
              color="primary"
              size="small"
              prepend-icon="mdi-plus"
              @click="openSubscriptionDialog"
            >
              新建订阅
            </VBtn>
          </VCardTitle>
          <VDivider />
          <VDataTable
            :headers="subscriptionHeaders"
            :items="customerSubscriptions"
            :loading="loading"
            item-value="id"
            class="clean-table"
            hover
          >
            <template #item.status="{ item }">
              <VChip
                :color="getSubscriptionStatusColor(item.status)"
                size="small"
                variant="tonal"
                label
              >
                {{ getSubscriptionStatusText(item.status) }}
              </VChip>
            </template>
            <template #item.plan="{ item }">
              <VChip size="small" variant="outlined" class="text-caption">
                {{ getPlanName(item.plan) }}
              </VChip>
            </template>
            <template #item.amount="{ item }">
              <div class="text-body-2 font-weight-medium">
                ¥{{ item.amount }}
              </div>
            </template>
            <template #item.startDate="{ item }">
              <div class="text-caption">
                {{ formatDate(item.startDate) }}
              </div>
            </template>
            <template #item.endDate="{ item }">
              <div class="text-caption">
                {{ formatDate(item.endDate) }}
              </div>
            </template>
            <template #item.actions="{ item }">
              <div class="d-flex gap-2">
                <VBtn
                  icon
                  size="small"
                  variant="text"
                  color="primary"
                  @click="editSubscription(item)"
                  v-tooltip="'编辑'"
                >
                  <VIcon icon="mdi-pencil" />
                </VBtn>
                <VBtn
                  icon
                  size="small"
                  variant="text"
                  color="error"
                  @click="cancelSubscription(item)"
                  v-tooltip="'取消订阅'"
                >
                  <VIcon icon="mdi-cancel" />
                </VBtn>
              </div>
            </template>
            <template #no-data>
              <div class="text-center pa-4 text-medium-emphasis">
                暂无订阅记录
              </div>
            </template>
          </VDataTable>
        </VCard>
      </VCol>
    </VRow>

    <!-- 最近活动 -->
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center pa-4">
            <VIcon icon="mdi-history" class="me-2" size="small" />
            最近活动
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-0">
            <VList lines="two" class="pa-2">
              <template v-for="(activity, index) in recentActivities" :key="activity.id">
                <VListItem rounded="lg">
                  <template #prepend>
                    <VAvatar
                      size="40"
                      :color="getActivityColor(activity.type)"
                      variant="tonal"
                    >
                      <VIcon :icon="getActivityIcon(activity.type)" size="20" />
                    </VAvatar>
                  </template>
                  
                  <VListItemTitle class="font-weight-medium mb-1">{{ activity.title }}</VListItemTitle>
                  <VListItemSubtitle>
                    <div class="d-flex justify-space-between align-center">
                      <span class="text-caption">{{ activity.description }}</span>
                      <span class="text-caption text-medium-emphasis">{{ formatTime(activity.createdAt) }}</span>
                    </div>
                  </VListItemSubtitle>
                </VListItem>
                <VDivider v-if="index < recentActivities.length - 1" inset class="my-2" />
              </template>
              
              <div v-if="!recentActivities.length" class="text-center pa-8 text-medium-emphasis">
                暂无活动记录
              </div>
            </VList>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 编辑客户对话框 -->
    <VDialog v-model="editDialog" max-width="600">
      <VCard>
        <VCardTitle class="d-flex align-center justify-space-between pa-4">
          <span class="text-h6">编辑客户信息</span>
          <VBtn icon="mdi-close" variant="text" size="small" @click="editDialog = false" />
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VForm ref="editForm" v-model="editFormValid">
            <VRow>
              <VCol cols="12" md="6">
                <VTextField
                  v-model="editFormData.username"
                  label="用户名"
                  :rules="[v => !!v || '请输入用户名']"
                  variant="outlined"
                  required
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField
                  v-model="editFormData.email"
                  label="邮箱"
                  type="email"
                  :rules="[v => !!v || '请输入邮箱', v => /.+@.+/.test(v) || '邮箱格式不正确']"
                  variant="outlined"
                  required
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField
                  v-model="editFormData.phone"
                  label="手机号"
                  variant="outlined"
                />
              </VCol>
              <VCol cols="12" md="6">
                <VSelect
                  v-model="editFormData.status"
                  label="状态"
                  :items="statusOptions"
                  item-title="text"
                  item-value="value"
                  variant="outlined"
                  required
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
          <VBtn color="grey-darken-1" variant="text" @click="editDialog = false">取消</VBtn>
          <VBtn color="primary" @click="saveEdit" :loading="loading">保存</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 新建订阅对话框 -->
    <VDialog v-model="subscriptionDialog" max-width="500">
      <VCard>
        <VCardTitle class="d-flex align-center justify-space-between pa-4">
          <span class="text-h6">新建订阅</span>
          <VBtn icon="mdi-close" variant="text" size="small" @click="subscriptionDialog = false" />
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VForm ref="subscriptionForm" v-model="subscriptionFormValid">
            <VRow>
              <VCol cols="12">
                <VSelect
                  v-model="subscriptionFormData.plan"
                  label="订阅计划"
                  :items="planOptions"
                  item-title="text"
                  item-value="value"
                  :rules="[v => !!v || '请选择订阅计划']"
                  variant="outlined"
                  required
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField
                  v-model="subscriptionFormData.amount"
                  label="金额"
                  type="number"
                  prefix="¥"
                  :rules="[v => !!v || '请输入金额', v => v > 0 || '金额必须大于0']"
                  variant="outlined"
                  required
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField
                  v-model="subscriptionFormData.duration"
                  label="时长（月）"
                  type="number"
                  :rules="[v => !!v || '请输入时长', v => v > 0 || '时长必须大于0']"
                  variant="outlined"
                  required
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="subscriptionFormData.remark"
                  label="备注"
                  rows="2"
                  variant="outlined"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn color="grey-darken-1" variant="text" @click="subscriptionDialog = false">取消</VBtn>
          <VBtn color="primary" @click="createSubscription" :loading="loading">创建</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCustomerStore } from '@/stores/customer'
import { useUserStore } from '@/stores/user'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import StandardPage from '@/components/StandardPage.vue'

const route = useRoute()
const router = useRouter()
const customerStore = useCustomerStore()
const userStore = useUserStore()

const loading = ref(false)

// 客户数据
const customer = computed(() => customerStore.currentCustomer)
const customerStats = ref({
  totalResumes: 15,
  totalDownloads: 128,
  totalJobs: 0
})

// 订阅数据（模拟数据）
const customerSubscriptions = ref([
  {
    id: 1,
    plan: 'professional',
    status: 'active',
    amount: 299,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    autoRenew: true
  },
  {
    id: 2,
    plan: 'free',
    status: 'expired',
    amount: 0,
    startDate: '2023-06-01',
    endDate: '2023-12-31',
    autoRenew: false
  }
])

// 最近活动（模拟数据）
const recentActivities = ref([
  {
    id: 1,
    type: 'user',
    title: '更新个人信息',
    description: '修改了邮箱地址',
    createdAt: '2024-01-15T10:30:00Z'
  },
  {
    id: 2,
    type: 'subscription',
    title: '订阅续费',
    description: '专业版订阅续费成功',
    createdAt: '2024-01-10T14:20:00Z'
  },
  {
    id: 3,
    type: 'ai',
    title: 'AI简历生成',
    description: '使用AI生成了一份简历',
    createdAt: '2024-01-08T16:45:00Z'
  }
])

// 表格头
const subscriptionHeaders = [
  { title: '计划', key: 'plan', sortable: true },
  { title: '状态', key: 'status', sortable: true },
  { title: '金额', key: 'amount', sortable: true },
  { title: '开始时间', key: 'startDate', sortable: true },
  { title: '结束时间', key: 'endDate', sortable: true },
  { title: '操作', key: 'actions', sortable: false }
]

// 状态选项
const statusOptions = [
  { text: '活跃', value: 'active' },
  { text: '待审核', value: 'pending' },
  { text: '封禁', value: 'blocked' }
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
  username: '',
  email: '',
  phone: '',
  status: 'active',
  remark: ''
})
const editForm = ref(null) // Added ref for form

// 新建订阅对话框
const subscriptionDialog = ref(false)
const subscriptionFormValid = ref(false)
const subscriptionFormData = ref({
  plan: '',
  amount: 0,
  duration: 1,
  remark: ''
})
const subscriptionForm = ref(null) // Added ref for form

// 获取客户详情
const fetchCustomerDetail = async () => {
  loading.value = true
  try {
    await customerStore.fetchCustomerDetail(route.params.id)
    // 初始化编辑表单数据
    if (customer.value) {
      editFormData.value = {
        username: customer.value.username,
        email: customer.value.email,
        phone: customer.value.phone,
        status: customer.value.status,
        remark: customer.value.remark || ''
      }
    }
  } catch (error) {
    console.error('Failed to fetch customer detail:', error)
  } finally {
    loading.value = false
  }
}

// 返回上一页
const goBack = () => {
  router.push('/customers')
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
    await customerStore.updateCustomer(route.params.id, editFormData.value)
    await fetchCustomerDetail()
    editDialog.value = false
  } catch (error) {
    console.error('Failed to update customer:', error)
  } finally {
    loading.value = false
  }
}

// 打开新建订阅对话框
const openSubscriptionDialog = () => {
  subscriptionFormData.value = {
    plan: 'professional',
    amount: 299,
    duration: 12,
    remark: ''
  }
  subscriptionDialog.value = true
}

// 创建订阅
const createSubscription = async () => {
  if (!subscriptionFormValid.value) return
  
  loading.value = true
  try {
    // 这里应该调用订阅API
    console.log('Creating subscription:', subscriptionFormData.value)
    subscriptionDialog.value = false
  } catch (error) {
    console.error('Failed to create subscription:', error)
  } finally {
    loading.value = false
  }
}

// 编辑订阅
const editSubscription = (subscription) => {
  console.log('Edit subscription:', subscription)
}

// 取消订阅
const cancelSubscription = (subscription) => {
  console.log('Cancel subscription:', subscription)
}

// 格式化日期
const formatDate = (date) => {
  if (!date) return '-'
  return format(new Date(date), 'yyyy-MM-dd HH:mm', { locale: zhCN })
}

// 格式化相对时间
const formatTime = (date) => {
  if (!date) return '-'
  return format(new Date(date), 'yyyy-MM-dd HH:mm', { locale: zhCN })
}

// 获取状态颜色
const getStatusColor = (status) => {
  const colors = {
    active: 'success',
    pending: 'warning',
    blocked: 'error'
  }
  return colors[status] || 'default'
}

// 获取状态文本
const getStatusText = (status) => {
  const texts = {
    active: '活跃',
    pending: '待审核',
    blocked: '封禁'
  }
  return texts[status] || status
}

// 获取订阅状态颜色
const getSubscriptionStatusColor = (status) => {
  const colors = {
    active: 'success',
    expired: 'error',
    cancelled: 'default',
    pending: 'warning'
  }
  return colors[status] || 'default'
}

// 获取订阅状态文本
const getSubscriptionStatusText = (status) => {
  const texts = {
    active: '活跃',
    expired: '已过期',
    cancelled: '已取消',
    pending: '待处理'
  }
  return texts[status] || status
}

// 获取计划名称
const getPlanName = (plan) => {
  const names = {
    free: '免费版',
    professional: '专业版',
    enterprise: '企业版'
  }
  return names[plan] || plan
}

// 获取活动颜色
const getActivityColor = (type) => {
  const colors = {
    user: 'primary',
    company: 'success',
    subscription: 'warning',
    system: 'info',
    ai: 'secondary'
  }
  return colors[type] || 'primary'
}

// 获取活动图标
const getActivityIcon = (type) => {
  const icons = {
    user: 'mdi-account',
    company: 'mdi-office-building',
    subscription: 'mdi-credit-card',
    system: 'mdi-cog',
    ai: 'mdi-robot'
  }
  return icons[type] || 'mdi-information'
}

onMounted(() => {
  fetchCustomerDetail()
})
</script>
