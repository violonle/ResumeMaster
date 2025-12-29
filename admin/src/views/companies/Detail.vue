<template>
  <StandardPage
    title="企业详情"
    subtitle="查看和管理企业详细信息"
    show-back
    @back="goBack"
  >
    <template #actions>
      <div class="d-flex ga-2">
        <VBtn
          v-if="company?.verified === false"
          color="success"
          prepend-icon="mdi-check-circle"
          @click="openVerifyDialog"
        >
          认证企业
        </VBtn>
        <VBtn
          color="primary"
          prepend-icon="mdi-pencil"
          @click="openEditDialog"
        >
          编辑企业
        </VBtn>
      </div>
    </template>

    <VRow>
      <!-- Basic Info -->
      <VCol cols="12" md="8">
        <VCard>
          <VCardTitle class="d-flex align-center pa-4">
            <VIcon icon="mdi-office-building" class="me-2" color="primary" />
            <span class="font-weight-bold">基本信息</span>
            <VSpacer />
            <VChip
              :color="getVerifiedColor(company?.verified)"
              size="small"
              class="me-2"
              variant="tonal"
            >
              {{ getVerifiedText(company?.verified) }}
            </VChip>
            <VChip
              :color="getStatusColor(company?.status)"
              size="small"
              variant="tonal"
            >
              {{ getStatusText(company?.status) }}
            </VChip>
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-4">
            <VRow>
              <VCol cols="12" md="6">
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">企业名称</div>
                  <div class="text-h6 font-weight-bold">{{ company?.name || '-' }}</div>
                </div>
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">联系人</div>
                  <div class="text-body-1">{{ company?.contactPerson || '-' }}</div>
                </div>
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">联系电话</div>
                  <div class="text-body-1">{{ company?.contactPhone || '-' }}</div>
                </div>
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">企业邮箱</div>
                  <div class="text-body-1">{{ company?.email || '-' }}</div>
                </div>
              </VCol>
              <VCol cols="12" md="6">
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">企业规模</div>
                  <div class="text-body-1">{{ getCompanySizeText(company?.companySize) || '-' }}</div>
                </div>
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">行业类型</div>
                  <div class="text-body-1">{{ company?.industry || '-' }}</div>
                </div>
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">注册时间</div>
                  <div class="text-body-1">{{ formatDate(company?.createdAt) }}</div>
                </div>
                <div class="mb-4">
                  <div class="text-caption text-medium-emphasis mb-1">认证时间</div>
                  <div class="text-body-1">{{ formatDate(company?.verifiedAt) || '未认证' }}</div>
                </div>
              </VCol>
            </VRow>
            <div class="mb-4" v-if="company?.address">
              <div class="text-caption text-medium-emphasis mb-1">企业地址</div>
              <div class="text-body-1">{{ company.address }}</div>
            </div>
            <div class="mb-4" v-if="company?.description">
              <div class="text-caption text-medium-emphasis mb-1">企业简介</div>
              <div class="text-body-1">{{ company.description }}</div>
            </div>
            <div class="mb-0" v-if="company?.remark">
              <div class="text-caption text-medium-emphasis mb-1">备注</div>
              <div class="text-body-1">{{ company.remark }}</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Stats -->
      <VCol cols="12" md="4">
        <VCard class="h-100">
          <VCardTitle class="d-flex align-center pa-4">
            <VIcon icon="mdi-chart-pie" class="me-2" color="primary" />
            <span class="font-weight-bold">统计信息</span>
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-4">
            <VRow>
              <VCol cols="6" class="text-center">
                <div class="text-h4 text-primary font-weight-bold mb-1">{{ companyStats?.totalEmployees || 0 }}</div>
                <div class="text-caption text-medium-emphasis">员工数量</div>
              </VCol>
              <VCol cols="6" class="text-center">
                <div class="text-h4 text-success font-weight-bold mb-1">{{ companyStats?.totalResumes || 0 }}</div>
                <div class="text-caption text-medium-emphasis">总简历数</div>
              </VCol>
              <VCol cols="6" class="text-center mt-4">
                <div class="text-h4 text-info font-weight-bold mb-1">{{ companyStats?.totalJobs || 0 }}</div>
                <div class="text-caption text-medium-emphasis">总职位数</div>
              </VCol>
              <VCol cols="6" class="text-center mt-4">
                <div class="text-h4 text-warning font-weight-bold mb-1">{{ companyStats?.activeSubscriptions || 0 }}</div>
                <div class="text-caption text-medium-emphasis">活跃订阅</div>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Team Members -->
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center pa-4">
            <VIcon icon="mdi-account-multiple" class="me-2" color="primary" />
            <span class="font-weight-bold">团队成员</span>
            <VSpacer />
            <VBtn
              color="primary"
              size="small"
              prepend-icon="mdi-plus"
              @click="openMemberDialog"
            >
              添加成员
            </VBtn>
          </VCardTitle>
          <VDivider />
          <VDataTable
            :headers="memberHeaders"
            :items="companyMembers"
            :loading="loading"
            item-value="id"
            class="clean-table"
            hover
          >
            <template #item.role="{ item }">
              <VChip
                :color="getRoleColor(item.role)"
                size="small"
                variant="tonal"
              >
                {{ getRoleText(item.role) }}
              </VChip>
            </template>
            <template #item.status="{ item }">
              <VChip
                :color="getMemberStatusColor(item.status)"
                size="small"
                variant="tonal"
              >
                {{ getMemberStatusText(item.status) }}
              </VChip>
            </template>
            <template #item.joinedAt="{ item }">
              <div class="text-body-2">
                {{ formatDate(item.joinedAt) }}
              </div>
            </template>
            <template #item.actions="{ item }">
              <div class="d-flex ga-1">
                <VTooltip text="编辑成员" location="top">
                  <template #activator="{ props }">
                    <VBtn
                      v-bind="props"
                      icon="mdi-pencil"
                      size="x-small"
                      variant="text"
                      color="primary"
                      @click="editMember(item)"
                    />
                  </template>
                </VTooltip>
                <VTooltip v-if="item.status === 'active'" text="禁用成员" location="top">
                  <template #activator="{ props }">
                    <VBtn
                      v-bind="props"
                      icon="mdi-block-helper"
                      size="x-small"
                      variant="text"
                      color="error"
                      @click="disableMember(item)"
                    />
                  </template>
                </VTooltip>
                <VTooltip v-if="item.status === 'inactive'" text="启用成员" location="top">
                  <template #activator="{ props }">
                    <VBtn
                      v-bind="props"
                      icon="mdi-check-circle"
                      size="x-small"
                      variant="text"
                      color="success"
                      @click="enableMember(item)"
                    />
                  </template>
                </VTooltip>
              </div>
            </template>
            <template #no-data>
              <div class="text-center pa-8 text-medium-emphasis">
                <VIcon icon="mdi-account-off" size="64" class="mb-4" />
                <div class="text-h6">暂无团队成员</div>
              </div>
            </template>
          </VDataTable>
        </VCard>
      </VCol>

      <!-- Subscriptions -->
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center pa-4">
            <VIcon icon="mdi-credit-card" class="me-2" color="primary" />
            <span class="font-weight-bold">企业订阅</span>
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
            :items="companySubscriptions"
            :loading="loading"
            item-value="id"
            hover
          >
            <template #item.status="{ item }">
              <VChip
                :color="getSubscriptionStatusColor(item.status)"
                size="small"
                variant="tonal"
              >
                {{ getSubscriptionStatusText(item.status) }}
              </VChip>
            </template>
            <template #item.plan="{ item }">
              <div class="text-body-2 font-weight-medium">
                {{ getPlanName(item.plan) }}
              </div>
            </template>
            <template #item.amount="{ item }">
              <div class="text-body-2 font-family-monospace">
                ¥{{ item.amount }}
              </div>
            </template>
            <template #item.startDate="{ item }">
              <div class="text-body-2">
                {{ formatDate(item.startDate) }}
              </div>
            </template>
            <template #item.endDate="{ item }">
              <div class="text-body-2">
                {{ formatDate(item.endDate) }}
              </div>
            </template>
            <template #item.actions="{ item }">
              <div class="d-flex ga-1">
                <VTooltip text="编辑订阅" location="top">
                  <template #activator="{ props }">
                    <VBtn
                      v-bind="props"
                      icon="mdi-pencil"
                      size="x-small"
                      variant="text"
                      color="primary"
                      @click="editSubscription(item)"
                    />
                  </template>
                </VTooltip>
                <VTooltip text="取消订阅" location="top">
                  <template #activator="{ props }">
                    <VBtn
                      v-bind="props"
                      icon="mdi-cancel"
                      size="x-small"
                      variant="text"
                      color="error"
                      @click="cancelSubscription(item)"
                    />
                  </template>
                </VTooltip>
              </div>
            </template>
            <template #no-data>
              <div class="text-center pa-8 text-medium-emphasis">
                <VIcon icon="mdi-credit-card-off" size="64" class="mb-4" />
                <div class="text-h6">暂无订阅记录</div>
              </div>
            </template>
          </VDataTable>
        </VCard>
      </VCol>

      <!-- Recent Activities -->
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center pa-4">
            <VIcon icon="mdi-history" class="me-2" color="primary" />
            <span class="font-weight-bold">最近活动</span>
          </VCardTitle>
          <VDivider />
          <VList lines="two" class="pa-2">
            <template v-for="(activity, index) in recentActivities" :key="activity.id">
              <VListItem class="rounded-lg mb-1">
                <template #prepend>
                  <VAvatar
                    size="40"
                    :color="getActivityColor(activity.type)"
                    variant="tonal"
                  >
                    <VIcon :icon="getActivityIcon(activity.type)" />
                  </VAvatar>
                </template>
                
                <VListItemTitle class="font-weight-medium">{{ activity.title }}</VListItemTitle>
                <VListItemSubtitle>
                  <div class="text-body-2">{{ activity.description }}</div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    {{ formatTime(activity.createdAt) }}
                  </div>
                </VListItemSubtitle>
              </VListItem>
              <VDivider v-if="index < recentActivities.length - 1" class="my-1" />
            </template>
            <div v-if="!recentActivities.length" class="text-center pa-8 text-medium-emphasis">
              <VIcon icon="mdi-history" size="64" class="mb-4" />
              <div class="text-h6">暂无活动记录</div>
            </div>
          </VList>
        </VCard>
      </VCol>
    </VRow>

    <!-- Dialogs -->
    <!-- Edit Company Dialog -->
    <VDialog v-model="editDialog" max-width="700">
      <VCard>
        <VCardTitle class="pa-4">编辑企业信息</VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VForm ref="editForm" v-model="editFormValid">
            <VRow>
              <VCol cols="12" md="8">
                <VTextField
                  v-model="editFormData.name"
                  label="企业名称"
                  variant="outlined"
                  density="compact"
                  :rules="[v => !!v || '请输入企业名称']"
                  required
                />
              </VCol>
              <VCol cols="12" md="4">
                <VSelect
                  v-model="editFormData.companySize"
                  label="企业规模"
                  :items="companySizeOptions"
                  item-title="text"
                  item-value="value"
                  variant="outlined"
                  density="compact"
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField
                  v-model="editFormData.contactPerson"
                  label="联系人"
                  variant="outlined"
                  density="compact"
                  :rules="[v => !!v || '请输入联系人']"
                  required
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField
                  v-model="editFormData.contactPhone"
                  label="联系电话"
                  variant="outlined"
                  density="compact"
                  :rules="[v => !!v || '请输入联系电话']"
                  required
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField
                  v-model="editFormData.email"
                  label="企业邮箱"
                  type="email"
                  variant="outlined"
                  density="compact"
                  :rules="[v => !!v || '请输入邮箱', v => /.+@.+/.test(v) || '邮箱格式不正确']"
                  required
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField
                  v-model="editFormData.industry"
                  label="行业类型"
                  variant="outlined"
                  density="compact"
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="editFormData.address"
                  label="企业地址"
                  variant="outlined"
                  density="compact"
                  rows="2"
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="editFormData.description"
                  label="企业简介"
                  variant="outlined"
                  density="compact"
                  rows="3"
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="editFormData.remark"
                  label="备注"
                  variant="outlined"
                  density="compact"
                  rows="2"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn variant="text" @click="editDialog = false">取消</VBtn>
          <VBtn color="primary" @click="saveEdit" :loading="loading">保存</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Verify Company Dialog -->
    <VDialog v-model="showVerifyDialog" max-width="700">
      <VCard>
        <VCardTitle class="pa-4">企业认证</VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VForm ref="verifyForm" v-model="verifyFormValid">
            <VRow>
              <VCol cols="12" md="6">
                <VTextField 
                  v-model="verifyFormData.license" 
                  label="营业执照号" 
                  variant="outlined"
                  density="compact"
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField 
                  v-model="verifyFormData.legal_person" 
                  label="法人代表" 
                  variant="outlined"
                  density="compact"
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField 
                  v-model="verifyFormData.credit_code" 
                  label="统一社会信用代码" 
                  variant="outlined"
                  density="compact"
                />
              </VCol>
              <VCol cols="12">
                <VTextarea 
                  v-model="verifyFormData.biz_scope" 
                  label="经营范围 / 认证说明" 
                  rows="3" 
                  variant="outlined"
                  density="compact"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn variant="text" @click="showVerifyDialog = false">取消</VBtn>
          <VBtn color="primary" @click="submitVerify" :loading="verifying">提交认证</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Add Member Dialog -->
    <VDialog v-model="memberDialog" max-width="500">
      <VCard>
        <VCardTitle class="pa-4">添加团队成员</VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VForm ref="memberForm" v-model="memberFormValid">
            <VRow>
              <VCol cols="12">
                <VTextField
                  v-model="memberFormData.name"
                  label="姓名"
                  variant="outlined"
                  density="compact"
                  :rules="[v => !!v || '请输入姓名']"
                  required
                />
              </VCol>
              <VCol cols="12">
                <VTextField
                  v-model="memberFormData.email"
                  label="邮箱"
                  type="email"
                  variant="outlined"
                  density="compact"
                  :rules="[v => !!v || '请输入邮箱', v => /.+@.+/.test(v) || '邮箱格式不正确']"
                  required
                />
              </VCol>
              <VCol cols="12">
                <VSelect
                  v-model="memberFormData.role"
                  label="角色"
                  :items="roleOptions"
                  item-title="text"
                  item-value="value"
                  variant="outlined"
                  density="compact"
                  :rules="[v => !!v || '请选择角色']"
                  required
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn variant="text" @click="memberDialog = false">取消</VBtn>
          <VBtn color="primary" @click="addMember" :loading="loading">添加</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- New Subscription Dialog -->
    <VDialog v-model="subscriptionDialog" max-width="500">
      <VCard>
        <VCardTitle class="pa-4">新建企业订阅</VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VForm ref="subscriptionForm" v-model="subscriptionFormValid">
            <VRow>
              <VCol cols="12">
                <VSelect
                  v-model="subscriptionFormData.plan"
                  label="订阅计划"
                  :items="enterprisePlanOptions"
                  item-title="text"
                  item-value="value"
                  variant="outlined"
                  density="compact"
                  :rules="[v => !!v || '请选择订阅计划']"
                  required
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField
                  v-model="subscriptionFormData.amount"
                  label="金额"
                  type="number"
                  prefix="¥"
                  variant="outlined"
                  density="compact"
                  :rules="[v => !!v || '请输入金额', v => v > 0 || '金额必须大于0']"
                  required
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField
                  v-model="subscriptionFormData.duration"
                  label="时长（月）"
                  type="number"
                  variant="outlined"
                  density="compact"
                  :rules="[v => !!v || '请输入时长', v => v > 0 || '时长必须大于0']"
                  required
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="subscriptionFormData.remark"
                  label="备注"
                  variant="outlined"
                  density="compact"
                  rows="2"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn variant="text" @click="subscriptionDialog = false">取消</VBtn>
          <VBtn color="primary" @click="createSubscription" :loading="loading">创建</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCompanyStore } from '@/stores/company'
import { useUserStore } from '@/stores/user'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import StandardPage from '@/components/StandardPage.vue'

const route = useRoute()
const router = useRouter()
const companyStore = useCompanyStore()
const userStore = useUserStore()

const loading = ref(false)

// 企业数据
const company = computed(() => companyStore.currentCompany)
const companyStats = ref({
  totalEmployees: 25,
  totalResumes: 50,
  totalJobs: 12,
  activeSubscriptions: 1
})

// 团队成员数据（模拟数据）
const companyMembers = ref([
  {
    id: 1,
    name: '张三',
    email: 'zhangsan@company.com',
    role: 'admin',
    status: 'active',
    joinedAt: '2024-01-15T10:30:00Z'
  },
  {
    id: 2,
    name: '李四',
    email: 'lisi@company.com',
    role: 'member',
    status: 'active',
    joinedAt: '2024-01-20T14:20:00Z'
  },
  {
    id: 3,
    name: '王五',
    email: 'wangwu@company.com',
    role: 'member',
    status: 'inactive',
    joinedAt: '2024-01-25T16:45:00Z'
  }
])

// 企业订阅数据（模拟数据）
const companySubscriptions = ref([
  {
    id: 1,
    plan: 'enterprise',
    status: 'active',
    amount: 2999,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    autoRenew: true,
    seats: 50
  }
])

// 最近活动（模拟数据）
const recentActivities = ref([
  {
    id: 1,
    type: 'company',
    title: '企业认证通过',
    description: '企业信息审核通过，认证成功',
    createdAt: '2024-01-15T10:30:00Z'
  },
  {
    id: 2,
    type: 'member',
    title: '添加团队成员',
    description: '新增团队成员张三',
    createdAt: '2024-01-10T14:20:00Z'
  },
  {
    id: 3,
    type: 'subscription',
    title: '订阅续费',
    description: '企业版订阅续费成功',
    createdAt: '2024-01-08T16:45:00Z'
  }
])

// 表格头
const memberHeaders = [
  { title: '姓名', key: 'name', sortable: true },
  { title: '邮箱', key: 'email', sortable: true },
  { title: '角色', key: 'role', sortable: true },
  { title: '状态', key: 'status', sortable: true },
  { title: '加入时间', key: 'joinedAt', sortable: true },
  { title: '操作', key: 'actions', sortable: false }
]

const subscriptionHeaders = [
  { title: '计划', key: 'plan', sortable: true },
  { title: '状态', key: 'status', sortable: true },
  { title: '金额', key: 'amount', sortable: true },
  { title: '座位数', key: 'seats', sortable: true },
  { title: '开始时间', key: 'startDate', sortable: true },
  { title: '结束时间', key: 'endDate', sortable: true },
  { title: '操作', key: 'actions', sortable: false }
]

// 选项配置
const companySizeOptions = [
  { text: '1-10人', value: '1-10' },
  { text: '11-50人', value: '11-50' },
  { text: '51-200人', value: '51-200' },
  { text: '201-500人', value: '201-500' },
  { text: '500人以上', value: '500+' }
]

const roleOptions = [
  { text: '管理员', value: 'admin' },
  { text: '成员', value: 'member' }
]

const enterprisePlanOptions = [
  { text: '企业版-基础', value: 'enterprise_basic' },
  { text: '企业版-标准', value: 'enterprise_standard' },
  { text: '企业版-高级', value: 'enterprise_premium' }
]

// 编辑对话框
const editDialog = ref(false)
const editFormValid = ref(false)
const editFormData = ref({
  name: '',
  contactPerson: '',
  contactPhone: '',
  email: '',
  companySize: '',
  industry: '',
  address: '',
  description: '',
  remark: ''
})

// 添加成员对话框
const memberDialog = ref(false)
const memberFormValid = ref(false)
const memberFormData = ref({
  name: '',
  email: '',
  role: 'member'
})

// 新建订阅对话框
const subscriptionDialog = ref(false)
const subscriptionFormValid = ref(false)
const subscriptionFormData = ref({
  plan: '',
  amount: 0,
  duration: 12,
  remark: ''
})

// 获取企业详情
const fetchCompanyDetail = async () => {
  loading.value = true
  try {
    await companyStore.fetchCompanyDetail(route.params.id)
    // 初始化编辑表单数据
    if (company.value) {
      editFormData.value = {
        name: company.value.name,
        contactPerson: company.value.contactPerson,
        contactPhone: company.value.contactPhone,
        email: company.value.email,
        companySize: company.value.companySize,
        industry: company.value.industry || '',
        address: company.value.address || '',
        description: company.value.description || '',
        remark: company.value.remark || ''
      }
    }
  } catch (error) {
    console.error('Failed to fetch company detail:', error)
  } finally {
    loading.value = false
  }
}

// 返回上一页
const goBack = () => {
  router.push('/companies')
}

// 认证企业
const showVerifyDialog = ref(false)
const verifyForm = ref(null)
const verifyFormValid = ref(false)
const verifyFormData = ref({ license:'', legal_person:'', credit_code:'', biz_scope:'' })
const verifying = ref(false)

const openVerifyDialog = () => { showVerifyDialog.value = true }

const submitVerify = async () => {
  verifying.value = true
  try {
    await companyStore.verifyCompany(route.params.id, { verification_info: { ...verifyFormData.value } })
    showVerifyDialog.value = false
    await fetchCompanyDetail()
    verifyFormData.value = { license:'', legal_person:'', credit_code:'', biz_scope:'' }
  } catch (error) {
    console.error('Failed to verify company:', error)
  } finally {
    verifying.value = false
  }
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
    await companyStore.updateCompany(route.params.id, editFormData.value)
    await fetchCompanyDetail()
    editDialog.value = false
  } catch (error) {
    console.error('Failed to update company:', error)
  } finally {
    loading.value = false
  }
}

// 打开添加成员对话框
const openMemberDialog = () => {
  memberFormData.value = {
    name: '',
    email: '',
    role: 'member'
  }
  memberDialog.value = true
}

// 添加成员
const addMember = async () => {
  if (!memberFormValid.value) return
  
  loading.value = true
  try {
    console.log('Adding member:', memberFormData.value)
    memberDialog.value = false
  } catch (error) {
    console.error('Failed to add member:', error)
  } finally {
    loading.value = false
  }
}

// 编辑成员
const editMember = (member) => {
  console.log('Edit member:', member)
}

// 禁用成员
const disableMember = (member) => {
  console.log('Disable member:', member)
}

// 启用成员
const enableMember = (member) => {
  console.log('Enable member:', member)
}

// 打开新建订阅对话框
const openSubscriptionDialog = () => {
  subscriptionFormData.value = {
    plan: 'enterprise_standard',
    amount: 2999,
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

// 获取认证状态颜色
const getVerifiedColor = (verified) => {
  const colors = {
    true: 'success',
    false: 'error',
    null: 'default'
  }
  return colors[verified] || 'default'
}

// 获取认证状态文本
const getVerifiedText = (verified) => {
  const texts = {
    true: '已认证',
    false: '未认证',
    null: '待审核'
  }
  return texts[verified] || '未知'
}

// 获取状态颜色
const getStatusColor = (status) => {
  const colors = {
    active: 'success',
    inactive: 'error',
    suspended: 'warning'
  }
  return colors[status] || 'default'
}

// 获取状态文本
const getStatusText = (status) => {
  const texts = {
    active: '活跃',
    inactive: '停用',
    suspended: '暂停'
  }
  return texts[status] || status
}

// 获取企业规模文本
const getCompanySizeText = (size) => {
  const texts = {
    '1-10': '1-10人',
    '11-50': '11-50人',
    '51-200': '51-200人',
    '201-500': '201-500人',
    '500+': '500人以上'
  }
  return texts[size] || size
}

// 获取角色颜色
const getRoleColor = (role) => {
  const colors = {
    admin: 'primary',
    member: 'default'
  }
  return colors[role] || 'default'
}

// 获取角色文本
const getRoleText = (role) => {
  const texts = {
    admin: '管理员',
    member: '成员'
  }
  return texts[role] || role
}

// 获取成员状态颜色
const getMemberStatusColor = (status) => {
  const colors = {
    active: 'success',
    inactive: 'error'
  }
  return colors[status] || 'default'
}

// 获取成员状态文本
const getMemberStatusText = (status) => {
  const texts = {
    active: '活跃',
    inactive: '停用'
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
    enterprise_basic: '企业版-基础',
    enterprise_standard: '企业版-标准',
    enterprise_premium: '企业版-高级'
  }
  return names[plan] || plan
}

// 获取活动颜色
const getActivityColor = (type) => {
  const colors = {
    company: 'primary',
    member: 'success',
    subscription: 'warning',
    system: 'info'
  }
  return colors[type] || 'primary'
}

// 获取活动图标
const getActivityIcon = (type) => {
  const icons = {
    company: 'mdi-office-building',
    member: 'mdi-account',
    subscription: 'mdi-credit-card',
    system: 'mdi-cog'
  }
  return icons[type] || 'mdi-information'
}

onMounted(() => {
  fetchCompanyDetail()
})
</script>
