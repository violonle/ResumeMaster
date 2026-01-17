<template>
  <StandardPage
    title="账号管理"
    subtitle="管理企业账号：姓名、手机号、邮箱、所属公司、角色与认证"
  >
    <template #actions>
      <VBtn
        color="primary"
        prepend-icon="mdi-plus"
        @click="showCreateDialog = true"
      >
        新建账号
      </VBtn>
    </template>

    <!-- 统计卡片 -->
    <VRow class="mb-6">
      <VCol
        cols="12"
        md="3"
        sm="6"
      >
        <VCard class="h-100">
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded="lg"
              color="primary"
              variant="tonal"
              size="48"
              class="me-4"
            >
              <VIcon
                icon="mdi-account-group"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">
                {{ customerStore.totalItems }}
              </div>
              <div class="text-caption text-medium-emphasis">
                总账号数
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="3"
        sm="6"
      >
        <VCard class="h-100">
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded="lg"
              color="success"
              variant="tonal"
              size="48"
              class="me-4"
            >
              <VIcon
                icon="mdi-check-circle"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">
                {{ activeAccounts }}
              </div>
              <div class="text-caption text-medium-emphasis">
                启用账号
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="3"
        sm="6"
      >
        <VCard class="h-100">
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded="lg"
              color="warning"
              variant="tonal"
              size="48"
              class="me-4"
            >
              <VIcon
                icon="mdi-clock-outline"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">
                {{ verifiedAccounts }}
              </div>
              <div class="text-caption text-medium-emphasis">
                已认证
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="3"
        sm="6"
      >
        <VCard class="h-100">
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded="lg"
              color="error"
              variant="tonal"
              size="48"
              class="me-4"
            >
              <VIcon
                icon="mdi-block-helper"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">
                {{ unverifiedAccounts }}
              </div>
              <div class="text-caption text-medium-emphasis">
                未认证
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 搜索和筛选 -->
    <VCard
      class="mb-6"
      elevation="0"
      border
    >
      <VCardText class="pa-4">
        <VRow
          dense
          align="center"
        >
          <VCol
            cols="12"
            md="4"
          >
            <VTextField
              v-model="searchQuery"
              label="搜索姓名、邮箱或手机号"
              prepend-inner-icon="mdi-magnify"
              density="compact"
              variant="outlined"
              hide-details
              clearable
              @update:model-value="handleSearch"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <VSelect
              v-model="roleFilter"
              :items="roleOptions"
              label="角色筛选"
              density="compact"
              variant="outlined"
              hide-details
              clearable
              @update:model-value="handleFilter"
            />
          </VCol>
          <VSpacer />
          <VCol cols="auto">
            <VBtn
              color="primary"
              variant="tonal"
              prepend-icon="mdi-refresh"
              :loading="customerStore.loading"
              @click="handleRefresh"
            >
              刷新
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- 客户列表 -->
    <VCard
      elevation="0"
      border
    >
      <VCardText class="pa-0">
        <VDataTable
          v-model:page="currentPage"
          :headers="headers"
          :items="customerStore.customers"
          :loading="customerStore.loading"
          :items-per-page="customerStore.filters.itemsPerPage"
          :items-length="customerStore.totalItems"
          class="clean-table"
          hover
          @update:page="handlePageChange"
          @update:items-per-page="handleItemsPerPageChange"
        >
          <!-- 状态列 -->
          <template #item.is_active="{ item }">
            <VChip
              :color="item.is_active ? 'success' : 'error'"
              size="small"
              variant="tonal"
              label
            >
              {{ item.is_active ? '启用' : '停用' }}
            </VChip>
          </template>
          <template #item.phone_verified="{ item }">
            <VChip
              :color="item.phone_verified ? 'success' : 'warning'"
              size="small"
              variant="tonal"
              label
            >
              {{ item.phone_verified ? '已认证' : '未认证' }}
            </VChip>
          </template>
          
          <!-- 角色列 -->
          <template #item.role="{ item }">
            <VChip
              size="small"
              variant="outlined"
              class="text-caption"
            >
              {{ getRoleText(item.role) }}
            </VChip>
          </template>

          <!-- 操作列 -->
          <template #item.actions="{ item }">
            <div class="d-flex justify-end">
              <VBtn
                icon
                size="small"
                color="info"
                variant="text"
                class="me-1"
                @click="viewCustomer(item)"
              >
                <VIcon
                  icon="mdi-eye-outline"
                  size="20"
                />
                <VTooltip
                  activator="parent"
                  location="top"
                >
                  查看详情
                </VTooltip>
              </VBtn>
              
              <VBtn
                icon
                size="small"
                color="primary"
                variant="text"
                class="me-1"
                @click="editCustomer(item)"
              >
                <VIcon
                  icon="mdi-pencil-outline"
                  size="20"
                />
                <VTooltip
                  activator="parent"
                  location="top"
                >
                  编辑账号
                </VTooltip>
              </VBtn>
              
              <VBtn
                icon
                size="small"
                color="error"
                variant="text"
                @click="confirmDelete(item)"
              >
                <VIcon
                  icon="mdi-trash-can-outline"
                  size="20"
                />
                <VTooltip
                  activator="parent"
                  location="top"
                >
                  删除账号
                </VTooltip>
              </VBtn>
            </div>
          </template>

          <!-- 空状态 -->
          <template #no-data>
            <div class="text-center pa-8">
              <VIcon
                icon="mdi-account-off"
                size="48"
                class="mb-4 text-medium-emphasis"
              />
              <div class="text-h6 text-medium-emphasis">
                暂无账号数据
              </div>
              <div class="text-caption text-medium-emphasis mt-2">
                点击右上角"新建账号"按钮添加第一个账号
              </div>
            </div>
          </template>
        </VDataTable>
      </VCardText>
    </VCard>

    <!-- 创建/编辑对话框 -->
    <VDialog
      v-model="showCreateDialog"
      max-width="600px"
      persistent
    >
      <VCard>
        <VCardTitle class="d-flex align-center justify-space-between pa-4">
          <span class="text-h6">{{ editingAccount ? '编辑账号' : '新建账号' }}</span>
          <VBtn
            icon="mdi-close"
            variant="text"
            size="small"
            @click="closeDialog"
          />
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VForm
            ref="formRef"
            @submit.prevent="handleSubmit"
          >
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="accountForm.username"
                  label="姓名"
                  :rules="[v => !!v || '请输入姓名']"
                  variant="outlined"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="accountForm.email"
                  label="邮箱"
                  type="email"
                  :rules="[v => !v || /.+@.+\..+/.test(v) || '邮箱格式不正确']"
                  variant="outlined"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="accountForm.phone"
                  label="手机号"
                  :rules="[v => !!v || '请输入手机号']"
                  variant="outlined"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="accountForm.role"
                  :items="roleOptions"
                  label="角色"
                  :rules="[v => !!v || '请选择角色']"
                  variant="outlined"
                  required
                />
              </VCol>
              <VCol cols="12">
                <VSelect
                  v-model="accountForm.company_id"
                  :items="companyItems"
                  item-title="name"
                  item-value="id"
                  label="所属公司"
                  variant="outlined"
                  clearable
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSwitch
                  v-model="accountForm.is_verified"
                  label="已认证"
                  color="success"
                  inset
                  hide-details
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
            @click="closeDialog"
          >
            取消
          </VBtn>
          <VBtn
            color="primary"
            :loading="saving"
            @click="handleSubmit"
          >
            保存
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 删除确认对话框 -->
    <VDialog
      v-model="showDeleteDialog"
      max-width="400px"
    >
      <VCard>
        <VCardTitle class="pa-4">
          确认删除
        </VCardTitle>
        <VCardText class="pa-4 pt-0">
          确定要删除账号 "{{ deletingAccount?.username }}" 吗？此操作不可恢复。
        </VCardText>
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn
            color="grey-darken-1"
            variant="text"
            @click="showDeleteDialog = false"
          >
            取消
          </VBtn>
          <VBtn
            color="error"
            :loading="deleting"
            @click="handleDelete"
          >
            删除
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCustomerStore } from '@/stores/customer'
import StandardPage from '@/components/StandardPage.vue'

const router = useRouter()
const customerStore = useCustomerStore()

// 搜索和筛选
const searchQuery = ref('')
const roleFilter = ref('')

// 对话框状态
const showCreateDialog = ref(false)
const showDeleteDialog = ref(false)
const saving = ref(false)
const deleting = ref(false)

// 表单数据
const accountForm = reactive({ username:'', email:'', phone:'', role:'HR_STAFF', company_id:null, is_verified:false })
const editingAccount = ref(null)
const deletingAccount = ref(null)
const formRef = ref(null)

// 表格配置
const headers = [
  { title: 'ID', key: 'id', width: '80px', align: 'start' },
  { title: '姓名', key: 'username', align: 'start' },
  { title: '手机号', key: 'phone', align: 'start' },
  { title: '邮箱', key: 'email', align: 'start' },
  { title: '公司', key: 'company_id', align: 'start' },
  { title: '角色', key: 'role', align: 'start' },
  { title: '启用', key: 'is_active', width: '90px', align: 'center' },
  { title: '认证', key: 'phone_verified', width: '90px', align: 'center' },
  { title: '创建时间', key: 'created_at', width: '180px', align: 'end' },
  { title: '操作', key: 'actions', width: '150px', sortable: false, align: 'end' },
]

const roleOptions = [
  { title: '全部', value: '' },
  { title: 'HR经理', value: 'HR_MANAGER' },
  { title: 'HR专员', value: 'HR_STAFF' },
  { title: '管理员', value: 'ADMIN' },
]
const companyItems = ref([])

// 计算属性
const activeAccounts = computed(() => customerStore.customers.filter(c => c.is_active).length)
const verifiedAccounts = computed(() => customerStore.customers.filter(c => c.phone_verified).length)
const unverifiedAccounts = computed(() => customerStore.customers.filter(c => !c.phone_verified).length)

const currentPage = computed({
  get: () => customerStore.filters.page,
  set: (val) => customerStore.filters.page = val
})

// 方法
const getRoleText = (role) => {
  const map = {
    'HR_MANAGER': 'HR经理',
    'HR_STAFF': 'HR专员',
    'ADMIN': '管理员',
    'enterprise': '企业账号',
    'admin': '管理员'
  }
  return map[role] || role
}

const handleSearch = () => {
  customerStore.filters.search = searchQuery.value
  customerStore.fetchCustomers()
}

const handleFilter = () => {
  customerStore.filters.role = roleFilter.value
  customerStore.fetchCustomers()
}

const handleRefresh = () => {
  customerStore.fetchCustomers()
}

const handlePageChange = (page) => {
  customerStore.fetchCustomers({ page })
}

const handleItemsPerPageChange = (itemsPerPage) => {
  customerStore.filters.itemsPerPage = itemsPerPage
  customerStore.fetchCustomers()
}

const viewCustomer = (account) => { router.push(`/customers/${account.id}`) }

const editCustomer = (account) => {
  editingAccount.value = account
  Object.assign(accountForm, {
    username: account.username,
    email: account.email,
    phone: account.phone,
    role: account.role === 'enterprise' ? 'HR_MANAGER' : (account.role === 'admin' ? 'ADMIN' : 'HR_STAFF'),
    company_id: account.company_id || null,
    is_verified: !!account.phone_verified,
  })
  showCreateDialog.value = true
}

const confirmDelete = (account) => {
  deletingAccount.value = account
  showDeleteDialog.value = true
}

const closeDialog = () => {
  showCreateDialog.value = false
  editingAccount.value = null
  Object.assign(accountForm, { username:'', email:'', phone:'', role:'HR_STAFF', company_id:null, is_verified:false })
}

const handleSubmit = async () => {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  saving.value = true
  try {
    if (editingAccount.value) {
      await customerStore.updateCustomer(editingAccount.value.id, accountForm)
    } else {
      await customerStore.createCustomer(accountForm)
    }
    closeDialog()
  } catch (error) {
    console.error('Failed to save customer:', error)
  } finally {
    saving.value = false
  }
}

const handleDelete = async () => {
  if (!deletingAccount.value) return
  
  deleting.value = true
  try {
    await customerStore.deleteCustomer(deletingAccount.value.id)
    showDeleteDialog.value = false
    deletingAccount.value = null
  } catch (error) {
    console.error('Failed to delete customer:', error)
  } finally {
    deleting.value = false
  }
}

// 初始化
onMounted(async () => {
  customerStore.fetchCustomers()
  companyItems.value = await customerStore.fetchCompanies()
})
</script>