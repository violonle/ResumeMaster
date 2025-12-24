<template>
  <StandardPage
    title="系统日志"
    subtitle="查询与导出系统日志记录"
  >
    <template #actions>
      <VBtn color="primary" prepend-icon="mdi-magnify" @click="fetchLogs" :loading="loading.logs" class="me-2">搜索</VBtn>
      <VBtn color="success" prepend-icon="mdi-download" @click="exportLogs" :loading="exporting">导出</VBtn>
    </template>
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardText>
                <VRow class="mb-4">
                  <VCol cols="12" md="3">
                    <VSelect v-model="logFilters.level" :items="logLevelOptions" label="日志级别" clearable />
                  </VCol>
                  <VCol cols="12" md="3">
                    <VSelect v-model="logFilters.module" :items="logModuleOptions" label="模块" clearable />
                  </VCol>
                  <VCol cols="12" md="3">
                    <VTextField v-model="logFilters.startDate" label="开始日期" type="date" />
                  </VCol>
                  <VCol cols="12" md="3">
                    <VTextField v-model="logFilters.endDate" label="结束日期" type="date" />
                  </VCol>
                  <VCol cols="12" md="6">
                    <VBtn color="primary" @click="fetchLogs" :loading="loading.logs">
                      <VIcon icon="mdi-magnify" class="me-2" />
                      搜索
                    </VBtn>
                    <VBtn color="success" @click="exportLogs" class="ms-2" :loading="exporting">
                      <VIcon icon="mdi-download" class="me-2" />
                      导出
                    </VBtn>
                  </VCol>
                </VRow>
                <VDataTable
                  :headers="logHeaders"
                  :items="systemStore.logs"
                  :loading="loading.logs"
                  :items-per-page="logFilters.itemsPerPage"
                  :items-length="systemStore.totalLogs"
                  v-model:page="logFilters.page"
                  @update:page="fetchLogs"
                  class="clean-table"
                  hover
                >
                  <template #item.level="{ item }">
                    <VChip :color="getLogLevelColor(item.level)" size="small">{{ item.level }}</VChip>
                  </template>
                  <template #item.message="{ item }">
                    <div class="text-truncate" style="max-width: 300px;">{{ item.message }}</div>
                  </template>
                  <template #item.timestamp="{ item }">
                    {{ formatDateTime(item.timestamp) }}
                  </template>
                  <template #item.actions="{ item }">
                    <VBtn size="small" variant="text" color="primary" @click="openLogDetail(item)">
                      <VIcon icon="mdi-eye" />
                    </VBtn>
                  </template>
                </VDataTable>
              </VCardText>
            </VCard>
          </VCol>
        </VRow>
        <VDialog v-model="showLogDialog" max-width="800px">
          <VCard>
            <VCardTitle>日志详情</VCardTitle>
            <VCardText>
              <div class="mb-2 text-caption text-medium-emphasis">{{ formatDateTime(selectedLog?.timestamp) }} • {{ selectedLog?.level }} • {{ selectedLog?.module }}</div>
              <div class="mb-3">{{ selectedLog?.message }}</div>
              <VDivider class="mb-3" />
              <div>
                <div class="text-subtitle-2 mb-2">Payload</div>
                <pre style="background:#f5f5f5; padding:12px; border-radius:8px; overflow:auto; max-height:300px">{{ prettyPayload }}</pre>
              </div>
            </VCardText>
            <VCardActions>
              <VSpacer />
              <VBtn variant="text" @click="showLogDialog = false">关闭</VBtn>
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

const router = useRouter()
const systemStore = useSystemStore()

const loading = reactive({ logs: false })
const exporting = ref(false)

const logFilters = reactive({ page:1, itemsPerPage:20, level:'', module:'', startDate:'', endDate:'' })

const logHeaders = [
  { title: '时间', key: 'timestamp', width: '180px' },
  { title: '级别', key: 'level', width: '100px' },
  { title: '模块', key: 'module', width: '120px' },
  { title: '用户', key: 'user', width: '120px' },
  { title: '消息', key: 'message' },
  { title: '操作', key: 'actions', width: '100px' },
]

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

const getLogLevelColor = (level) => ({ debug:'grey', info:'info', warn:'warning', error:'error', fatal:'error' }[level] || 'grey')

const formatDateTime = (date) => format(new Date(date), 'yyyy-MM-dd HH:mm:ss')

const showLogDialog = ref(false)
const selectedLog = ref(null)
const prettyPayload = computed(() => {
  try {
    const p = selectedLog.value?.payload
    if (!p) return ''
    return typeof p === 'string' ? p : JSON.stringify(p, null, 2)
  } catch { return '' }
})

const openLogDetail = (item) => { selectedLog.value = item; showLogDialog.value = true }

const fetchLogs = async () => {
  loading.logs = true
  try {
    await systemStore.fetchLogs(logFilters)
  } catch (e) {
    console.error(e)
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
  } catch (e) {
    console.error(e)
  } finally {
    exporting.value = false
  }
}

// 退出由全局处理

onMounted(async () => { await fetchLogs() })
</script>
