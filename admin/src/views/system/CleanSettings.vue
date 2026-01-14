<template>
  <StandardPage
    title="系统设置"
    subtitle="配置系统基础参数和功能"
  >
    <!-- 设置标签页 -->
    <VTabs v-model="activeTab" class="mb-6" color="primary">
      <VTab value="basic" prepend-icon="mdi-cog">基础设置</VTab>
      <VTab value="notifications" prepend-icon="mdi-bell">通知设置</VTab>
      <VTab value="roles" prepend-icon="mdi-shield-account">角色权限</VTab>
    </VTabs>

    <!-- 基础设置 -->
    <VWindow v-model="activeTab">
      <VWindowItem value="basic">
        <VCard elevation="0" border>
          <VCardText>
            <VForm ref="basicForm" @submit.prevent="saveBasicSettings">
              <VRow>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="systemStore.settings.siteName"
                    label="网站名称"
                    :rules="[v => !!v || '请输入网站名称']"
                    required
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-web"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="systemStore.settings.siteLogo"
                    label="网站Logo"
                    placeholder="请输入Logo URL"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-image"
                  />
                </VCol>
                <VCol cols="12">
                  <VTextarea
                    v-model="systemStore.settings.siteDescription"
                    label="网站描述"
                    rows="3"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-text"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="systemStore.settings.contactEmail"
                    label="联系邮箱"
                    type="email"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-email"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="systemStore.settings.contactPhone"
                    label="联系电话"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-phone"
                  />
                </VCol>
                <VCol cols="12">
                  <VSwitch
                    v-model="systemStore.settings.maintenanceMode"
                    label="维护模式"
                    color="warning"
                    hide-details
                    inset
                  >
                    <template #label>
                      <div class="d-flex align-center">
                        <span class="me-2">维护模式</span>
                        <VTooltip location="end">
                          <template #activator="{ props }">
                            <VIcon v-bind="props" icon="mdi-help-circle-outline" size="small" />
                          </template>
                          启用后，只有管理员可以访问系统
                        </VTooltip>
                      </div>
                    </template>
                  </VSwitch>
                </VCol>
                <VCol cols="12" class="d-flex justify-end">
                  <VBtn 
                    type="submit" 
                    color="primary" 
                    :loading="saving.basic"
                    prepend-icon="mdi-content-save"
                  >
                    保存基础设置
                  </VBtn>
                </VCol>
              </VRow>
            </VForm>
          </VCardText>
        </VCard>
      </VWindowItem>

      <!-- 通知设置 -->
      <VWindowItem value="notifications">
        <VCard elevation="0" border>
          <VCardText>
            <VForm ref="notificationForm" @submit.prevent="saveNotificationSettings">
              <VRow>
                <VCol cols="12" md="6">
                  <VCard border class="h-100">
                    <VCardText class="d-flex align-center justify-space-between">
                      <div>
                        <div class="text-subtitle-1 font-weight-bold">邮件通知</div>
                        <div class="text-caption text-medium-emphasis">启用后系统将通过邮件发送重要通知</div>
                      </div>
                      <VSwitch
                        v-model="systemStore.settings.emailNotifications"
                        color="primary"
                        hide-details
                        inset
                      />
                    </VCardText>
                  </VCard>
                </VCol>
                <VCol cols="12" md="6">
                  <VCard border class="h-100">
                    <VCardText class="d-flex align-center justify-space-between">
                      <div>
                        <div class="text-subtitle-1 font-weight-bold">短信通知</div>
                        <div class="text-caption text-medium-emphasis">启用后系统将通过短信发送验证码和通知</div>
                      </div>
                      <VSwitch
                        v-model="systemStore.settings.smsNotifications"
                        color="primary"
                        hide-details
                        inset
                      />
                    </VCardText>
                  </VCard>
                </VCol>
                <VCol cols="12" md="6">
                  <VCard border class="h-100">
                    <VCardText class="d-flex align-center justify-space-between">
                      <div>
                        <div class="text-subtitle-1 font-weight-bold">系统通知</div>
                        <div class="text-caption text-medium-emphasis">启用站内消息通知</div>
                      </div>
                      <VSwitch
                        v-model="systemStore.settings.systemNotifications"
                        color="primary"
                        hide-details
                        inset
                      />
                    </VCardText>
                  </VCard>
                </VCol>
                <VCol cols="12" md="6">
                  <VCard border class="h-100">
                    <VCardText class="d-flex align-center justify-space-between">
                      <div>
                        <div class="text-subtitle-1 font-weight-bold">营销通知</div>
                        <div class="text-caption text-medium-emphasis">接收产品更新和营销活动通知</div>
                      </div>
                      <VSwitch
                        v-model="systemStore.settings.marketingNotifications"
                        color="primary"
                        hide-details
                        inset
                      />
                    </VCardText>
                  </VCard>
                </VCol>
                <VCol cols="12" class="d-flex justify-end">
                  <VBtn 
                    type="submit" 
                    color="primary" 
                    :loading="saving.notifications"
                    prepend-icon="mdi-content-save"
                  >
                    保存通知设置
                  </VBtn>
                </VCol>
              </VRow>
            </VForm>
          </VCardText>
        </VCard>
      </VWindowItem>

      <!-- 角色权限 -->
      <VWindowItem value="roles">
        <VRow>
          <VCol cols="12" lg="8">
            <VCard elevation="0" border>
              <VCardText class="pa-0">
                <div class="d-flex align-center pa-4 gap-4 border-b">
                  <div style="width: 300px">
                    <VTextField
                      v-model="roleSearch"
                      prepend-inner-icon="mdi-magnify"
                      label="搜索角色"
                      single-line
                      hide-details
                      density="compact"
                      variant="outlined"
                      clearable
                    />
                  </div>
                  <VSpacer />
                  <VBtn 
                    color="primary" 
                    prepend-icon="mdi-plus"
                    @click="createRole"
                  >
                    新增角色
                  </VBtn>
                </div>
                
                <VDataTable
                  :headers="roleHeaders"
                  :items="systemStore.roles"
                  :loading="loading.roles"
                  :search="roleSearch"
                  class="clean-table"
                  hover
                >
                  <template #item.actions="{ item }">
                    <div class="d-flex justify-end">
                      <VBtn
                        icon
                        size="small"
                        color="primary"
                        variant="text"
                        class="me-1"
                        @click="editRole(item)"
                      >
                        <VIcon icon="mdi-pencil-outline" size="20" />
                        <VTooltip activator="parent" location="top">编辑权限</VTooltip>
                      </VBtn>
                      <VBtn
                        icon
                        size="small"
                        color="error"
                        variant="text"
                        @click="deleteRole(item)"
                        :disabled="item.is_system"
                      >
                        <VIcon icon="mdi-trash-can-outline" size="20" />
                        <VTooltip activator="parent" location="top">删除角色</VTooltip>
                      </VBtn>
                    </div>
                  </template>
                </VDataTable>
              </VCardText>
            </VCard>
          </VCol>
          
          <VCol cols="12" lg="4">
            <VCard elevation="0" border color="primary" variant="tonal">
              <VCardText>
                <div class="d-flex align-center mb-4">
                  <VIcon icon="mdi-shield-check" size="32" color="primary" class="me-3" />
                  <div>
                    <div class="text-h6 font-weight-bold">权限说明</div>
                    <div class="text-caption">系统角色与权限管理指南</div>
                  </div>
                </div>
                <VList bg-color="transparent">
                  <VListItem prepend-icon="mdi-circle-small" title="超级管理员拥有所有权限，不可删除" />
                  <VListItem prepend-icon="mdi-circle-small" title="建议为不同职能人员分配最小够用权限" />
                  <VListItem prepend-icon="mdi-circle-small" title="修改角色权限后，相关用户下次登录生效" />
                </VList>
              </VCardText>
            </VCard>
          </VCol>
        </VRow>
      </VWindowItem>
    </VWindow>

    <!-- 角色编辑对话框 -->
    <VDialog v-model="roleDialog" max-width="600px">
      <VCard>
        <VCardTitle class="pa-4">
          {{ roleForm.id ? '编辑角色' : '新增角色' }}
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VForm ref="roleFormRef" @submit.prevent="saveRole">
            <VTextField
              v-model="roleForm.name"
              label="角色名称"
              :rules="[v => !!v || '请输入角色名称']"
              required
              variant="outlined"
              density="compact"
              class="mb-4"
            />
            <VTextarea
              v-model="roleForm.description"
              label="角色描述"
              variant="outlined"
              density="compact"
              rows="3"
              class="mb-4"
            />
            <div class="text-subtitle-2 mb-2">权限配置</div>
            <VSheet border rounded class="pa-2" style="max-height: 300px; overflow-y: auto">
              <div v-if="!systemStore.permissions || systemStore.permissions.length === 0" class="text-caption text-medium-emphasis text-center pa-4">
                暂无可用权限配置
              </div>
              <template v-else>
                <VCheckbox
                  v-for="perm in systemStore.permissions"
                  :key="perm.id || perm.code || perm"
                  v-model="roleForm.permissions"
                  :label="perm.name || perm.description || perm.code || perm"
                  :value="perm.code || perm.id || perm"
                  hide-details
                  density="compact"
                />
              </template>
            </VSheet>
          </VForm>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn variant="text" @click="roleDialog = false">取消</VBtn>
          <VBtn color="primary" @click="saveRole" :loading="savingRole">保存</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useSystemStore } from '@/stores/system'
import StandardPage from '@/components/StandardPage.vue'
import ui from '@/utils/ui-components.js'

const systemStore = useSystemStore()

// 响应式数据
const activeTab = ref('basic')
const saving = reactive({
  basic: false,
  sms: false,
  notifications: false,
  role: false,
  account: false
})
const loading = reactive({
  roles: false
})
const showSmsKey = ref(false)
const showSmsSecret = ref(false)
const testSmsPhone = ref('')
const testTemplateCode = ref('')
const testSmsContent = ref('')
const roleSearch = ref('')

// 选项数据
const smsProviders = [
  { title: '阿里云短信', value: 'aliyun' },
  { title: '腾讯云短信', value: 'tencent' },
  { title: 'Twilio', value: 'twilio' }
]

const roleHeaders = [
  { title: '角色名称', key: 'name', align: 'start' },
  { title: '标识', key: 'code' },
  { title: '描述', key: 'description' },
  { title: '用户数', key: 'user_count', align: 'center' },
  { title: '操作', key: 'actions', align: 'end', sortable: false }
]

// 方法
const saveBasicSettings = async () => {
  saving.basic = true
  try {
    await systemStore.updateBasicSettings(systemStore.settings)
    // 模拟成功提示
    ui.showNotification('基础设置保存成功', 'success')
  } catch (error) {
    console.error('保存基础设置失败:', error)
    ui.showNotification('保存基础设置失败', 'error')
  } finally {
    saving.basic = false
  }
}

const saveSMSSettings = async () => {
  saving.sms = true
  try {
    await systemStore.updateSmsSettings(systemStore.smsSettings)
    ui.showNotification('短信设置保存成功', 'success')
  } catch (error) {
    console.error('保存短信设置失败:', error)
    ui.showNotification('保存短信设置失败', 'error')
  } finally {
    saving.sms = false
  }
}

const testSMS = async () => {
  if (!testSmsPhone.value) {
    ui.showNotification('请输入测试手机号', 'warning')
    return
  }
  saving.sms = true
  try {
    const resp = await systemStore.testSms({
      phone: testSmsPhone.value,
      templateCode: testTemplateCode.value || systemStore.smsSettings.templateCode,
      content: testSmsContent.value || '测试短信'
    })
    ui.showNotification('测试短信发送成功', 'success')
  } catch (error) {
    console.error('Test SMS Error:', error)
    const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || '发送失败'
    ui.showNotification('发送测试短信失败: ' + errorMsg, 'error')
  } finally {
    saving.sms = false
  }
}

const saveNotificationSettings = async () => {
  saving.notifications = true
  try {
    await systemStore.updateNotificationSettings(systemStore.settings)
    ui.showNotification('通知设置保存成功', 'success')
  } catch (error) {
    console.error('保存通知设置失败:', error)
    ui.showNotification('保存通知设置失败', 'error')
  } finally {
    saving.notifications = false
  }
}

const roleDialog = ref(false)
const savingRole = ref(false)
const roleFormRef = ref(null)
const roleForm = reactive({
  id: null,
  name: '',
  description: '',
  permissions: []
})

const createRole = () => {
  roleForm.id = null
  roleForm.name = ''
  roleForm.description = ''
  roleForm.permissions = []
  roleDialog.value = true
}

const editRole = (role) => {
  roleForm.id = role.id
  roleForm.name = role.name
  roleForm.description = role.description
  roleForm.permissions = role.permissions ? [...role.permissions] : []
  roleDialog.value = true
}

const saveRole = async () => {
  const { valid } = await roleFormRef.value.validate()
  if (!valid) return
  
  savingRole.value = true
  try {
    if (roleForm.id) {
      await systemStore.updateRole(roleForm.id, roleForm)
    } else {
      await systemStore.createRole(roleForm)
    }
    roleDialog.value = false
    ui.showNotification(roleForm.id ? '角色更新成功' : '角色创建成功', 'success')
  } catch (error) {
    console.error('保存角色失败:', error)
    ui.showNotification('保存角色失败', 'error')
  } finally {
    savingRole.value = false
  }
}

const deleteRole = (role) => {
  ui.showConfirm(`确定要删除角色 ${role.name} 吗？`, async () => {
    try {
      await systemStore.deleteRole(role.id)
      ui.showNotification('角色删除成功', 'success')
    } catch (error) {
      console.error('删除角色失败:', error)
      ui.showNotification('删除角色失败', 'error')
    }
  }, null, { type: 'warning', title: '删除确认' })
}

onMounted(async () => {
  // 初始化数据
  loading.roles = true
  try {
    await Promise.all([
      systemStore.fetchSettings(),
      systemStore.fetchSmsSettings(),
      systemStore.fetchRoles(),
      systemStore.fetchPermissions()
    ])

    // 初始化测试模板
    testTemplateCode.value = systemStore.smsSettings.templateCode
  } catch (error) {
    console.error('Failed to initialize system settings:', error)
  } finally {
    loading.roles = false
  }
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
