<template>
  <div>
    <!-- 页面标题和操作区 -->
    <VRow class="mb-6">
      <VCol
        cols="12"
        md="6"
      >
        <h1 class="text-h4 font-weight-bold">
          账号管理
        </h1>
        <p class="text-subtitle-1 text-medium-emphasis">
          管理所有使用争湃·简历大师的用户
        </p>
      </VCol>
      <VCol
        cols="12"
        md="6"
        class="text-md-right"
      >
        <VBtn
          color="primary"
          prepend-icon="mdi-plus"
          @click="showCreateDialog = true"
        >
          新建账号
        </VBtn>
      </VCol>
    </VRow>

    <!-- 统计卡片 -->
    <VRow class="mb-6">
      <VCol
        cols="12"
        md="3"
        sm="6"
      >
        <VCard>
          <VCardText class="d-flex align-center">
            <VAvatar
              rounded
              color="primary"
              variant="tonal"
              class="me-4"
            >
              <VIcon
                icon="mdi-account-group"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="text-h4">
                {{ totalCustomers }}
              </div>
              <div class="text-caption text-medium-emphasis">
                总客户数
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
        <VCard>
          <VCardText class="d-flex align-center">
            <VAvatar
              rounded
              color="success"
              variant="tonal"
              class="me-4"
            >
              <VIcon
                icon="mdi-check-circle"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="text-h4">
                {{ activeCustomers }}
              </div>
              <div class="text-caption text-medium-emphasis">
                活跃客户
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
        <VCard>
          <VCardText class="d-flex align-center">
            <VAvatar
              rounded
              color="warning"
              variant="tonal"
              class="me-4"
            >
              <VIcon
                icon="mdi-credit-card"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="text-h4">
                {{ paidCustomers }}
              </div>
              <div class="text-caption text-medium-emphasis">
                付费客户
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
        <VCard>
          <VCardText class="d-flex align-center">
            <VAvatar
              rounded
              color="info"
              variant="tonal"
              class="me-4"
            >
              <VIcon
                icon="mdi-calendar-today"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="text-h4">
                {{ newCustomersThisMonth }}
              </div>
              <div class="text-caption text-medium-emphasis">
                本月新增
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 数据表格 -->
    <VCard>
      <VCardText>
        <!-- 搜索和操作 -->
        <VRow class="mb-4">
          <VCol
            cols="12"
            md="6"
          >
            <VTextField
              v-model="search"
              prepend-inner-icon="mdi-magnify"
              label="搜索客户"
              single-line
              hide-details
              dense
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
            class="text-md-right"
          >
            <VBtn
              color="secondary"
              variant="tonal"
              prepend-icon="mdi-download"
              class="me-2"
              @click="handleExport"
            >
              导出
            </VBtn>
            <VBtn
              color="primary"
              prepend-icon="mdi-refresh"
              @click="handleRefresh"
            >
              刷新
            </VBtn>
          </VCol>
        </VRow>

        <!-- 客户表格 -->
        <VDataTable
          :headers="headers"
          :items="customers"
          :search="search"
          :loading="loading"
          item-key="id"
          class="elevation-0"
          hover
        >
          <!-- 客户信息列 -->
          <template #item.customer="{ item }">
            <div class="d-flex align-center">
              <VAvatar
                size="40"
                color="primary"
                class="me-3"
              >
                <span class="text-h6">{{ item.name.charAt(0) }}</span>
              </VAvatar>
              <div>
                <div class="text-body-1 font-weight-medium">
                  {{ item.name }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ item.email }}
                </div>
              </div>
            </div>
          </template>

          <!-- 状态列 -->
          <template #item.status="{ item }">
            <VChip
              :color="getStatusColor(item.status)"
              size="small"
              label
            >
              {{ getStatusText(item.status) }}
            </VChip>
          </template>

          <!-- 注册时间列 -->
          <template #item.createdAt="{ item }">
            <div class="text-caption">
              {{ formatDate(item.createdAt) }}
            </div>
          </template>

          <!-- 操作列 -->
          <template #item.actions="{ item }">
            <div class="d-flex gap-2">
              <VBtn
                icon
                size="small"
                color="info"
                variant="text"
                @click="viewCustomer(item)"
              >
                <VIcon icon="mdi-eye" />
              </VBtn>
              <VBtn
                icon
                size="small"
                color="warning"
                variant="text"
                @click="editCustomer(item)"
              >
                <VIcon icon="mdi-pencil" />
              </VBtn>
              <VBtn
                icon
                size="small"
                color="error"
                variant="text"
                @click="confirmDelete(item)"
              >
                <VIcon icon="mdi-delete" />
              </VBtn>
            </div>
          </template>

          <!-- 无数据 -->
          <template #no-data>
            <div class="text-center py-8">
              <VIcon
                icon="mdi-account-search"
                size="64"
                color="grey"
                class="mb-4"
              />
              <h3 class="text-h6 mb-2">
                暂无客户数据
              </h3>
              <p class="text-body-2 text-medium-emphasis">
                还没有客户注册或符合搜索条件
              </p>
            </div>
          </template>
        </VDataTable>
      </VCardText>
    </VCard>

    <!-- 创建/编辑对话框 -->
    <VDialog
      v-model="showCreateDialog"
      max-width="600px"
    >
      <VCard>
        <VCardTitle>
          <span class="text-h5">{{ editingCustomer ? '编辑客户' : '新建客户' }}</span>
        </VCardTitle>
        <VCardText>
          <VForm
            ref="formRef"
            v-model="valid"
          >
            <VRow>
              <VCol
                cols="12"
                sm="6"
              >
                <VTextField
                  v-model="customerForm.name"
                  label="姓名"
                  :rules="[v => !!v || '请输入姓名']"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                sm="6"
              >
                <VTextField
                  v-model="customerForm.email"
                  label="邮箱"
                  type="email"
                  :rules="[v => !!v || '请输入邮箱', v => /.+@.+/.test(v) || '邮箱格式不正确']"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                sm="6"
              >
                <VTextField
                  v-model="customerForm.phone"
                  label="电话"
                  type="tel"
                />
              </VCol>
              <VCol
                cols="12"
                sm="6"
              >
                <VSelect
                  v-model="customerForm.status"
                  label="状态"
                  :items="statusOptions"
                  item-title="text"
                  item-value="value"
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="customerForm.note"
                  label="备注"
                  rows="3"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            color="grey"
            variant="text"
            @click="showCreateDialog = false"
          >
            取消
          </VBtn>
          <VBtn
            color="primary"
            :loading="saving"
            :disabled="!valid"
            @click="handleSave"
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
        <VCardTitle class="text-h5">
          确认删除
        </VCardTitle>
        <VCardText>
          确定要删除客户 "{{ deletingCustomer?.name }}" 吗？此操作不可恢复。
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            color="grey"
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// 搜索和表格数据
const search = ref('')
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)

// 对话框状态
const showCreateDialog = ref(false)
const showDeleteDialog = ref(false)
const valid = ref(false)

// 当前操作的客户
const editingCustomer = ref(null)
const deletingCustomer = ref(null)

// 模拟数据
const customers = ref([
  {
    id: 1,
    name: '张三',
    email: 'zhangsan@example.com',
    phone: '13800138000',
    status: 'active',
    createdAt: '2025-01-15',
    note: '重要客户'
  },
  {
    id: 2,
    name: '李四',
    email: 'lisi@example.com',
    phone: '13900139000',
    status: 'inactive',
    createdAt: '2025-01-20',
    note: '普通用户'
  }
])

// 表单数据
const customerForm = ref({
  name: '',
  email: '',
  phone: '',
  status: 'active',
  note: ''
})

// 状态选项
const statusOptions = [
  { text: '活跃', value: 'active' },
  { text: '非活跃', value: 'inactive' },
  { text: '暂停', value: 'suspended' }
]

// 表格列定义
const headers = [
  { title: '客户信息', key: 'customer', sortable: false },
  { title: '状态', key: 'status', sortable: true },
  { title: '注册时间', key: 'createdAt', sortable: true },
  { title: '操作', key: 'actions', sortable: false, align: 'end' }
]

// 计算属性
const totalCustomers = computed(() => customers.value.length)
const activeCustomers = computed(() => customers.value.filter(c => c.status === 'active').length)
const paidCustomers = computed(() => customers.value.filter(c => c.status === 'active').length)
const newCustomersThisMonth = computed(() => customers.value.filter(c => {
  const created = new Date(c.createdAt)
  const now = new Date()
  return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
}).length)

// 方法
const getStatusColor = (status) => {
  const colors = {
    active: 'success',
    inactive: 'grey',
    suspended: 'warning'
  }
  return colors[status] || 'grey'
}

const getStatusText = (status) => {
  const texts = {
    active: '活跃',
    inactive: '非活跃',
    suspended: '暂停'
  }
  return texts[status] || status
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('zh-CN')
}

const viewCustomer = (customer) => {
  router.push(`/customers/${customer.id}`)
}

const editCustomer = (customer) => {
  editingCustomer.value = customer
  customerForm.value = { ...customer }
  showCreateDialog.value = true
}

const confirmDelete = (customer) => {
  deletingCustomer.value = customer
  showDeleteDialog.value = true
}

const handleSave = () => {
  saving.value = true
  setTimeout(() => {
    if (editingCustomer.value) {
      // 编辑现有客户
      const index = customers.value.findIndex(c => c.id === editingCustomer.value.id)
      if (index !== -1) {
        customers.value[index] = { ...customerForm.value, id: editingCustomer.value.id }
      }
    } else {
      // 创建新客户
      const newCustomer = {
        ...customerForm.value,
        id: Date.now(),
        createdAt: new Date().toISOString().split('T')[0]
      }
      customers.value.push(newCustomer)
    }
    
    saving.value = false
    showCreateDialog.value = false
    editingCustomer.value = null
    resetForm()
  }, 500)
}

const handleDelete = () => {
  deleting.value = true
  setTimeout(() => {
    const index = customers.value.findIndex(c => c.id === deletingCustomer.value.id)
    if (index !== -1) {
      customers.value.splice(index, 1)
    }
    deleting.value = false
    showDeleteDialog.value = false
    deletingCustomer.value = null
  }, 500)
}

const handleExport = () => {
  console.log('Export customers')
}

const handleRefresh = () => {
  loading.value = true
  setTimeout(() => {
    loading.value = false
  }, 1000)
}

const resetForm = () => {
  customerForm.value = {
    name: '',
    email: '',
    phone: '',
    status: 'active',
    note: ''
  }
}

// 初始化
onMounted(() => {
  console.log('Customer management page loaded')
})
</script>
