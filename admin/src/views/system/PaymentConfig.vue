<template>
  <StandardPage
    title="支付设置"
    subtitle="配置微信支付和支付宝支付的接入信息"
  >
    <VTabs
      v-model="activeTab"
      class="mb-6"
    >
      <VTab value="wechat">
        微信支付
      </VTab>
      <VTab value="alipay">
        支付宝
      </VTab>
    </VTabs>

    <VWindow v-model="activeTab">
      <!-- 微信支付设置 -->
      <VWindowItem value="wechat">
        <VCard>
          <VCardText>
            <VForm
              ref="wechatForm"
              @submit.prevent="savePaymentSettings"
            >
              <VRow>
                <VCol cols="12">
                  <VSwitch
                    v-model="systemStore.paymentSettings.wechat.enabled"
                    label="启用微信支付"
                    color="success"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VTextField
                    v-model="systemStore.paymentSettings.wechat.appId"
                    label="AppID"
                    placeholder="微信公众号或小程序 AppID"
                    :disabled="!systemStore.paymentSettings.wechat.enabled"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VTextField
                    v-model="systemStore.paymentSettings.wechat.mchId"
                    label="商户号 (MchID)"
                    placeholder="微信支付商户号"
                    :disabled="!systemStore.paymentSettings.wechat.enabled"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VTextField
                    v-model="systemStore.paymentSettings.wechat.apiKey"
                    label="API 密钥 (V2)"
                    placeholder="微信支付 API v2 密钥"
                    :disabled="!systemStore.paymentSettings.wechat.enabled"
                    type="password"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VTextField
                    v-model="systemStore.paymentSettings.wechat.apiV3Key"
                    label="API v3 密钥"
                    placeholder="微信支付 API v3 密钥"
                    :disabled="!systemStore.paymentSettings.wechat.enabled"
                    type="password"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VTextField
                    v-model="systemStore.paymentSettings.wechat.serialNo"
                    label="证书序列号"
                    placeholder="商户证书序列号"
                    :disabled="!systemStore.paymentSettings.wechat.enabled"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VTextField
                    v-model="systemStore.paymentSettings.wechat.notifyUrl"
                    label="异步通知地址"
                    placeholder="https://your-api.com/payment/wechat/notify"
                    :disabled="!systemStore.paymentSettings.wechat.enabled"
                  />
                </VCol>
                <VCol cols="12">
                  <VTextarea
                    v-model="systemStore.paymentSettings.wechat.privateKey"
                    label="商户私钥 (apiclient_key.pem)"
                    rows="5"
                    placeholder="-----BEGIN PRIVATE KEY-----"
                    :disabled="!systemStore.paymentSettings.wechat.enabled"
                  />
                </VCol>
                <VCol cols="12">
                  <VTextarea
                    v-model="systemStore.paymentSettings.wechat.publicKey"
                    label="商户证书 (apiclient_cert.pem)"
                    rows="5"
                    placeholder="-----BEGIN CERTIFICATE-----"
                    :disabled="!systemStore.paymentSettings.wechat.enabled"
                  />
                </VCol>
              </VRow>
            </VForm>
          </VCardText>
          <VCardActions>
            <VSpacer />
            <VBtn
              color="primary"
              :loading="saving"
              @click="savePaymentSettings"
            >
              保存微信设置
            </VBtn>
          </VCardActions>
        </VCard>
      </VWindowItem>

      <!-- 支付宝设置 -->
      <VWindowItem value="alipay">
        <VCard>
          <VCardText>
            <VForm
              ref="alipayForm"
              @submit.prevent="savePaymentSettings"
            >
              <VRow>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VSwitch
                    v-model="systemStore.paymentSettings.alipay.enabled"
                    label="启用支付宝支付"
                    color="info"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VSwitch
                    v-model="systemStore.paymentSettings.alipay.sandbox"
                    label="启用沙箱模式"
                    color="warning"
                    :disabled="!systemStore.paymentSettings.alipay.enabled"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VTextField
                    v-model="systemStore.paymentSettings.alipay.appId"
                    label="AppID"
                    placeholder="支付宝应用 AppID"
                    :disabled="!systemStore.paymentSettings.alipay.enabled"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VTextField
                    v-model="systemStore.paymentSettings.alipay.notifyUrl"
                    label="异步通知地址"
                    placeholder="https://your-api.com/payment/alipay/notify"
                    :disabled="!systemStore.paymentSettings.alipay.enabled"
                  />
                </VCol>
                <VCol cols="12">
                  <VTextarea
                    v-model="systemStore.paymentSettings.alipay.privateKey"
                    label="应用私钥 (Private Key)"
                    rows="5"
                    placeholder="请输入应用私钥"
                    :disabled="!systemStore.paymentSettings.alipay.enabled"
                  />
                </VCol>
                <VCol cols="12">
                  <VTextarea
                    v-model="systemStore.paymentSettings.alipay.alipayPublicKey"
                    label="支付宝公钥 (Alipay Public Key)"
                    rows="5"
                    placeholder="请输入支付宝公钥"
                    :disabled="!systemStore.paymentSettings.alipay.enabled"
                  />
                </VCol>
              </VRow>
            </VForm>
          </VCardText>
          <VCardActions>
            <VSpacer />
            <VBtn
              color="primary"
              :loading="saving"
              @click="savePaymentSettings"
            >
              保存支付宝设置
            </VBtn>
          </VCardActions>
        </VCard>
      </VWindowItem>
    </VWindow>

    <VSnackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      timeout="3000"
    >
      {{ snackbar.text }}
    </VSnackbar>
  </StandardPage>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useSystemStore } from '@/stores/system'
import StandardPage from '@/components/StandardPage.vue'

const systemStore = useSystemStore()
const activeTab = ref('wechat')
const saving = ref(false)

const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
})

const showMessage = (text, color = 'success') => {
  snackbar.value = {
    show: true,
    text,
    color
  }
}

const savePaymentSettings = async () => {
  saving.value = true
  try {
    await systemStore.updatePaymentSettings(systemStore.paymentSettings)
    showMessage('支付设置已成功保存')
  } catch (error) {
    console.error('Save payment settings failed:', error)
    showMessage('保存支付设置失败', 'error')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    await systemStore.fetchPaymentSettings()
  } catch (error) {
    console.error('Fetch payment settings failed:', error)
    showMessage('获取支付设置失败', 'error')
  }
})
</script>
