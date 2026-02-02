<template>
  <StandardPage
    title="短信配置"
    subtitle="配置全局短信服务及不同业务场景的模板参数"
  >
    <VRow>
      <!-- 全局配置 -->
      <VCol cols="12">
        <VCard
          elevation="0"
          border
          class="mb-6"
        >
          <VCardTitle class="pa-4 d-flex align-center">
            <VIcon
              icon="mdi-earth"
              class="me-2"
              color="primary"
            />
            全局短信配置
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-6">
            <VForm ref="globalForm">
              <VRow>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VSelect
                    v-model="systemStore.smsSettings.provider"
                    :items="smsProviders"
                    label="短信服务商"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-server"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VSwitch
                    v-model="systemStore.smsSettings.enabled"
                    label="启用短信服务"
                    color="primary"
                    hide-details
                    inset
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VTextField
                    v-model="systemStore.smsSettings.accessKeyId"
                    label="AccessKey ID"
                    :type="showSmsKey ? 'text' : 'password'"
                    :append-inner-icon="showSmsKey ? 'mdi-eye-off' : 'mdi-eye'"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-key"
                    @click:append-inner="showSmsKey = !showSmsKey"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VTextField
                    v-model="systemStore.smsSettings.accessKeySecret"
                    label="AccessKey Secret"
                    :type="showSmsSecret ? 'text' : 'password'"
                    :append-inner-icon="showSmsSecret ? 'mdi-eye-off' : 'mdi-eye'"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-lock"
                    @click:append-inner="showSmsSecret = !showSmsSecret"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
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
        <VCard
          elevation="0"
          border
          class="mb-6"
        >
          <VCardTitle class="pa-4 d-flex align-center">
            <VIcon
              icon="mdi-message-text-clock-outline"
              class="me-2"
              color="primary"
            />
            业务场景模板配置
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-6">
            <VRow>
              <!-- 登录/注册场景 -->
              <VCol
                cols="12"
                md="6"
              >
                <div class="mb-4">
                  <div class="text-subtitle-1 font-weight-bold mb-1">
                    <VIcon
                      icon="mdi-shield-check-outline"
                      size="small"
                      class="me-1"
                    />
                    登录/注册
                  </div>
                  <div class="text-caption text-medium-emphasis mb-2">
                    用于发送手机验证码
                  </div>
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
              <VCol
                cols="12"
                md="6"
              >
                <div class="mb-4">
                  <div class="text-subtitle-1 font-weight-bold mb-1">
                    <VIcon
                      icon="mdi-calendar-check-outline"
                      size="small"
                      class="me-1"
                    />
                    面试邀请
                  </div>
                  <div class="text-caption text-medium-emphasis mb-2">
                    用于发送面试通知链接
                  </div>
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

              <!-- Offer Scenario -->
              <VCol
                cols="12"
                md="6"
              >
                <div class="mb-4">
                  <div class="text-subtitle-1 font-weight-bold mb-1">
                    <VIcon
                      icon="mdi-email-check"
                      size="small"
                      class="me-1"
                    />
                    Offer发送通知
                  </div>
                  <div class="text-caption text-medium-emphasis mb-2">
                    发送Offer时通知候选人
                  </div>
                  <VTextField
                    v-model="systemStore.smsSettings.scenarios.offer.templateCode"
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
              size="large"
              @click="saveSettings"
            >
              保存配置
            </VBtn>
          </VCardActions>
        </VCard>
      </VCol>

      <!-- 测试发送 -->
      <VCol cols="12">
        <VCard
          elevation="0"
          border
        >
          <VCardTitle class="pa-4 d-flex align-center">
            <VIcon
              icon="mdi-test-tube"
              class="me-2"
              color="warning"
            />
            短信发送测试
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-6">
            <VRow>
              <VCol
                cols="12"
                md="4"
              >
                <VSelect
                  v-model="smsTestScenario"
                  :items="smsScenarioOptions"
                  label="选择测试场景"
                  variant="outlined"
                  density="compact"
                  prepend-inner-icon="mdi-shape-outline"
                />
              </VCol>
              <VCol
                cols="12"
                md="4"
              >
                <VTextField
                  v-model="smsTestPhone"
                  label="接收手机号"
                  variant="outlined"
                  density="compact"
                  prepend-inner-icon="mdi-cellphone"
                />
              </VCol>
              <VCol
                cols="12"
                md="4"
              >
                <VTextField
                  :model-value="systemStore.smsSettings.scenarios?.[smsTestScenario]?.templateCode || ''"
                  label="当前场景模板 Code"
                  variant="outlined"
                  density="compact"
                  prepend-inner-icon="mdi-code-tags"
                  readonly
                />
              </VCol>
              <VCol
                cols="12"
                md="12"
              >
                <VTextarea
                  v-model="smsTestParams"
                  label="测试参数 (JSON)"
                  variant="outlined"
                  density="compact"
                  prepend-inner-icon="mdi-code-json"
                  rows="6"
                  auto-grow
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
              @click="testSms"
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
import { ref, onMounted, watch } from 'vue'
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

const smsTestScenario = ref('auth')
const smsTestPhone = ref('')
const smsTestParams = ref('')
const smsScenarioOptions = [
  { title: '登录/注册验证码', value: 'auth' },
  { title: '面试邀请通知', value: 'interview' },
  { title: 'Offer发送通知', value: 'offer' },
  { title: '面试催单通知', value: 'reminder' },
]

const defaultTestParams = {
  auth: { code: '123456' },
  interview: {
    name: '张三',
    company: '超级简历',
    time: '2026-01-20 10:00',
    jobId: '12345'
  },
  offer: {
    name: '张三',
    company: '超级简历',
    time: '2026-02-01'
  },
  reminder: {
    time: '15分钟后',
    name: '张三',
    company: '超级简历',
    url: 'https://master.cloujade.com?resumeJobId=12345'
  }
}

watch(smsTestScenario, (newVal) => {
  if (newVal && defaultTestParams[newVal]) {
    smsTestParams.value = JSON.stringify(defaultTestParams[newVal], null, 2)
  }
}, { immediate: true })

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

const testSms = async () => {
  if (!smsTestPhone.value || !smsTestScenario.value) {
    ui.showNotification('请输入接收手机号', 'warning')
    return
  }
  testing.value = true
  try {
    let params = null
    try {
      if (smsTestParams.value) {
        params = JSON.parse(smsTestParams.value)
      }
    } catch (e) {
      ui.showNotification('测试参数格式错误，请输入有效的 JSON', 'error')
      testing.value = false
      return
    }

    const currentTemplateCode = systemStore.smsSettings.scenarios[smsTestScenario.value]?.templateCode

    await systemStore.testSms({ 
      phone: smsTestPhone.value,
      scenario: smsTestScenario.value,
      templateCode: currentTemplateCode,
      content: params
    })
    ui.showNotification('测试短信已发出', 'success')
  } catch (error) {
    console.error('Test SMS error:', error)
    const data = error.response?.data
    const err = data?.error
    const msg = (err && typeof err === 'object')
      ? `${err.code ? err.code + ': ' : ''}${err.message || '发送失败'}`
      : (typeof err === 'string' ? err : (data?.message || error.message || '发送失败'))
    ui.showNotification('发送失败：' + msg, 'error')
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
