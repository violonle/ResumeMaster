<template>
  <StandardPage
    title="企业管理"
    subtitle="管理所有企业客户信息"
  >
    <template #actions>
      <VBtn
        color="primary"
        prepend-icon="mdi-plus"
        @click="showCreateDialog = true"
      >
        新建企业
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
              <VIcon icon="mdi-office-building" size="24" />
            </VAvatar>
            <div>
              <div class="text-h4 font-weight-bold">{{ companyStore.totalItems }}</div>
              <div class="text-caption text-medium-emphasis">总企业数</div>
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
              <VIcon icon="mdi-check-decagram" size="24" />
            </VAvatar>
            <div>
              <div class="text-h4 font-weight-bold">{{ verifiedCompanies }}</div>
              <div class="text-caption text-medium-emphasis">已认证</div>
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
              <VIcon icon="mdi-clock-outline" size="24" />
            </VAvatar>
            <div>
              <div class="text-h4 font-weight-bold">{{ pendingCompanies }}</div>
              <div class="text-caption text-medium-emphasis">待认证</div>
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
              <VIcon icon="mdi-close-circle" size="24" />
            </VAvatar>
            <div>
              <div class="text-h4 font-weight-bold">{{ rejectedCompanies }}</div>
              <div class="text-caption text-medium-emphasis">已拒绝</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 搜索和筛选 -->
    <VCard class="mb-6" elevation="0" border>
      <VCardText class="pa-4">
        <VRow dense align="center">
          <VCol cols="12" md="4">
            <VTextField
              v-model="searchQuery"
              placeholder="搜索企业名称、联系人或邮箱"
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
              v-model="verifiedFilter"
              :items="verifiedOptions"
              label="认证状态"
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
              label="状态"
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
              :loading="companyStore.loading"
            >
              刷新列表
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- 企业列表 -->
    <VCard elevation="0" border>
      <VDataTable
        class="clean-table"
        :headers="headers"
        :items="companyStore.companies"
        :loading="companyStore.loading"
        :items-per-page="companyStore.filters.itemsPerPage"
        :items-length="companyStore.totalItems"
        v-model:page="currentPage"
        @update:page="handlePageChange"
        @update:items-per-page="handleItemsPerPageChange"
        hover
      >
        <!-- 认证状态列 -->
        <template #item.is_verified="{ item }">
          <VChip
            :color="item.is_verified ? 'success' : 'warning'"
            size="small"
            variant="tonal"
            label
          >
            {{ item.is_verified ? '已认证' : '未认证' }}
          </VChip>
        </template>

        <!-- 状态列 -->
        <template #item.status="{ item }">
          <VChip
            :color="getStatusColor(item.status)"
            size="small"
            variant="tonal"
            label
          >
            {{ getStatusText(item.status) }}
          </VChip>
        </template>

        <!-- 创建时间列 -->
        <template #item.created_at="{ item }">
          <div class="text-body-2">{{ formatDate(item.created_at) }}</div>
        </template>

        <!-- 操作列 -->
        <template #item.actions="{ item }">
          <div class="d-flex justify-end">
            <VBtn
              icon
              size="small"
              variant="text"
              color="info"
              class="me-1"
              @click="viewCompany(item)"
            >
              <VIcon icon="mdi-eye-outline" size="20" />
              <VTooltip activator="parent" location="top">查看详情</VTooltip>
            </VBtn>
            
            <VBtn
              v-if="!item.is_verified"
              icon
              size="small"
              variant="text"
              color="success"
              class="me-1"
              @click="openVerifyDialog(item)"
            >
              <VIcon icon="mdi-check-decagram-outline" size="20" />
              <VTooltip activator="parent" location="top">认证审核</VTooltip>
            </VBtn>
            
            <VBtn
              icon
              size="small"
              variant="text"
              color="primary"
              class="me-1"
              @click="editCompany(item)"
            >
              <VIcon icon="mdi-pencil-outline" size="20" />
              <VTooltip activator="parent" location="top">编辑企业</VTooltip>
            </VBtn>
            
            <VBtn
              icon
              size="small"
              variant="text"
              color="error"
              @click="confirmDelete(item)"
            >
              <VIcon icon="mdi-trash-can-outline" size="20" />
              <VTooltip activator="parent" location="top">删除企业</VTooltip>
            </VBtn>
          </div>
        </template>

        <!-- 空状态 -->
        <template #no-data>
          <div class="text-center pa-8">
            <VIcon icon="mdi-office-building-off" size="64" class="mb-4 text-medium-emphasis" />
            <div class="text-h6 text-medium-emphasis">暂无企业数据</div>
            <div class="text-caption text-medium-emphasis mt-2">
              点击右上角"新建企业"按钮添加第一个企业
            </div>
          </div>
        </template>
      </VDataTable>
    </VCard>

    <!-- 创建/编辑对话框 -->
    <VDialog v-model="showCreateDialog" max-width="700px">
      <VCard>
        <VCardTitle class="pa-4">
          <span class="text-h5">{{ editingCompany ? '编辑企业' : '新建企业' }}</span>
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VForm ref="companyForm" @submit.prevent="handleSubmit">
            <VRow>
              <VCol cols="12" md="6">
                <VTextField
                  v-model="companyFormData.name"
                  label="企业名称"
                  :rules="[v => !!v || '请输入企业名称']"
                  required
                  variant="outlined"
                  density="compact"
                />
              </VCol>
              <VCol cols="12" md="6">
                <VSelect 
                  v-model="companyFormData.contact_account_id" 
                  :items="accountItems" 
                  item-title="username" 
                  item-value="id" 
                  label="联系人（账号）" 
                  clearable 
                  variant="outlined"
                  density="compact"
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField 
                  v-model="companyFormData.province" 
                  label="省份" 
                  variant="outlined"
                  density="compact"
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField 
                  v-model="companyFormData.city" 
                  label="地市" 
                  variant="outlined"
                  density="compact"
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField 
                  v-model="companyFormData.district" 
                  label="县市区" 
                  variant="outlined"
                  density="compact"
                />
              </VCol>
              <VCol cols="12" md="6">
                <VSelect
                  v-model="companyFormData.status"
                  :items="statusOptions"
                  label="状态"
                  :rules="[v => !!v || '请选择状态']"
                  required
                  variant="outlined"
                  density="compact"
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="companyFormData.address"
                  label="地址"
                  rows="2"
                  variant="outlined"
                  density="compact"
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField 
                  v-model="companyFormData.code" 
                  label="企业编码（可选）" 
                  variant="outlined"
                  density="compact"
                />
              </VCol>
              <VCol cols="12" md="6">
                <VSwitch 
                  v-model="companyFormData.is_verified" 
                  label="已认证" 
                  color="success"
                  inset 
                />
              </VCol>
              <VCol cols="12">
                <VTextarea 
                  v-model="verificationJson" 
                  label="认证信息（JSON）" 
                  rows="4" 
                  placeholder='例如：{ "license": "913...", "biz_scope": "软件需求..." }' 
                  variant="outlined"
                  density="compact"
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="companyFormData.remark"
                  label="备注"
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
          <VBtn color="grey" variant="text" @click="closeDialog">取消</VBtn>
          <VBtn color="primary" @click="handleSubmit" :loading="saving">保存</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 删除确认对话框 -->
    <VDialog v-model="showDeleteDialog" max-width="400px">
      <VCard>
        <VCardTitle class="pa-4">确认删除</VCardTitle>
        <VCardText class="pa-4">
          确定要删除企业 "{{ deletingCompany?.name }}" 吗？此操作不可恢复。
        </VCardText>
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn color="grey" variant="text" @click="showDeleteDialog = false">取消</VBtn>
          <VBtn color="error" @click="handleDelete" :loading="deleting">删除</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 认证信息对话框 -->
    <VDialog v-model="showVerifyDialog" max-width="700px">
      <VCard>
        <VCardTitle class="pa-4">企业认证</VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VForm ref="verifyForm" @submit.prevent="submitVerify">
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
                  label="经营范围 / 认证说明（与pages软件需求对应）" 
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
          <VBtn color="grey" variant="text" @click="showVerifyDialog = false">取消</VBtn>
          <VBtn color="primary" @click="submitVerify" :loading="verifying">提交认证</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCompanyStore } from '@/stores/company'
import StandardPage from '@/components/StandardPage.vue'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const router = useRouter()
const companyStore = useCompanyStore()

// 搜索和筛选
const searchQuery = ref('')
const verifiedFilter = ref('')
const statusFilter = ref('')

// 对话框状态
const showCreateDialog = ref(false)
const showDeleteDialog = ref(false)
const saving = ref(false)
const deleting = ref(false)

// 表单数据
const companyForm = ref()
const editingCompany = ref(null)
const deletingCompany = ref(null)
const showVerifyDialog = ref(false)
const verifyForm = ref()
const verifying = ref(false)
const verifyTarget = ref(null)
const verifyFormData = reactive({ license:'', legal_person:'', credit_code:'', biz_scope:'' })
const verificationJson = ref('')

const companyFormData = reactive({
  name: '',
  address: '',
  province: '',
  city: '',
  district: '',
  contact_account_id: null,
  status: 'active',
  code: '',
  is_verified: false,
  remark: ''
})
const accountItems = ref([])

// 表格配置
const headers = [
  { title: 'ID', key: 'id', width: '80px' },
  { title: '企业名称', key: 'name' },
  { title: '联系人账号', key: 'contact_account_id' },
  { title: '省份', key: 'province' },
  { title: '地市', key: 'city' },
  { title: '县市区', key: 'district' },
  { title: '认证', key: 'is_verified', width: '100px' },
  { title: '状态', key: 'status', width: '100px' },
  { title: '创建时间', key: 'created_at', width: '180px' },
  { title: '操作', key: 'actions', width: '200px', sortable: false },
]

const verifiedOptions = [
  { title: '全部', value: '' },
  { title: '已认证', value: 'true' },
  { title: '未认证', value: 'false' },
]

const statusOptions = [
  { title: '全部', value: '' },
  { title: '活跃', value: 'active' },
  { title: '禁用', value: 'inactive' },
]

// 计算属性
const verifiedCompanies = computed(() => companyStore.companies.filter(c => c.is_verified).length)
const pendingCompanies = computed(() => companyStore.companies.filter(c => !c.is_verified).length)
const rejectedCompanies = computed(() => 0)

const currentPage = computed({
  get: () => companyStore.filters.page,
  set: (val) => companyStore.filters.page = val
})

// 方法
const formatDate = (date) => {
  if (!date) return '-'
  return format(new Date(date), 'yyyy-MM-dd HH:mm', { locale: zhCN })
}

const getStatusColor = (status) => {
  const colors = {
    active: 'success',
    disabled: 'error',
    inactive: 'grey'
  }
  return colors[status] || 'grey'
}

const getStatusText = (status) => ({ active:'活跃', inactive:'禁用' }[status] || status)

const handleSearch = () => {
  companyStore.filters.search = searchQuery.value
  companyStore.fetchCompanies()
}

const handleFilter = () => {
  companyStore.filters.verified = verifiedFilter.value
  companyStore.filters.status = statusFilter.value
  companyStore.fetchCompanies()
}

const handleRefresh = () => {
  companyStore.fetchCompanies()
}

const handlePageChange = (page) => {
  companyStore.fetchCompanies({ page })
}

const handleItemsPerPageChange = (itemsPerPage) => {
  companyStore.filters.itemsPerPage = itemsPerPage
  companyStore.fetchCompanies()
}

const viewCompany = (company) => {
  router.push(`/companies/${company.id}`)
}

const openVerifyDialog = (company) => { verifyTarget.value = company; showVerifyDialog.value = true }
const submitVerify = async () => {
  verifying.value = true
  try {
    await companyStore.verifyCompany(verifyTarget.value.id, { verification_info: { ...verifyFormData } })
    showVerifyDialog.value = false
    Object.assign(verifyFormData, { license:'', legal_person:'', credit_code:'', biz_scope:'' })
  } catch (error) { console.error('Failed to verify company:', error) }
  finally { verifying.value = false }
}

const editCompany = (company) => {
  editingCompany.value = company
  Object.assign(companyFormData, {
    name: company.name,
    address: company.address || '',
    province: company.province || '',
    city: company.city || '',
    district: company.district || '',
    contact_account_id: company.contact_account_id || null,
    status: company.status,
    code: company.code || '',
    is_verified: !!company.is_verified,
    remark: company.remark || ''
  })
  showCreateDialog.value = true
}

const confirmDelete = (company) => {
  deletingCompany.value = company
  showDeleteDialog.value = true
}

const closeDialog = () => {
  showCreateDialog.value = false
  editingCompany.value = null
  Object.assign(companyFormData, { 
    name:'', 
    address:'', 
    province:'', 
    city:'', 
    district:'', 
    contact_account_id:null, 
    status:'active', 
    code:'', 
    is_verified:false,
    remark: '' 
  })
}

const handleSubmit = async () => {
  const { valid } = await companyForm.value.validate()
  if (!valid) return

  saving.value = true
  try {
    if (editingCompany.value) {
      await companyStore.updateCompany(editingCompany.value.id, companyFormData)
      const json = (verificationJson.value||'').trim()
      if (json) {
        try {
          const parsed = JSON.parse(json)
          await companyStore.verifyCompany(editingCompany.value.id, { verification_info: parsed })
        } catch (e) {
          console.error('Invalid verification JSON:', e)
        }
      }
    } else {
      await companyStore.createCompany(companyFormData)
    }
    closeDialog()
    await companyStore.fetchCompanies()
  } catch (error) {
    console.error('Failed to save company:', error)
  } finally {
    saving.value = false
  }
}

const handleDelete = async () => {
  if (!deletingCompany.value) return
  
  deleting.value = true
  try {
    await companyStore.deleteCompany(deletingCompany.value.id)
    showDeleteDialog.value = false
    deletingCompany.value = null
    await companyStore.fetchCompanies()
  } catch (error) {
    console.error('Failed to delete company:', error)
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  await companyStore.fetchCompanies()
  // Fetch account items for dropdown - placeholder
  // accountItems.value = await userStore.fetchUsers() 
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
