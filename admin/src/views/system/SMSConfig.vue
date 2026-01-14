<template>
  <StandardPage
    title="短信配置"
    subtitle="配置全局短信服务及不同业务场景的模板参数"
  >
    <VRow>
      <!-- 全局配置 -->
      <VCol cols="12">
        <VCard elevation="0" border class="mb-6">
          <VCardTitle class="pa-4 d-flex align-center">
            <VIcon icon="mdi-earth" class="me-2" color="primary" />
            全局短信配置
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-6">
            <VForm ref="globalForm">
              <VRow>
                <VCol cols="12" md="6">
                  <VSelect
                    v-model="systemStore.smsSettings.provider"
                    :items="smsProviders"
                    label="短信服务商"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-server"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VSwitch
                    v-model="systemStore.smsSettings.enabled"
                    label="启用短信服务"
                    color="primary"
                    hide-details
                    inset
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="systemStore.smsSettings.accessKeyId"
                    label="AccessKey ID"
                    :type="showSmsKey ? 'text' : 'password'"
                    :append-inner-icon="showSmsKey ? 'mdi-eye-off' : 'mdi-eye'"
                    @click:append-inner="showSmsKey = !showSmsKey"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-key"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="systemStore.smsSettings.accessKeySecret"
                    label="AccessKey Secret"
                    :type="showSmsSecret ? 'text' : 'password'"
                    :append-inner-icon="showSmsSecret ? 'mdi-eye-off' : 'mdi-eye'"
                    @click:append-inner="showSmsSecret = !showSmsSecret"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-lock"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="systemStore.smsSettings.signName"
                    label="默认短信签名"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-pen"
                            placeholder="例如：争湃简历大师"
                          />
                </VCol>
              </VRow>
            </VForm>
          </VCardText>
        </VCard>
      </VCol>

      <!-- 场景化模板配置 -->
      <VCol cols="12">
        <VCard elevation="0" border class="mb-6">
          <VCardTitle class="pa-4 d-flex align-center">
            <VIcon icon="mdi-message-text-clock-outline" class="me-2" color="primary" />
            业务场景模板配置
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-6">
            <VRow>
              <!-- 登录/注册场景 -->
              <VCol cols="12" md="6">
                <div class="mb-4">
                  <div class="text-subtitle-1 font-weight-bold mb-1">
                    <VIcon icon="mdi-shield-check-outline" size="small" class="me-1" />
                    登录/注册
                  </div>
                  <div class="text-caption text-medium-emphasis mb-2">用于发送手机验证码</div>
                  <VTextField
                    v-model="systemStore.smsSettings.scenarios.auth.templateCode"
                    label="模板 Code"
                    variant="outlined"
                    density="comfortable"
                    placeholder="例如：SMS_12345678"
                    hide-details
                  />
                </div>
              </VCol>

              <!-- 面试邀请场景 -->
              <VCol cols="12" md="6">
                <div class="mb-4">
                  <div class="text-subtitle-1 font-weight-bold mb-1">
                    <VIcon icon="mdi-calendar-check-outline" size="small" class="me-1" />
                    面试邀请
                  </div>
                  <div class="text-caption text-medium-emphasis mb-2">用于发送面试通知链接</div>
                  <VTextField
                    v-model="systemStore.smsSettings.scenarios.interview.templateCode"
                    label="模板 Code"
                    variant="outlined"
                    density="comfortable"
                    placeholder="例如：SMS_87654321"
                    hide-details
                  />
                </div>
              </VCol>

              <!-- 面试提醒场景 -->
              <VCol cols="12" md="6">
                <div class="mb-4">
                  <div class="text-subtitle-1 font-weight-bold mb-1">
                    <VIcon icon="mdi-alarm-check" size="small" class="me-1" />
                    面试提醒
                  </div>
                  <div class="text-caption text-medium-emphasis mb-2">用于发送面试开始提醒</div>
                  <VTextField
                    v-model="systemStore.smsSettings.scenarios.reminder.templateCode"
                    label="模板 Code"
                    variant="outlined"
                    density="comfortable"
                    placeholder="例如：SMS_11223344"
                    hide-details
                  />
                </div>
              </VCol>
            </VRow>
          </VCardText>
          <VDivider />
          <VCardActions class="pa-4">
            <VSpacer />
            <VBtn
              color="primary"
              variant="elevated"
              :loading="saving"
              prepend-icon="mdi-content-save"
              @click="saveSettings"
              size="large"
            >
              保存配置
            </VBtn>
          </VCardActions>
        </VCard>
      </VCol>

      <!-- 测试发送 -->
      <VCol cols="12">
        <VCard elevation="0" border>
          <VCardTitle class="pa-4 d-flex align-center">
            <VIcon icon="mdi-test-tube" class="me-2" color="warning" />
            短信发送测试
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-6">
            <VRow>
              <VCol cols="12" md="4">
                <VTextField
                  v-model="testForm.phone"
                  label="接收手机号"
                  variant="outlined"
                  density="compact"
                  prepend-inner-icon="mdi-cellphone"
                />
              </VCol>
              <VCol cols="12" md="4">
                <VTextField
                  v-model="testForm.templateCode"
                  label="测试模板 Code"
                  variant="outlined"
                  density="compact"
                  prepend-inner-icon="mdi-code-tags"
                  placeholder="留空则使用全局配置"
                />
              </VCol>
              <VCol cols="12" md="4">
                <VTextField
                  v-model="testForm.content"
                  label="模板参数 (JSON)"
                  variant="outlined"
                  density="compact"
                  prepend-inner-icon="mdi-code-json"
                  placeholder='{"code":"123456"}'
                />
              </VCol>
            </VRow>
          </VCardText>
          <VCardActions class="pa-4 pt-0">
            <VSpacer />
            <VBtn
              color="warning"
              variant="outlined"
              :loading="testing"
              prepend-icon="mdi-send"
              @click="testSMS"
            >
              发送测试短信
            </VBtn>
          </VCardActions>
        </VCard>
      </VCol>
    </VRow>
  </StandardPage>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useSystemStore } from '@/stores/system'
import ui from '@/utils/ui-components.js'

const systemStore = useSystemStore()

const saving = ref(false)
const testing = ref(false)
const showSmsKey = ref(false)
const showSmsSecret = ref(false)

const smsProviders = [
  { title: '阿里云短信', value: 'aliyun' },
  { title: '腾讯云短信', value: 'tencent' },
  { title: 'Twilio', value: 'twilio' }
]

const testForm = reactive({
  phone: '',
  templateCode: '',
  content: ''
})

const saveSettings = async () => {
  saving.value = true
  try {
    await systemStore.updateSmsSettings(systemStore.smsSettings)
    ui.showNotification('短信配置保存成功', 'success')
  } catch (error) {
    console.error('Failed to save SMS settings:', error)
    ui.showNotification('保存失败：' + (error.response?.data?.message || error.message), 'error')
  } finally {
    saving.value = false
  }
}

const testSMS = async () => {
  if (!testForm.phone) {
    ui.showNotification('请输入接收手机号', 'warning')
    return
  }
  testing.value = true
  try {
    await systemStore.testSms(testForm)
    ui.showNotification('测试短信已发出', 'success')
  } catch (error) {
    console.error('Test SMS error:', error)
    ui.showNotification('发送失败：' + (error.response?.data?.message || error.message), 'error')
  } finally {
    testing.value = false
  }
}

onMounted(async () => {
  try {
    await systemStore.fetchSmsSettings()
  } catch (error) {
    console.error('Failed to fetch SMS settings:', error)
  }
})
</script>
