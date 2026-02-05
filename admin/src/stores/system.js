import { defineStore } from 'pinia'
import { ref } from 'vue'
import { systemAPI } from '@/api'

export const useSystemStore = defineStore('system', () => {
  const settings = ref({
    siteName: '',
    siteDescription: '',
    siteLogo: '',
    contactEmail: '',
    contactPhone: '',
    icpNumber: '',
    analyticsCode: '',
    portalUrl: '',
  })
  
  const smsSettings = ref({
    provider: 'aliyun',
    accessKeyId: '',
    accessKeySecret: '',
    signName: '',
    enabled: false,
    scenarios: {
      auth: { templateCode: '' },
      interview: { templateCode: '' },
      offer: { templateCode: '' }
    },
  })
  
  const emailSettings = ref({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    user: '',
    pass: '',
    fromName: '争湃·简历大师',
    enabled: false,
    scenarios: {
      interview: {
        subject: '【面试邀请】{{type}}安排 - {{siteName}}',
        html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #0f172a;">
  <div style="padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
    <div style="font-size: 20px; font-weight: 700; color: #2563eb; margin-bottom: 12px;">面试邀请</div>
    <div style="font-size: 14px; line-height: 1.7; margin-bottom: 16px;">
      <div><strong>{{name}}</strong> 您好：</div>
      <div>我们已为您安排了 <strong>{{type}}</strong>，具体信息如下：</div>
    </div>

    <div style="background: #f8fafc; padding: 14px 16px; border-radius: 10px; font-size: 14px; line-height: 1.8;">
      <div><strong>时间/截止时间：</strong>{{time}}</div>
      <div><strong>面试地点：</strong>{{location}}</div>
      <div><strong>面试链接：</strong><a href="{{link}}" style="color: #2563eb; word-break: break-all; text-decoration: none;">{{link}}</a></div>
      <div><strong>面试题量：</strong>{{aiQuestionCount}} 题</div>
    </div>

    <div style="text-align: center; margin: 22px 0 12px;">
      <a href="{{link}}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 700;">立即开始面试</a>
    </div>
    <div style="font-size: 12px; color: #64748b; line-height: 1.7;">
      如按钮无法点击，请复制链接到浏览器打开：<span style="word-break: break-all;">{{link}}</span>
    </div>

    <div style="margin-top: 18px; font-size: 14px; line-height: 1.7;">祝您面试顺利！</div>

    <div style="border-top: 1px solid #e2e8f0; margin: 20px 0 0; padding-top: 12px; font-size: 12px; color: #94a3b8; text-align: center;">
      此邮件由 {{siteName}} 系统自动发送，请勿直接回复。
    </div>
  </div>
</div>`,
        text: `面试邀请

{{name}} 您好：

我们已为您安排了 {{type}}，具体信息如下：
- 时间/截止时间：{{time}}
- 面试地点：{{location}}
- 面试链接：{{link}}
- 面试题量：{{aiQuestionCount}} 题

如无法打开链接，请复制到浏览器访问：{{link}}

祝您面试顺利！

此邮件由 {{siteName}} 系统自动发送，请勿直接回复。`,
      },
      offer: {
        subject: '【Offer通知】{{company}} - {{siteName}}',
        html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #0f172a;">
  <div style="padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
    <div style="font-size: 20px; font-weight: 700; color: #16a34a; margin-bottom: 12px;">Offer 通知</div>
    <div style="font-size: 14px; line-height: 1.7; margin-bottom: 16px;">
      <div><strong>{{name}}</strong> 您好：</div>
      <div>恭喜您！{{company}} 已向您发出 Offer。</div>
    </div>

    <div style="background: #f8fafc; padding: 14px 16px; border-radius: 10px; font-size: 14px; line-height: 1.8;">
      <div><strong>公司：</strong>{{company}}</div>
      <div><strong>截止日期：</strong>{{time}}</div>
    </div>

    <div style="margin-top: 16px; background: #f8fafc; padding: 14px 16px; border-radius: 10px;">
      <div style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">附加说明</div>
      <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.8; color: #334155;">{{message}}</div>
    </div>

    <div style="margin-top: 18px; font-size: 14px; line-height: 1.7;">期待您的回复！</div>

    <div style="border-top: 1px solid #e2e8f0; margin: 20px 0 0; padding-top: 12px; font-size: 12px; color: #94a3b8; text-align: center;">
      此邮件由 {{siteName}} 系统自动发送，请勿直接回复。
    </div>
  </div>
</div>`,
        text: `Offer 通知

{{name}} 您好：

恭喜您！{{company}} 已向您发出 Offer。

- 公司：{{company}}
- 截止日期：{{time}}

附加说明：
{{message}}

期待您的回复！

此邮件由 {{siteName}} 系统自动发送，请勿直接回复。`,
      },
    },
  })
  
  const notificationSettings = ref({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    systemNotifications: true,
  })
  
  const paymentSettings = ref({
    wechat: {
      appId: '',
      mchId: '',
      apiKey: '',
      apiV3Key: '',
      privateKey: '',
      publicKey: '',
      serialNo: '',
      enabled: false,
      notifyUrl: '',
    },
    alipay: {
      appId: '',
      privateKey: '',
      alipayPublicKey: '',
      enabled: false,
      notifyUrl: '',
      sandbox: false,
    }
  })
  
  const roles = ref([])
  const permissions = ref([])
  const logs = ref([])
  const totalLogs = ref(0)
  const logFilters = ref({
    page: 1,
    itemsPerPage: 20,
    level: '',
    module: '',
    startDate: '',
    endDate: '',
  })
  
  const loading = ref(false)

  const fetchSettings = async () => {
    loading.value = true
    try {
      const response = await systemAPI.getSettings()
      settings.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to fetch settings:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const updateSettings = async (data) => {
    try {
      const response = await systemAPI.updateSettings(data)
      settings.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to update settings:', error)
      throw error
    }
  }

  const fetchSmsSettings = async () => {
    try {
      const response = await systemAPI.getSmsSettings()
      smsSettings.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to fetch SMS settings:', error)
      throw error
    }
  }

  const updateSmsSettings = async (data) => {
    try {
      const response = await systemAPI.updateSmsSettings(data)
      smsSettings.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to update SMS settings:', error)
      throw error
    }
  }

  const testSms = async (data) => {
    try {
      const response = await systemAPI.testSms(data)
      return response.data
    } catch (error) {
      console.error('Failed to test SMS:', error)
      throw error
    }
  }

  const checkSms = async () => {
    try {
      const response = await systemAPI.checkSms()
      return response.data
    } catch (error) {
      console.error('Failed to check SMS:', error)
      throw error
    }
  }

  const fetchEmailSettings = async () => {
    try {
      const response = await systemAPI.getEmailSettings()
      const incoming = response.data && response.data.data ? response.data.data : (response.data || {})
      const merged = {
        ...emailSettings.value,
        ...incoming,
        scenarios: {
          ...(emailSettings.value.scenarios || {}),
          ...(incoming.scenarios || {}),
        },
      }
      emailSettings.value = merged
      return merged
    } catch (error) {
      console.error('Failed to fetch Email settings:', error)
      throw error
    }
  }

  const updateEmailSettings = async (data) => {
    try {
      const response = await systemAPI.updateEmailSettings(data)
      const incoming = response.data && response.data.data ? response.data.data : (response.data || {})
      const merged = {
        ...emailSettings.value,
        ...incoming,
        scenarios: {
          ...(emailSettings.value.scenarios || {}),
          ...(incoming.scenarios || {}),
        },
      }
      emailSettings.value = merged
      return merged
    } catch (error) {
      console.error('Failed to update Email settings:', error)
      throw error
    }
  }

  const testEmail = async (data) => {
    try {
      return await systemAPI.testEmail(data)
    } catch (error) {
      console.error('Failed to test Email:', error)
      throw error
    }
  }

  const fetchNotificationSettings = async () => {
    try {
      const response = await systemAPI.getNotificationSettings()
      notificationSettings.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to fetch notification settings:', error)
      throw error
    }
  }

  const updateNotificationSettings = async (data) => {
    try {
      const response = await systemAPI.updateNotificationSettings(data)
      notificationSettings.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to update notification settings:', error)
      throw error
    }
  }

  const fetchPaymentSettings = async () => {
    try {
      const response = await systemAPI.getPaymentSettings()
      paymentSettings.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to fetch payment settings:', error)
      throw error
    }
  }

  const updatePaymentSettings = async (data) => {
    try {
      const response = await systemAPI.updatePaymentSettings(data)
      paymentSettings.value = data
      return response.data
    } catch (error) {
      console.error('Failed to update payment settings:', error)
      throw error
    }
  }

  const fetchRoles = async () => {
    try {
      const response = await systemAPI.getRoles()
      roles.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to fetch roles:', error)
      throw error
    }
  }

  const fetchPermissions = async () => {
    try {
      const response = await systemAPI.getPermissions()
      permissions.value = response.data
      return response.data
    } catch (error) {
      console.error('Failed to fetch permissions:', error)
      throw error
    }
  }

  const createRole = async (data) => {
    try {
      const response = await systemAPI.createRole(data)
      await fetchRoles()
      return response.data
    } catch (error) {
      console.error('Failed to create role:', error)
      throw error
    }
  }

  const updateRole = async (id, data) => {
    try {
      const response = await systemAPI.updateRole(id, data)
      await fetchRoles()
      return response.data
    } catch (error) {
      console.error('Failed to update role:', error)
      throw error
    }
  }

  const deleteRole = async (id) => {
    try {
      await systemAPI.deleteRole(id)
      await fetchRoles()
    } catch (error) {
      console.error('Failed to delete role:', error)
      throw error
    }
  }

  const fetchLogs = async (params = {}) => {
    loading.value = true
    try {
      const queryParams = { ...logFilters.value, ...params }
      const response = await systemAPI.getLogs(queryParams)
      
      logs.value = response.data.items
      totalLogs.value = response.data.total
      logFilters.value = { ...queryParams }
      
      return response.data
    } catch (error) {
      console.error('Failed to fetch logs:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const fetchLogDetail = async (id) => {
    try {
      const response = await systemAPI.getLogDetail(id)
      return response.data
    } catch (error) {
      console.error('Failed to fetch log detail:', error)
      throw error
    }
  }

  const exportLogs = async (params = {}) => {
    try {
      const response = await systemAPI.exportLogs(params)
      return response.data
    } catch (error) {
      console.error('Failed to export logs:', error)
      throw error
    }
  }

  return {
    settings,
    smsSettings,
    emailSettings,
    notificationSettings,
    paymentSettings,
    roles,
    permissions,
    logs,
    totalLogs,
    logFilters,
    loading,
    fetchSettings,
    updateSettings,
    fetchSmsSettings,
    updateSmsSettings,
    testSms,
    checkSms,
    fetchEmailSettings,
    updateEmailSettings,
    testEmail,
    fetchNotificationSettings,
    updateNotificationSettings,
    fetchPaymentSettings,
    updatePaymentSettings,
    fetchRoles,
    fetchPermissions,
    createRole,
    updateRole,
    deleteRole,
    fetchLogs,
    fetchLogDetail,
    exportLogs,
  }
})
