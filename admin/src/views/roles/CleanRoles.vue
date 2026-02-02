<template>
  <StandardPage
    title="角色管理"
    subtitle="管理系统角色与权限矩阵"
  >
    <template #actions>
      <VBtn
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreateRole"
      >
        新建管理账号
      </VBtn>
    </template>

    <VCard>
      <VCardText>
        <VDataTable
          :headers="headers"
          :items="roles"
          :loading="loading"
          item-value="id"
        >
          <template #item.permissions="{ item }">
            <VChip
              v-for="p in (item.permissions||[])"
              :key="p.permission_key"
              class="ma-1"
              size="small"
            >
              {{ p.permission_key }}
            </VChip>
          </template>
          <template #item.actions="{ item }">
            <VBtn
              icon="mdi-pencil"
              variant="text"
              color="primary"
              title="编辑"
              @click="openEditRole(item)"
            />
            <VBtn
              icon="mdi-shield-check"
              variant="text"
              color="info"
              title="权限"
              @click="openEditPermissions(item)"
            />
          </template>
        </VDataTable>
      </VCardText>
    </VCard>

    <VDialog
      v-model="roleDialog"
      max-width="560px"
    >
      <VCard>
        <VCardTitle>新建管理账号</VCardTitle>
        <VCardText>
          <VForm v-model="validRole">
            <VSelect
              v-model="selectedRoleType"
              :items="adminRoleItems"
              label="角色类型（仅限平台）"
              @update:model-value="applySelectedAdminRole"
            />
            <VTextField
              v-model="adminAccountId"
              label="账号ID"
            />
            <VTextField
              v-model="adminPassword"
              label="密码"
              type="password"
            />
          </VForm>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="roleDialog=false"
          >
            取消
          </VBtn>
          <VBtn
            color="primary"
            variant="text"
            :loading="saving"
            @click="saveAdminAccount"
          >
            保存
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog
      v-model="permDialog"
      max-width="720px"
    >
      <VCard>
        <VCardTitle>权限矩阵</VCardTitle>
        <VCardText>
          <VRow>
            <VCol
              cols="12"
              sm="4"
            >
              <VSelect
                v-model="permFilter"
                :items="permGroups"
                label="权限分组"
              />
            </VCol>
            <VCol
              cols="12"
              sm="8"
            >
              <VTextField
                v-model="permSearch"
                label="搜索权限键"
                append-icon="mdi-magnify"
              />
            </VCol>
          </VRow>
          <div>
            <VCheckbox
              v-for="p in filteredPermissions"
              :key="p"
              v-model="selectedPerms"
              :label="p"
              :value="p"
              density="compact"
            />
          </div>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="permDialog=false"
          >
            取消
          </VBtn>
          <VBtn
            color="primary"
            variant="text"
            :loading="saving"
            @click="savePermissions"
          >
            保存
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { systemAPI, customerAPI } from '@/api'
import StandardPage from '@/components/StandardPage.vue'

const loading = ref(false)
const saving = ref(false)
const roles = ref([])
const permissionsDict = ref({ groups: {}, all: [] })
const allowedRoles = [
  { key: 'SUPER_ADMIN', name: '超级管理员' },
  { key: 'PLATFORM_ADMIN', name: '平台管理员' },
  { key: 'HR_MANAGER', name: 'HR经理（企业管理员）' },
  { key: 'HR_STAFF', name: 'HR专员' },
]
const allowedKeys = allowedRoles.map(r => r.key)

const headers = [
  { title: '键', key: 'key', sortable: true },
  { title: '名称', key: 'name', sortable: true },
  { title: '状态', key: 'status', sortable: true },
  { title: '权限', key: 'permissions', sortable: false },
  { title: '操作', key: 'actions', sortable: false, width: '180px' },
]

const statusItems = ['active','inactive']

const roleDialog = ref(false)
const validRole = ref(false)
const roleForm = ref({ id:null, key:'', name:'', description:'', status:'active' })
const selectedRoleType = ref(null)
const adminRoleItems = [ { title:'超级管理员', value:'SUPER_ADMIN' }, { title:'平台管理员', value:'PLATFORM_ADMIN' } ]
const adminAccountId = ref('')
const adminPassword = ref('')
const applySelectedAdminRole = (key) => { selectedRoleType.value = key }

const permDialog = ref(false)
const permFilter = ref('')
const permSearch = ref('')
const selectedRoleId = ref(null)
const selectedPerms = ref([])

const permGroups = computed(() => Object.keys(permissionsDict.value.groups || {}))
const filteredPermissions = computed(() => {
  const base = permissionsDict.value.all || []
  const byGroup = permFilter.value ? (permissionsDict.value.groups[permFilter.value] || []) : base
  return byGroup.filter(p => !permSearch.value || p.includes(permSearch.value))
})

const loadRoles = async () => {
  loading.value = true
  try {
    const res = await systemAPI.getRoles()
    const list = res.data?.items || res.data || res
    roles.value = (Array.isArray(list) ? list : []).filter(r => allowedKeys.includes(r.key))
  } finally { loading.value = false }
}

const loadPermissions = async () => {
  try {
    const res = await systemAPI.getPermissions()
    permissionsDict.value = res.data?.items || res.data || res
  } catch (_) { permissionsDict.value = { groups:{}, all:[] } }
}

const openCreateRole = () => { adminAccountId.value=''; adminPassword.value=''; selectedRoleType.value = null; roleDialog.value = true }
const openEditRole = (item) => { roleForm.value = { id:item.id, key:item.key, name:item.name, description:item.description, status:item.status }; selectedRoleType.value = item.key; roleDialog.value = true }
const saveAdminAccount = async () => {
  saving.value = true
  try {
    const chosen = selectedRoleType.value
    if (!['SUPER_ADMIN','PLATFORM_ADMIN'].includes(chosen)) { saving.value=false; return }
    const accountPayload = { name: adminAccountId.value, email: '', phone: '', role: 'ADMIN', is_verified: true }
    await customerAPI.create(accountPayload)
    roleDialog.value = false
    await loadRoles()
  } finally { saving.value = false }
}

const openEditPermissions = (item) => {
  selectedRoleId.value = item.id
  selectedPerms.value = (item.permissions || []).map(p => p.permission_key)
  permDialog.value = true
}
const savePermissions = async () => {
  saving.value = true
  try {
    await systemAPI.updateRole(selectedRoleId.value, { permissions: selectedPerms.value })
    permDialog.value = false
    await loadRoles()
  } finally { saving.value = false }
}

onMounted(async () => {
  await loadRoles()
  await loadPermissions()
})
</script>
