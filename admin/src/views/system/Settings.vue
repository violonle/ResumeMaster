<template>
  <StandardPage
    title="系统设置"
    subtitle="配置系统基础参数和功能"
  >

    <VTabs v-model="activeTab" class="mb-6">
      <VTab value="basic">基础设置</VTab>
      <VTab value="sms">短信设置</VTab>
      <VTab value="notifications">通知设置</VTab>
      <VTab value="roles">角色权限</VTab>
      
    </VTabs>

    <!-- 基础设置 -->
    <VWindow v-model="activeTab">
      <VWindowItem value="basic">
        <VCard>
          <VCardText>
            <VForm ref="basicForm" @submit.prevent="saveBasicSettings">
              <VRow>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="systemStore.settings.siteName"
                    label="网站名称"
                    :rules="[v => !!v || '请输入网站名称']"
                    required
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="systemStore.settings.siteLogo"
                    label="网站Logo"
                    placeholder="请输入Logo URL"
                  />
                </VCol>
                <VCol cols="12">
                  <VTextarea
                    v-model="systemStore.settings.siteDescription"
                    label="网站描述"
                    rows="3"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="systemStore.settings.contactEmail"
                    label="联系邮箱"
                    type="email"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="systemStore.settings.contactPhone"
                    label="联系电话"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="systemStore.settings.icpNumber"
                    label="ICP备案号"
                  />
                </VCol>
                <VCol cols="12">
                  <VTextarea
                    v-model="systemStore.settings.analyticsCode"
                    label="统计代码"
                    rows="3"
                    placeholder="请输入第三方统计代码"
                  />
                </VCol>
              </VRow>
            </VForm>
          </VCardText>
          <VCardActions>
            <VSpacer />
            <VBtn color="primary" @click="saveBasicSettings" :loading="saving.basic">保存基础设置</VBtn>
          </VCardActions>
        </VCard>
      </VWindowItem>

      <!-- 短信设置 -->
      <VWindowItem value="sms">
        <VCard>
          <VCardText>
            <VForm ref="smsForm" @submit.prevent="saveSmsSettings">
              <VRow>
                <VCol cols="12" md="6">
                  <VSwitch
                    v-model="systemStore.smsSettings.enabled"
                    label="启用短信服务"
                    color="primary"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VSelect
                    v-model="systemStore.smsSettings.provider"
                    :items="smsProviders"
                    label="短信服务商"
                    :disabled="!systemStore.smsSettings.enabled"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="systemStore.smsSettings.accessKeyId"
                    label="AccessKey ID"
                    :disabled="!systemStore.smsSettings.enabled"
                    :rules="systemStore.smsSettings.enabled ? [v => !!v || '请输入AccessKey ID'] : []"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="systemStore.smsSettings.accessKeySecret"
                    label="AccessKey Secret"
                    :type="showSmsSecret ? 'text' : 'password'"
                    :append-inner-icon="showSmsSecret ? 'mdi-eye-off' : 'mdi-eye'"
                    @click:append-inner="showSmsSecret = !showSmsSecret"
                    :disabled="!systemStore.smsSettings.enabled"
                    :rules="systemStore.smsSettings.enabled ? [v => !!v || '请输入AccessKey Secret'] : []"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="systemStore.smsSettings.signName"
                    label="短信签名"
                    :disabled="!systemStore.smsSettings.enabled"
                    :rules="systemStore.smsSettings.enabled ? [v => !!v || '请输入短信签名'] : []"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="systemStore.smsSettings.templateCode"
                    label="模板代码"
                    :disabled="!systemStore.smsSettings.enabled"
                    :rules="systemStore.smsSettings.enabled ? [v => !!v || '请输入模板代码'] : []"
                  />
                </VCol>
                <VCol cols="12">
                  <VTextarea
                    v-model="smsTestPhone"
                    label="测试手机号"
                    placeholder="请输入测试手机号，多个号码用逗号分隔"
                    rows="2"
                    :disabled="!systemStore.smsSettings.enabled"
                  />
                </VCol>
              </VRow>
            </VForm>
          </VCardText>
          <VCardActions>
            <VBtn color="info" @click="testSms" :disabled="!systemStore.smsSettings.enabled || !smsTestPhone" :loading="testing.sms">
              测试短信
            </VBtn>
            <VBtn variant="tonal" color="secondary" class="ml-2" @click="checkSms" :loading="testing.check">
              检查配置
            </VBtn>
            <VSpacer />
            <div v-if="smsDiag" class="mr-4">
              <VAlert :type="smsDiag.status==='ok' ? 'success' : 'warning'" density="comfortable">
                <div class="text-sm">{{ smsDiag.status==='ok' ? '配置完整' : '缺少: ' + (smsDiag.missing||[]).join(', ') }}</div>
              </VAlert>
            </div>
            <VSpacer />
            <VBtn color="primary" @click="saveSmsSettings" :loading="saving.sms">保存短信设置</VBtn>
          </VCardActions>
        </VCard>
      </VWindowItem>

      <!-- 通知设置 -->
      <VWindowItem value="notifications">
        <VCard>
          <VCardText>
            <VForm ref="notificationForm" @submit.prevent="saveNotificationSettings">
              <VRow>
                <VCol cols="12" md="6">
                  <VSwitch
                    v-model="systemStore.notificationSettings.emailNotifications"
                    label="启用邮件通知"
                    color="primary"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VSwitch
                    v-model="systemStore.notificationSettings.smsNotifications"
                    label="启用短信通知"
                    color="primary"
                    :disabled="!systemStore.smsSettings.enabled"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VSwitch
                    v-model="systemStore.notificationSettings.pushNotifications"
                    label="启用推送通知"
                    color="primary"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VSwitch
                    v-model="systemStore.notificationSettings.systemNotifications"
                    label="启用系统通知"
                    color="primary"
                  />
                </VCol>
              </VRow>
            </VForm>
          </VCardText>
          <VCardActions>
            <VSpacer />
            <VBtn color="primary" @click="saveNotificationSettings" :loading="saving.notifications">保存通知设置</VBtn>
          </VCardActions>
        </VCard>
      </VWindowItem>

      <!-- 角色权限 -->
      <VWindowItem value="roles">
        <VRow>
          <VCol cols="12" lg="8">
            <VCard>
              <VCardTitle>
                <VRow align="center">
                  <VCol cols="12" md="8">
                    <VTextField
                      v-model="roleSearch"
                      placeholder="搜索角色"
                      prepend-inner-icon="mdi-magnify"
                      clearable
                      hide-details
                    />
                  </VCol>
                  <VCol cols="12" md="4" class="text-md-right">
                    <VBtn color="primary" @click="showRoleDialog = true">
                      <VIcon icon="mdi-plus" class="me-2" />
                      新建角色
                    </VBtn>
                  </VCol>
                </VRow>
              </VCardTitle>
              <VCardText>
                <VDataTable
                  :headers="roleHeaders"
                  :items="filteredRoles"
                  :loading="loading.roles"
                  :items-per-page="10"
                >
                  <template #item.name="{ item }">
                    <div class="d-flex align-center">
                      <VAvatar
                        size="32"
                        :color="getRoleColor(item.name)"
                        class="me-3"
                      >
                        <VIcon icon="mdi-shield-account" size="18" />
                      </VAvatar>
                      <div>
                        <div class="text-subtitle-2">{{ item.name }}</div>
                        <div class="text-caption text-medium-emphasis">{{ item.description }}</div>
                      </div>
                    </div>
                  </template>
                  
                  <template #item.permissions="{ item }">
                    <div v-if="item.permissions.includes('*')">
                      <VChip color="primary" size="small">所有权限</VChip>
                    </div>
                    <div v-else>
                      <VChip
                        v-for="permission in item.permissions.slice(0, 2)"
                        :key="permission"
                        size="small"
                        class="me-1 mb-1"
                      >
                        {{ getPermissionTitle(permission) }}
                      </VChip>
                      <VChip
                        v-if="item.permissions.length > 2"
                        size="small"
                        color="grey"
                      >
                        +{{ item.permissions.length - 2 }}
                      </VChip>
                    </div>
                  </template>
                  
                  <template #item.isSystem="{ item }">
                    <VChip
                      :color="item.isSystem ? 'primary' : 'default'"
                      size="small"
                    >
                      {{ item.isSystem ? '系统' : '自定义' }}
                    </VChip>
                  </template>
                  
                  <template #item.actions="{ item }">
                    <div class="d-flex gap-1">
                      <VBtn
                        icon
                        size="small"
                        color="info"
                        variant="text"
                        @click="viewRolePermissions(item)"
                        title="查看权限详情"
                      >
                        <VIcon icon="mdi-eye" size="18" />
                      </VBtn>
                      <VBtn
                        icon
                        size="small"
                        color="primary"
                        variant="text"
                        @click="editRole(item)"
                        :disabled="item.isSystem"
                        title="编辑角色"
                      >
                        <VIcon icon="mdi-pencil" size="18" />
                      </VBtn>
                      <VBtn
                        icon
                        size="small"
                        color="error"
                        variant="text"
                        @click="deleteRole(item)"
                        :disabled="item.isSystem"
                        title="删除角色"
                      >
                        <VIcon icon="mdi-delete" size="18" />
                      </VBtn>
                    </div>
                  </template>
                </VDataTable>
              </VCardText>
            </VCard>
          </VCol>
          
          <VCol cols="12" lg="4">
            <VCard>
              <VCardTitle>权限说明</VCardTitle>
              <VCardText>
                <VExpansionPanels>
                  <VExpansionPanel
                    v-for="category in systemStore.permissions"
                    :key="category.category"
                  >
                    <VExpansionPanelTitle>
                      <VIcon :icon="getCategoryIcon(category.category)" class="me-2" />
                      {{ category.category }}
                    </VExpansionPanelTitle>
                    <VExpansionPanelText>
                      <VList density="compact">
                        <VListItem
                          v-for="permission in category.permissions"
                          :key="permission.value"
                        >
                          <VListItemTitle class="text-body-2">
                            {{ permission.title }}
                          </VListItemTitle>
                          <VListItemSubtitle class="text-caption">
                            {{ permission.description }}
                          </VListItemSubtitle>
                        </VListItem>
                      </VList>
                    </VExpansionPanelText>
                  </VExpansionPanel>
                </VExpansionPanels>
              </VCardText>
            </VCard>
          </VCol>
        </VRow>
      </VWindowItem>

    </VWindow>

    <!-- 角色编辑对话框 -->
    <VDialog v-model="showRoleDialog" max-width="600px">
      <VCard>
        <VCardTitle>
          <span>{{ editingRole ? '编辑角色' : '新建角色' }}</span>
        </VCardTitle>
        <VCardText>
          <VForm ref="roleForm" @submit.prevent="saveRole">
            <VRow>
              <VCol cols="12">
                <VTextField
                  v-model="roleFormData.name"
                  label="角色名称"
                  :rules="[v => !!v || '请输入角色名称']"
                  required
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="roleFormData.description"
                  label="角色描述"
                  rows="2"
                />
              </VCol>
              <VCol cols="12">
                <div class="text-subtitle-2 mb-2">权限设置</div>
                <VExpansionPanels>
                  <VExpansionPanel
                    v-for="category in systemStore.permissions"
                    :key="category.category"
                  >
                    <VExpansionPanelTitle>
                      <VIcon :icon="getCategoryIcon(category.category)" class="me-2" size="18" />
                      {{ category.category }}
                    </VExpansionPanelTitle>
                    <VExpansionPanelText>
                      <VCheckbox
                        v-for="permission in category.permissions"
                        :key="permission.value"
                        v-model="roleFormData.permissions"
                        :label="permission.title"
                        :value="permission.value"
                        density="compact"
                        hide-details
                      >
                        <template #label>
                          <div>
                            <div class="text-body-2">{{ permission.title }}</div>
                            <div class="text-caption text-medium-emphasis">{{ permission.description }}</div>
                          </div>
                        </template>
                      </VCheckbox>
                    </VExpansionPanelText>
                  </VExpansionPanel>
                </VExpansionPanels>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn color="grey" variant="text" @click="closeRoleDialog">取消</VBtn>
          <VBtn color="primary" @click="saveRole" :loading="saving.role">保存</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 权限详情对话框 -->
    <VDialog v-model="showPermissionDialog" max-width="600px">
      <VCard>
        <VCardTitle>
          <VRow align="center">
            <VCol cols="auto">
              <VAvatar
                size="40"
                :color="getRoleColor(viewingRole?.name)"
              >
                <VIcon icon="mdi-shield-account" size="24" />
              </VAvatar>
            </VCol>
            <VCol>
              <div class="text-h6">{{ viewingRole?.name }}</div>
              <div class="text-caption text-medium-emphasis">{{ viewingRole?.description }}</div>
            </VCol>
          </VRow>
        </VCardTitle>
        <VCardText>
          <div class="text-subtitle-2 mb-3">权限详情</div>
          <VList density="compact">
            <VListItem
              v-for="permission in viewingRole?.permissions || []"
              :key="permission"
            >
              <VListItemIcon>
                <VIcon icon="mdi-check-circle" color="success" size="16" />
              </VListItemIcon>
              <VListItemContent>
                <VListItemTitle class="text-body-2">
                  {{ getPermissionTitle(permission) }}
                </VListItemTitle>
                <VListItemSubtitle class="text-caption text-medium-emphasis">
                  {{ getPermissionDescription(permission) }}
                </VListItemSubtitle>
              </VListItemContent>
            </VListItem>
          </VList>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn color="primary" variant="text" @click="showPermissionDialog = false">
            关闭
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import StandardPage from '@/components/StandardPage.vue'
import { useSystemStore } from '@/stores/system'
import { format } from 'date-fns'
import ui from '@/utils/ui-components.js'

const router = useRouter()
const systemStore = useSystemStore()

const activeTab = ref('basic')
const showRoleDialog = ref(false)
const showPermissionDialog = ref(false)
const showSmsSecret = ref(false)
const roleSearch = ref('')
const smsTestPhone = ref('')

const saving = reactive({
  basic: false,
  sms: false,
  notifications: false,
  role: false,
})

const testing = reactive({ sms: false, check: false })

const loading = reactive({
  roles: false,
  logs: false,
})

const exporting = ref(false)

const basicForm = ref()
const smsForm = ref()
const notificationForm = ref()
const roleForm = ref()

const editingRole = ref(null)
const viewingRole = ref(null)

const roleFormData = reactive({
  name: '',
  description: '',
  permissions: [],
})

const logFilters = reactive({
  page: 1,
  itemsPerPage: 20,
  level: '',
  module: '',
  startDate: '',
  endDate: '',
})

const roleHeaders = [
  { title: '角色', key: 'name' },
  { title: '权限', key: 'permissions', width: '300px' },
  { title: '类型', key: 'isSystem', width: '100px' },
  { title: '操作', key: 'actions', width: '150px', sortable: false },
]

const logHeaders = [
  { title: '时间', key: 'timestamp', width: '180px' },
  { title: '级别', key: 'level', width: '100px' },
  { title: '模块', key: 'module', width: '120px' },
  { title: '用户', key: 'user', width: '120px' },
  { title: '消息', key: 'message' },
]

const smsProviders = [
  { title: '阿里云', value: 'aliyun' },
  { title: '腾讯云', value: 'tencent' },
  { title: '华为云', value: 'huawei' },
]
const smsDiag = ref(null)

const logLevelOptions = [
  { title: '全部', value: '' },
  { title: '调试', value: 'debug' },
  { title: '信息', value: 'info' },
  { title: '警告', value: 'warn' },
  { title: '错误', value: 'error' },
  { title: '严重', value: 'fatal' },
]

const logModuleOptions = [
  { title: '全部', value: '' },
  { title: '用户管理', value: 'user' },
  { title: '企业管理', value: 'company' },
  { title: '订阅管理', value: 'subscription' },
  { title: 'AI模型', value: 'ai' },
  { title: '系统设置', value: 'system' },
]

const availablePermissions = [
  { title: '查看仪表板', value: 'dashboard.view' },
  { title: '管理客户', value: 'customers.manage' },
  { title: '查看客户', value: 'customers.view' },
  { title: '管理企业', value: 'companies.manage' },
  { title: '查看企业', value: 'companies.view' },
  { title: '管理订阅', value: 'subscriptions.manage' },
  { title: '查看订阅', value: 'subscriptions.view' },
  { title: '管理AI模型', value: 'ai_models.manage' },
  { title: '查看AI模型', value: 'ai_models.view' },
  { title: '系统设置', value: 'system.settings' },
  { title: '查看日志', value: 'system.logs' },
]

const filteredRoles = computed(() => {
  if (!roleSearch.value) return systemStore.roles
  return systemStore.roles.filter(role => 
    role.name.toLowerCase().includes(roleSearch.value.toLowerCase()) ||
    role.description.toLowerCase().includes(roleSearch.value.toLowerCase())
  )
})

const getLogLevelColor = (level) => {
  const colors = {
    debug: 'grey',
    info: 'info',
    warn: 'warning',
    error: 'error',
    fatal: 'error',
  }
  return colors[level] || 'grey'
}

const formatDateTime = (date) => {
  return format(new Date(date), 'yyyy-MM-dd HH:mm:ss')
}

const saveBasicSettings = async () => {
  const { valid } = await basicForm.value.validate()
  if (!valid) return

  saving.basic = true
  try {
    await systemStore.updateSettings(systemStore.settings)
    ui.showNotification('基础设置保存成功', 'success')
  } catch (error) {
    console.error('Failed to save basic settings:', error)
    ui.showNotification('保存基础设置失败', 'error')
  } finally {
    saving.basic = false
  }
}

const saveSmsSettings = async () => {
  const { valid } = await smsForm.value.validate()
  if (!valid) return

  saving.sms = true
  try {
    await systemStore.updateSmsSettings(systemStore.smsSettings)
    ui.showNotification('短信设置保存成功', 'success')
  } catch (error) {
    console.error('Failed to save SMS settings:', error)
    ui.showNotification('保存短信设置失败', 'error')
  } finally {
    saving.sms = false
  }
}

const testSms = async () => {
  if (!smsTestPhone.value) return

  testing.sms = true
  try {
    await systemStore.testSms({ phone: smsTestPhone.value })
    ui.showNotification('短信发送成功！', 'success')
  } catch (error) {
    ui.showNotification('短信发送失败：' + error.message, 'error')
  } finally {
    testing.sms = false
  }
}

const checkSms = async () => {
  testing.check = true
  try {
    const res = await systemStore.checkSms()
    smsDiag.value = res && res.data ? res.data : null
    if (smsDiag.value && smsDiag.value.status === 'ok') ui.showNotification('短信配置检查通过', 'success')
    else ui.showNotification('短信配置不完整', 'warning')
  } catch (error) {
    smsDiag.value = { status: 'error', missing: [], message: error?.message || '' }
    ui.showNotification('短信配置检查失败', 'error')
  } finally {
    testing.check = false
  }
}

const saveNotificationSettings = async () => {
  saving.notifications = true
  try {
    await systemStore.updateNotificationSettings(systemStore.notificationSettings)
    ui.showNotification('通知设置保存成功', 'success')
  } catch (error) {
    console.error('Failed to save notification settings:', error)
    ui.showNotification('保存通知设置失败', 'error')
  } finally {
    saving.notifications = false
  }
}

const editRole = (role) => {
  editingRole.value = role
  Object.assign(roleFormData, {
    name: role.name,
    description: role.description,
    permissions: [...role.permissions],
  })
  showRoleDialog.value = true
}

const viewRolePermissions = (role) => {
  editingRole.value = role
  showPermissionDialog.value = true
}

const getRoleColor = (roleName) => {
  const colors = {
    '超级管理员': 'primary',
    '客户管理员': 'success',
    '企业管理员': 'info',
    '订阅管理员': 'warning',
    'AI模型管理员': 'purple',
  }
  return colors[roleName] || 'grey'
}

const getPermissionTitle = (permissionValue) => {
  for (const category of systemStore.permissions) {
    const permission = category.permissions.find(p => p.value === permissionValue)
    if (permission) {
      return permission.title
    }
  }
  return permissionValue
}

const getPermissionDescription = (permissionValue) => {
  for (const category of systemStore.permissions) {
    const permission = category.permissions.find(p => p.value === permissionValue)
    if (permission) {
      return permission.description
    }
  }
  return ''
}

const getCategoryIcon = (category) => {
  const icons = {
    '仪表板': 'mdi-view-dashboard',
    '客户管理': 'mdi-account-group',
    '企业管理': 'mdi-domain',
    '订阅管理': 'mdi-subscription',
    'AI模型管理': 'mdi-robot',
    '系统管理': 'mdi-cog',
  }
  return icons[category] || 'mdi-shield-check'
}

const deleteRole = (role) => {
  ui.showConfirm(`确定要删除角色 "${role.name}" 吗？`, async () => {
    try {
      await systemStore.deleteRole(role.id)
      ui.showNotification('角色删除成功', 'success')
    } catch (error) {
      console.error('Failed to delete role:', error)
      ui.showNotification('删除角色失败', 'error')
    }
  }, null, { type: 'warning', title: '删除确认' })
}

const saveRole = async () => {
  const { valid } = await roleForm.value.validate()
  if (!valid) return

  saving.role = true
  try {
    if (editingRole.value) {
      await systemStore.updateRole(editingRole.value.id, roleFormData)
    } else {
      await systemStore.createRole(roleFormData)
    }
    closeRoleDialog()
    ui.showNotification('角色保存成功', 'success')
  } catch (error) {
    console.error('Failed to save role:', error)
    ui.showNotification('保存角色失败', 'error')
  } finally {
    saving.role = false
  }
}

const closeRoleDialog = () => {
  showRoleDialog.value = false
  editingRole.value = null
  Object.assign(roleFormData, {
    name: '',
    description: '',
    permissions: [],
  })
}

const fetchLogs = async () => {
  loading.logs = true
  try {
    await systemStore.fetchLogs(logFilters)
  } catch (error) {
    console.error('Failed to fetch logs:', error)
  } finally {
    loading.logs = false
  }
}

const exportLogs = async () => {
  exporting.value = true
  try {
    const blob = await systemStore.exportLogs(logFilters)
    const url = window.URL.createObjectURL(new Blob([blob]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `logs_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (error) {
    console.error('Failed to export logs:', error)
  } finally {
    exporting.value = false
  }
}

// 初始化
// 退出由全局处理

onMounted(async () => {
  await Promise.all([
    systemStore.fetchSettings(),
    systemStore.fetchSmsSettings(),
    systemStore.fetchNotificationSettings(),
    systemStore.fetchRoles(),
    systemStore.fetchPermissions(),
  ])
})
</script>
