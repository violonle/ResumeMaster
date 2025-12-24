<template>
  <StandardPage
    title="企业管理"
    subtitle="管理系统中的企业信息"
  >
    <template #actions>
      <VBtn
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreateDialog"
      >
        新建企业
      </VBtn>
    </template>

    <!-- 搜索和筛选 -->
    <VCard class="mb-6" elevation="0" border>
      <VCardText class="pa-4">
        <VRow dense align="center">
          <VCol cols="12" md="4">
            <VTextField
              v-model="search"
              label="搜索企业"
              prepend-inner-icon="mdi-magnify"
              density="compact"
              variant="outlined"
              hide-details
              clearable
            />
          </VCol>
          <VCol cols="12" md="3">
            <VSelect
              v-model="statusFilter"
              :items="statusOptions"
              label="状态"
              density="compact"
              variant="outlined"
              hide-details
              clearable
            />
          </VCol>
          <VSpacer />
          <VCol cols="auto">
            <VBtn
              color="primary"
              variant="tonal"
              prepend-icon="mdi-refresh"
              @click="companiesStore.fetchCompanies()"
              :loading="loading"
            >
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
          :items="companies"
          :loading="loading"
          :search="search"
          item-value="id"
          class="clean-table"
          hover
        >
          <template #item.is_verified="{ item }">
            <VChip :color="item.is_verified ? 'success' : 'error'" size="small" variant="tonal" label>
              {{ item.is_verified ? '已认证' : '未认证' }}
            </VChip>
          </template>

          <template #item.status="{ item }">
            <VChip :color="item.status === 'active' ? 'success' : 'warning'" size="small" variant="tonal" label>
              {{ item.status === 'active' ? '正常' : '待审核' }}
            </VChip>
          </template>

          <template #item.actions="{ item }">
            <div class="d-flex justify-end">
              <VBtn
                icon
                size="small"
                variant="text"
                color="info"
                class="me-1"
                @click="router.push(`/companies/${item.id}`)"
              >
                <VIcon icon="mdi-eye-outline" size="20" />
                <VTooltip activator="parent" location="top">查看详情</VTooltip>
              </VBtn>
              
              <VBtn
                icon
                size="small"
                variant="text"
                color="primary"
                class="me-1"
                @click="editItem(item)"
              >
                <VIcon icon="mdi-pencil-outline" size="20" />
                <VTooltip activator="parent" location="top">编辑企业</VTooltip>
              </VBtn>

              <VBtn
                icon
                size="small"
                variant="text"
                color="success"
                class="me-1"
                @click="companiesStore.verifyCompany(item.id)"
                v-if="!item.is_verified"
              >
                <VIcon icon="mdi-check-decagram-outline" size="20" />
                <VTooltip activator="parent" location="top">认证企业</VTooltip>
              </VBtn>

              <VBtn
                icon
                size="small"
                variant="text"
                color="warning"
                class="me-1"
                @click="router.push(`/subscriptions?companyId=${item.id}`)"
              >
                <VIcon icon="mdi-credit-card-outline" size="20" />
                <VTooltip activator="parent" location="top">订阅管理</VTooltip>
              </VBtn>
              
              <VBtn
                icon
                size="small"
                variant="text"
                color="error"
                @click="deleteItem(item)"
              >
                <VIcon icon="mdi-trash-can-outline" size="20" />
                <VTooltip activator="parent" location="top">删除企业</VTooltip>
              </VBtn>
            </div>
          </template>
        </VDataTable>
      </VCardText>
    </VCard>

    <!-- 创建/编辑对话框 -->
    <VDialog
      v-model="dialog"
      max-width="640px"
      persistent
    >
      <VCard>
        <VCardTitle class="d-flex align-center justify-space-between">
          <span class="text-h6">{{ dialogTitle }}</span>
          <VBtn icon="mdi-close" variant="text" @click="closeDialog" />
        </VCardTitle>
        
        <VCardText class="dialog-body">
          <VForm ref="form" v-model="valid" class="elegant-form">
            <VRow class="gap-2">
              <VCol cols="12" sm="6">
                <VTextField
                  v-model="editedItem.name"
                  label="企业名称"
                  :rules="[v => !!v || '请输入企业名称']"
                  required
                  density="compact"
                />
              </VCol>
              <VCol cols="12" sm="6">
                <VSelect
                  v-model="editedItem.contact_account_id"
                  :items="accountItems"
                  label="联系人（账号）"
                  item-title="label"
                  item-value="value"
                  return-object="false"
                  density="compact"
                />
              </VCol>
              <VCol cols="12" sm="6">
                <VTextField
                  v-model="editedItem.contact_email"
                  label="联系邮箱"
                  :rules="emailRules"
                  required
                  density="compact"
                />
              </VCol>
              <VCol cols="12" sm="6">
                <VTextField
                  v-model="editedItem.contact_phone"
                  label="联系电话"
                  :rules="[v => !!v || '请输入联系电话']"
                  required
                  density="compact"
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="editedItem.address"
                  label="企业地址"
                  rows="2"
                  density="compact"
                />
              </VCol>
              <VCol cols="12" sm="4">
                <VSelect
                  v-model="editedItem.province"
                  :items="provinceItems"
                  label="省份"
                  density="compact"
                />
              </VCol>
              <VCol cols="12" sm="4">
                <VSelect
                  v-model="editedItem.city"
                  :items="cityItems"
                  label="地市"
                  density="compact"
                />
              </VCol>
              <VCol cols="12" sm="4">
                <VSelect
                  v-model="editedItem.district"
                  :items="districtItems"
                  label="县市区"
                  density="compact"
                />
              </VCol>
              <VCol cols="12">
                <div class="d-flex align-center">
                  <span class="me-2">是否认证：</span>
                  <VChip :color="editedItem.is_verified ? 'success' : 'error'" size="small">
                    {{ editedItem.is_verified ? '是' : '否' }}
                  </VChip>
                  <VBtn v-if="!editedItem.is_verified" class="ms-4" variant="text" color="primary" @click="toggleVerifySection">
                    {{ showVerifySection ? '收回' : '帮其认证' }}
                  </VBtn>
                </div>
              </VCol>
              <VCol cols="12" v-if="showVerifySection">
                <VRow>
                  <VCol cols="12" sm="6">
                    <VTextField v-model="editedItem.org_code" label="组织机构代码" density="compact" />
                  </VCol>
                  <VCol cols="12" sm="6">
                    <VTextField v-model="editedItem.responsible_name" label="负责人" density="compact" />
                  </VCol>
                  <VCol cols="12" sm="6">
                    <VTextField v-model="editedItem.responsible_phone" label="负责人电话" density="compact" />
                  </VCol>
                  <VCol cols="12" sm="6">
                    <VFileInput v-model="licenseFile" label="营业执照" accept="image/*,.pdf" density="compact" />
                  </VCol>
                  <VCol cols="12" sm="6">
                    <VFileInput v-model="orgCodeCertFile" label="组织机构代码证" accept="image/*,.pdf" density="compact" />
                  </VCol>
                </VRow>
              </VCol>
              <VCol cols="12">
                <VSelect
                  v-model="editedItem.status"
                  :items="statusItems"
                  label="状态"
                  item-title="text"
                  item-value="value"
                  density="compact"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>

        <VCardActions>
          <VSpacer />
          <VBtn color="grey" variant="tonal" @click="closeDialog">取消</VBtn>
          <VBtn color="primary" :loading="saving" :disabled="!valid" @click="saveItem">保存</VBtn>
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
          确定要删除企业 "{{ editedItem.name }}" 吗？此操作不可恢复。
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
import { ref, computed, onMounted, watch } from 'vue'
import { useCompanyStore } from '@/stores/company'
import { useRouter } from 'vue-router'
import { useCustomerStore } from '@/stores/customer'
import { regions } from '@/data/regions'
import StandardPage from '@/components/StandardPage.vue'

const companiesStore = useCompanyStore()
const router = useRouter()
const customerStore = useCustomerStore()

// 响应式数据
const search = ref('')
const statusFilter = ref(null)
const dialog = ref(false)
const deleteDialog = ref(false)
const valid = ref(false)
const saving = ref(false)
const deleting = ref(false)
const editedItem = ref({
  id: null,
  name: '',
  contact_account_id: null,
  contact_email: '',
  contact_phone: '',
  address: '',
  province: '',
  city: '',
  district: '',
  is_verified: false,
  org_code: '',
  responsible_name: '',
  responsible_phone: '',
  status: 'active'
})
const defaultItem = ref({
  id: null,
  name: '',
  contact_account_id: null,
  contact_email: '',
  contact_phone: '',
  address: '',
  province: '',
  city: '',
  district: '',
  is_verified: false,
  org_code: '',
  responsible_name: '',
  responsible_phone: '',
  status: 'active'
})
const showVerifySection = ref(false)

// 计算属性
const loading = computed(() => companiesStore.loading)
const companies = computed(() => companiesStore.companies)
const accountItems = computed(() => accounts.value.map(a => ({ label: `${a.name || a.username}（${a.phone || ''}）`, value: a.id })))
const provinceItems = computed(() => regions.map(r => r.name))
const cityItems = computed(() => {
  const prov = regions.find(r => r.name === editedItem.value.province)
  return prov ? prov.cities.map(c => c.name) : []
})
const districtItems = computed(() => {
  const prov = regions.find(r => r.name === editedItem.value.province)
  const city = prov ? prov.cities.find(c => c.name === editedItem.value.city) : null
  return city ? city.districts : []
})

const headers = [
  { title: '企业名称', key: 'name', sortable: true },
  { title: '联系人', key: 'contact_person', sortable: true },
  { title: '联系电话', key: 'contact_phone', sortable: true },
  { title: '是否认证', key: 'is_verified', sortable: true },
  { title: '状态', key: 'status', sortable: true },
  { title: '操作', key: 'actions', sortable: false, align: 'end', width: '220px' }
]

const dialogTitle = computed(() => {
  return editedItem.value.id ? '编辑企业' : '新建企业'
})

const statusOptions = [
  { title: '正常', value: 'active' },
  { title: '待审核', value: 'pending' },
  { title: '已禁用', value: 'disabled' }
]

const statusItems = [
  { text: '正常', value: 'active' },
  { text: '待审核', value: 'pending' }
]

const emailRules = [
  v => !!v || '请输入邮箱地址',
  v => /^[^@]+@[^@]+\.[^@]+$/.test(v) || '请输入有效的邮箱地址'
]

// 方法
const licenseFile = ref(null)
const orgCodeCertFile = ref(null)

const openCreateDialog = () => {
  editedItem.value = Object.assign({}, defaultItem.value)
  licenseFile.value = null
  orgCodeCertFile.value = null
  dialog.value = true
  showVerifySection.value = false
}

const editItem = (item) => {
  editedItem.value = Object.assign({}, item)
  licenseFile.value = null
  orgCodeCertFile.value = null
  dialog.value = true
  showVerifySection.value = !editedItem.value.is_verified
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
      ...editedItem.value,
      verification_info: {
        org_code: editedItem.value.org_code,
        responsible_name: editedItem.value.responsible_name,
        responsible_phone: editedItem.value.responsible_phone,
      }
    }
    let companyId = editedItem.value.id
    if (companyId) {
      await companiesStore.updateCompany(companyId, payload)
    } else {
      const created = await companiesStore.createCompany(payload)
      companyId = created?.id || created?.company?.id || null
    }
    if (companyId && (licenseFile.value || orgCodeCertFile.value)) {
      await companiesStore.uploadCompanyFiles(companyId, { license: licenseFile.value, orgCodeCert: orgCodeCertFile.value })
    }
    closeDialog()
    return companyId
  } catch (error) {
    console.error('保存企业失败:', error)
  } finally {
    saving.value = false
  }
}

const toggleVerifySection = () => { showVerifySection.value = !showVerifySection.value }

const confirmDelete = async () => {
  deleting.value = true
  try {
    await companiesStore.deleteCompany(editedItem.value.id)
    deleteDialog.value = false
  } catch (error) {
    console.error('删除企业失败:', error)
  } finally {
    deleting.value = false
  }
}

// 表格列渲染：是否认证与操作

// 生命周期
const accounts = ref([])
onMounted(async () => {
  companiesStore.fetchCompanies()
  try {
    await customerStore.fetchCustomers({ itemsPerPage: 100 })
    accounts.value = customerStore.customers
  } catch (_) { accounts.value = [] }
})

watch(() => editedItem.value.province, () => { editedItem.value.city = ''; editedItem.value.district = '' })
watch(() => editedItem.value.city, () => { editedItem.value.district = '' })
</script>

<style scoped>
.dialog-body{ max-height:72vh; overflow-y:auto; padding:16px 24px }
.elegant-form :deep(.v-field){ min-height:40px; border-radius:10px }
.elegant-form :deep(.v-label){ font-size:12px; font-weight:500; letter-spacing:.2px; color:#6b7280 }
.elegant-form :deep(.v-input){ margin-bottom:8px }
.elegant-form :deep(.v-select .v-field__input){ padding-top:6px; padding-bottom:6px }
.elegant-form :deep(textarea.v-field__input){ line-height:1.4 }

:deep(.clean-table .v-data-table-header__content) {
  font-weight: 600;
  color: #424242;
}
:deep(.clean-table .v-data-table__th) {
  background-color: #f8f9fa !important;
}
</style>
