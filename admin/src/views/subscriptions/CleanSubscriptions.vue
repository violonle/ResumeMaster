<template>
  <StandardPage
    title="订阅管理"
    subtitle="管理企业订阅计划与到期信息"
  >
    <!-- 搜索与筛选（统一样式） -->
    <VCard class="mb-6" elevation="0" border>
      <VCardText class="pa-4">
        <VRow dense align="center">
          <VCol cols="12" md="4">
            <VTextField
              v-model="search"
              label="搜索订阅"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="compact"
              hide-details
              clearable
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
    <template #actions>
      <VBtn
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreateDialog"
      >
        新建订阅
      </VBtn>
    </template>

    <!-- 数据表格 -->
    <VCard elevation="0" border>
      <VCardText class="pa-0">
        <VDataTable
          :headers="headers"
          :items="subscriptions"
          :loading="loading"
          :search="search"
          item-value="id"
          class="clean-table"
          hover
        >

          <template #item.status="{ item }">
            <VChip
              :color="getStatusColor(item.status)"
              size="small"
            >
              {{ getStatusText(item.status) }}
            </VChip>
          </template>

          <template #item.plan_name="{ item }">
            <VChip
              :color="getPlanColor(item.plan_name)"
              size="small"
            >
              {{ item.plan_name }}
            </VChip>
          </template>

          <template #item.price="{ item }">
            <span class="font-weight-bold">¥{{ item.price }}</span>
          </template>

          <template #item.start_date="{ item }">
            {{ formatDate(item.start_date) }}
          </template>

          <template #item.end_date="{ item }">
            {{ formatDate(item.end_date) }}
          </template>

          <template #item.company_name="{ item }">
            {{ item.company_name || item.company?.name || '-' }}
          </template>

          <template #item.responsible="{ item }">
            {{ item.company?.responsible_name || item.company?.contact_person || '-' }}
          </template>

          <template #item.contact_phone="{ item }">
            {{ item.company?.responsible_phone || item.company?.contact_phone || '-' }}
          </template>

          <template #item.actions="{ item }">
            <VBtn
              icon="mdi-pencil"
              size="small"
              variant="text"
              color="primary"
              class="mr-2"
              @click="editItem(item)"
            />
            <VBtn
              icon="mdi-delete"
              size="small"
              variant="text"
              color="error"
              @click="deleteItem(item)"
            />
          </template>
        </VDataTable>
      </VCardText>
    </VCard>

    <!-- 创建/编辑对话框 -->
    <VDialog
      v-model="dialog"
      max-width="600px"
      persistent
    >
      <VCard>
        <VCardTitle>
          <span class="text-h5">{{ dialogTitle }}</span>
        </VCardTitle>
        
        <VCardText>
          <VForm ref="form" v-model="valid">
            <VRow>
              <VCol cols="12" sm="6">
                <VSelect
                  v-model="editedItem.companyId"
                  :items="companyItems"
                  label="企业"
                  item-title="label"
                  item-value="value"
                  :rules="[v => !!v || '请选择企业']"
                  required
                />
              </VCol>
              <VCol cols="12" sm="6">
                <VSelect
                  v-model="editedItem.plan_name"
                  :items="planItems"
                  label="套餐类型"
                  :rules="[v => !!v || '请选择套餐类型']"
                  required
                />
              </VCol>
              <VCol cols="12" sm="6">
                <VTextField
                  v-model.number="editedItem.price"
                  label="价格"
                  type="number"
                  prefix="¥"
                  :rules="[v => !!v || '请输入价格', v => v > 0 || '价格必须大于0']"
                  required
                />
              </VCol>
              <VCol cols="12" sm="6">
                <VSelect
                  v-model="editedItem.status"
                  :items="statusItems"
                  label="状态"
                  item-title="text"
                  item-value="value"
                />
              </VCol>
              <VCol cols="12" sm="6">
                <VTextField
                  v-model="editedItem.start_date"
                  label="开始日期"
                  type="date"
                  :rules="[v => !!v || '请选择开始日期']"
                  required
                />
              </VCol>
              <VCol cols="12" sm="6">
                <VTextField
                  v-model="editedItem.end_date"
                  label="结束日期"
                  type="date"
                  :rules="[v => !!v || '请选择结束日期']"
                  required
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>

        <VCardActions>
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
            variant="text"
            :loading="saving"
            :disabled="!valid"
            @click="saveItem"
          >
            保存
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 删除确认对话框 -->
    <VDialog
      v-model="deleteDialog"
      max-width="400px"
    >
      <VCard>
        <VCardTitle class="text-h5">
          确认删除
        </VCardTitle>
        <VCardText>
          确定要删除该订阅吗？此操作不可恢复。
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            color="grey-darken-1"
            variant="text"
            @click="deleteDialog = false"
          >
            取消
          </VBtn>
          <VBtn
            color="error"
            variant="text"
            :loading="deleting"
            @click="confirmDelete"
          >
            删除
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSubscriptionStore } from '@/stores/subscription'
import { useCompanyStore } from '@/stores/company'
import StandardPage from '@/components/StandardPage.vue'

const subscriptionsStore = useSubscriptionStore()
const route = useRoute()
const companyStore = useCompanyStore()

// 响应式数据
const search = ref('')
const dialog = ref(false)
const deleteDialog = ref(false)
const valid = ref(false)
const saving = ref(false)
const deleting = ref(false)
const editedItem = ref({
  id: null,
  companyId: '',
  plan_name: 'basic',
  price: 0,
  status: 'active',
  start_date: '',
  end_date: ''
})
const defaultItem = ref({
  id: null,
  companyId: '',
  plan_name: 'basic',
  price: 0,
  status: 'active',
  start_date: '',
  end_date: ''
})

// 计算属性
const loading = computed(() => subscriptionsStore.loading)
const subscriptions = computed(() => subscriptionsStore.subscriptions)
const companyItems = computed(() => companies.value.map(c => ({ label: c.name, value: c.id })))

const headers = [
  { title: '企业', key: 'company_name', sortable: true, align: 'start' },
  { title: '负责人', key: 'responsible', sortable: false, align: 'start' },
  { title: '联系方式', key: 'contact_phone', sortable: false, align: 'start' },
  { title: '套餐类型', key: 'plan_name', sortable: true, align: 'start' },
  { title: '价格', key: 'price', sortable: true, align: 'start' },
  { title: '状态', key: 'status', sortable: true, align: 'start' },
  { title: '开始日期', key: 'start_date', sortable: true, align: 'start' },
  { title: '结束日期', key: 'end_date', sortable: true, align: 'start' },
  { title: '操作', key: 'actions', sortable: false, width: '120px', align: 'end' }
]

const dialogTitle = computed(() => {
  return editedItem.value.id ? '编辑订阅' : '新建订阅'
})

const planItems = [
  'professional',
  'enterprise'
]

const statusItems = [
  { text: '正常', value: 'active' },
  { text: '已过期', value: 'expired' },
  { text: '已取消', value: 'cancelled' }
]

// 方法
const getStatusColor = (status) => {
  const colors = {
    active: 'success',
    expired: 'warning',
    cancelled: 'error'
  }
  return colors[status] || 'grey'
}

const getStatusText = (status) => {
  const texts = {
    active: '正常',
    expired: '已过期',
    cancelled: '已取消'
  }
  return texts[status] || status
}

const getPlanColor = (plan) => {
  const colors = {
    basic: 'info',
    professional: 'primary',
    enterprise: 'purple'
  }
  return colors[plan] || 'grey'
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('zh-CN')
}

const openCreateDialog = () => {
  editedItem.value = Object.assign({}, defaultItem.value)
  dialog.value = true
}

const editItem = (item) => {
  editedItem.value = Object.assign({}, item)
  dialog.value = true
}

const deleteItem = (item) => {
  editedItem.value = Object.assign({}, item)
  deleteDialog.value = true
}

const closeDialog = () => {
  dialog.value = false
  editedItem.value = Object.assign({}, defaultItem.value)
}

const saveItem = async () => {
  if (!valid.value) return
  
  saving.value = true
  try {
    const payload = {
      companyId: editedItem.value.companyId,
      plan: editedItem.value.plan_name,
      price: editedItem.value.price,
      start_at: editedItem.value.start_date,
      end_at: editedItem.value.end_date,
      action: editedItem.value.id ? 'update' : 'create'
    }
    if (editedItem.value.id) {
      await subscriptionsStore.updateSubscription(editedItem.value.companyId, payload)
    } else {
      await subscriptionsStore.createSubscription(payload)
    }
    closeDialog()
  } catch (error) {
    console.error('保存订阅失败:', error)
  } finally {
    saving.value = false
  }
}

const confirmDelete = async () => {
  deleting.value = true
  try {
    await subscriptionsStore.deleteSubscription(editedItem.value.id)
    deleteDialog.value = false
  } catch (error) {
    console.error('删除订阅失败:', error)
  } finally {
    deleting.value = false
  }
}

// 生命周期
const companies = ref([])
onMounted(async () => {
  const companyId = route.query.companyId || ''
  if (companyId) {
    await subscriptionsStore.fetchSubscriptions({ companyId })
  } else {
    subscriptionsStore.fetchSubscriptions()
  }
  try {
    const res = await companyStore.fetchCompanies({ itemsPerPage: 100 })
    companies.value = res.items || companyStore.companies
  } catch (_) { companies.value = companyStore.companies }
})

const handleRefresh = async () => {
  const companyId = route.query.companyId || ''
  await subscriptionsStore.fetchSubscriptions(companyId ? { companyId } : {})
}
</script>

<style scoped>
</style>
