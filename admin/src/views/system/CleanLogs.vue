<template>
  <StandardPage
    title="系统日志"
    subtitle="查看系统运行日志和审计记录"
  >
    <!-- 搜索和筛选 -->
    <VCard class="mb-6" elevation="0" border>
      <VCardText class="pa-4">
        <VRow dense align="center">
          <VCol cols="12" md="3">
            <VSelect
              v-model="logFilters.level"
              :items="logLevelOptions"
              label="日志级别"
              clearable
              density="compact"
              variant="outlined"
              hide-details
              prepend-inner-icon="mdi-filter-variant"
            />
          </VCol>
          <VCol cols="12" md="3">
            <VSelect
              v-model="logFilters.module"
              :items="logModuleOptions"
              label="模块"
              clearable
              density="compact"
              variant="outlined"
              hide-details
              prepend-inner-icon="mdi-view-module"
            />
          </VCol>
          <VCol cols="12" md="3">
            <VTextField
              v-model="logFilters.startDate"
              label="开始日期"
              type="date"
              density="compact"
              variant="outlined"
              hide-details
            />
          </VCol>
          <VCol cols="12" md="3">
            <VTextField
              v-model="logFilters.endDate"
              label="结束日期"
              type="date"
              density="compact"
              variant="outlined"
              hide-details
            />
          </VCol>
          <VCol cols="12" class="d-flex align-center mt-2">
            <VSpacer />
            <VBtn 
              color="primary" 
              variant="tonal"
              @click="fetchLogs" 
              :loading="loading.logs"
              prepend-icon="mdi-magnify"
              class="me-2"
            >
              搜索
            </VBtn>
            <VBtn 
              color="success" 
              variant="tonal"
              @click="exportLogs" 
              class="me-2" 
              :loading="exporting"
              prepend-icon="mdi-download"
            >
              导出
            </VBtn>
            <VBtn 
              color="error" 
              variant="tonal"
              @click="clearLogs" 
              :loading="clearing"
              prepend-icon="mdi-delete"
            >
              清空日志
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- 日志统计卡片 -->
    <VRow class="mb-6">
      <VCol cols="12" sm="6" md="3">
        <VCard elevation="0" border>
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded="lg"
              color="info"
              variant="tonal"
              size="48"
              class="me-4"
            >
              <VIcon icon="mdi-information" size="24" />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">{{ logStats.info }}</div>
              <div class="text-caption text-medium-emphasis">信息日志</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="12" sm="6" md="3">
        <VCard elevation="0" border>
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded="lg"
              color="warning"
              variant="tonal"
              size="48"
              class="me-4"
            >
              <VIcon icon="mdi-alert" size="24" />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">{{ logStats.warn }}</div>
              <div class="text-caption text-medium-emphasis">警告日志</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="12" sm="6" md="3">
        <VCard elevation="0" border>
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded="lg"
              color="error"
              variant="tonal"
              size="48"
              class="me-4"
            >
              <VIcon icon="mdi-close-circle" size="24" />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">{{ logStats.error }}</div>
              <div class="text-caption text-medium-emphasis">错误日志</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="12" sm="6" md="3">
        <VCard elevation="0" border>
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded="lg"
              color="purple"
              variant="tonal"
              size="48"
              class="me-4"
            >
              <VIcon icon="mdi-bug" size="24" />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">{{ logStats.debug }}</div>
              <div class="text-caption text-medium-emphasis">调试日志</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 日志数据表格 -->
    <VCard elevation="0" border>
      <VDataTable
        :headers="logHeaders"
        :items="systemStore.logs"
        :loading="loading.logs"
        :items-per-page="logFilters.itemsPerPage"
        :items-length="systemStore.totalLogs"
        v-model:page="logFilters.page"
        @update:page="fetchLogs"
        hover
        class="clean-table"
      >
        <template #item.level="{ item }">
          <VChip
            :color="getLogLevelColor(item.level)"
            size="small"
            class="font-weight-medium"
            variant="tonal"
          >
            <VIcon :icon="getLogLevelIcon(item.level)" size="14" class="me-1" />
            {{ item.level.toUpperCase() }}
          </VChip>
        </template>

        <template #item.module="{ item }">
          <VChip
            color="primary"
            variant="outlined"
            size="small"
          >
            {{ getModuleText(item.module) }}
          </VChip>
        </template>

        <template #item.message="{ item }">
          <div class="text-truncate" style="max-width: 400px;">
            {{ item.message }}
          </div>
        </template>

        <template #item.user="{ item }">
          <div v-if="item.user" class="d-flex align-center">
            <VAvatar size="24" color="secondary" variant="tonal" class="me-2">
              <span class="text-xs">{{ item.user.charAt(0).toUpperCase() }}</span>
            </VAvatar>
            <span class="text-body-2">{{ item.user }}</span>
          </div>
          <div v-else class="text-caption text-medium-emphasis">
            系统
          </div>
        </template>

        <template #item.ip="{ item }">
          <code class="text-caption bg-grey-lighten-4 pa-1 rounded" v-if="item.ip">
            {{ item.ip }}
          </code>
        </template>

        <template #item.timestamp="{ item }">
          <div class="text-caption font-weight-medium text-medium-emphasis">
            {{ formatDateTime(item.timestamp) }}
          </div>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex justify-end">
            <VBtn
              icon
              size="small"
              color="info"
              variant="text"
              class="me-1"
              @click="viewLogDetails(item)"
            >
              <VIcon icon="mdi-eye-outline" size="20" />
              <VTooltip activator="parent" location="top">查看详情</VTooltip>
            </VBtn>
            <VBtn
              icon
              size="small"
              color="error"
              variant="text"
              @click="deleteLog(item)"
            >
              <VIcon icon="mdi-trash-can-outline" size="20" />
              <VTooltip activator="parent" location="top">删除日志</VTooltip>
            </VBtn>
          </div>
        </template>
        
        <!-- 空状态 -->
        <template #no-data>
          <div class="d-flex flex-column align-center justify-center pa-8 text-medium-emphasis">
            <VIcon icon="mdi-file-document-outline" size="48" class="mb-4" />
            <div class="text-body-1">暂无日志记录</div>
          </div>
        </template>
      </VDataTable>
    </VCard>

    <!-- 日志详情对话框 -->
    <VDialog v-model="showLogDialog" max-width="800px">
      <VCard v-if="currentLog">
        <VCardTitle class="d-flex justify-space-between align-center pa-4 bg-light-blue-lighten-5">
          <span class="text-h6">日志详情</span>
          <VBtn icon="mdi-close" variant="text" size="small" @click="showLogDialog = false" />
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VRow>
            <VCol cols="12" md="6">
              <div class="text-caption text-medium-emphasis mb-1">级别</div>
              <VChip
                :color="getLogLevelColor(currentLog.level)"
                size="small"
                variant="tonal"
                class="font-weight-medium"
              >
                {{ currentLog.level.toUpperCase() }}
              </VChip>
            </VCol>
            <VCol cols="12" md="6">
              <div class="text-caption text-medium-emphasis mb-1">模块</div>
              <div class="text-body-2 font-weight-medium">{{ getModuleText(currentLog.module) }}</div>
            </VCol>
            <VCol cols="12" md="6">
              <div class="text-caption text-medium-emphasis mb-1">时间</div>
              <div class="text-body-2">{{ formatDateTime(currentLog.timestamp) }}</div>
            </VCol>
            <VCol cols="12" md="6">
              <div class="text-caption text-medium-emphasis mb-1">操作人</div>
              <div class="text-body-2">{{ currentLog.user || '系统' }}</div>
            </VCol>
            <VCol cols="12" md="6">
              <div class="text-caption text-medium-emphasis mb-1">IP地址</div>
              <code class="text-body-2 bg-grey-lighten-4 pa-1 rounded">{{ currentLog.ip || '-' }}</code>
            </VCol>
            <VCol cols="12">
              <div class="text-caption text-medium-emphasis mb-1">消息内容</div>
              <div class="text-body-2 pa-3 bg-grey-lighten-5 rounded border">{{ currentLog.message }}</div>
            </VCol>
            <VCol cols="12" v-if="currentLog.stack_trace">
              <div class="text-caption text-medium-emphasis mb-1">堆栈追踪</div>
              <pre class="text-caption pa-3 bg-grey-darken-3 text-white rounded overflow-auto" style="max-height: 300px;">{{ currentLog.stack_trace }}</pre>
            </VCol>
            <VCol cols="12" v-if="currentLog.metadata">
              <div class="text-caption text-medium-emphasis mb-1">元数据</div>
              <pre class="text-caption pa-3 bg-grey-lighten-4 rounded overflow-auto">{{ JSON.stringify(currentLog.metadata, null, 2) }}</pre>
            </VCol>
          </VRow>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn color="primary" variant="elevated" @click="showLogDialog = false">
            关闭
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useSystemStore } from '@/stores/system'
import StandardPage from '@/components/StandardPage.vue'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import ui from '@/utils/ui-components.js'

const systemStore = useSystemStore()

// 状态
const loading = reactive({
  logs: false
})
const exporting = ref(false)
const clearing = ref(false)
const showLogDialog = ref(false)
const currentLog = ref(null)

const logFilters = reactive({
  page: 1,
  itemsPerPage: 10,
  level: null,
  module: null,
  startDate: null,
  endDate: null
})

const logStats = reactive({
  info: 0,
  warn: 0,
  error: 0,
  debug: 0
})

// 选项
const logLevelOptions = [
  { title: '信息 (INFO)', value: 'info' },
  { title: '警告 (WARN)', value: 'warn' },
  { title: '错误 (ERROR)', value: 'error' },
  { title: '调试 (DEBUG)', value: 'debug' }
]

const logModuleOptions = [
  { title: '认证', value: 'auth' },
  { title: '用户', value: 'user' },
  { title: '系统', value: 'system' },
  { title: '支付', value: 'payment' },
  { title: 'AI模型', value: 'ai' }
]

const logHeaders = [
  { title: '级别', key: 'level', width: '100px' },
  { title: '模块', key: 'module', width: '100px' },
  { title: '消息', key: 'message' },
  { title: '操作人', key: 'user', width: '120px' },
  { title: 'IP', key: 'ip', width: '120px' },
  { title: '时间', key: 'timestamp', width: '180px' },
  { title: '操作', key: 'actions', align: 'end', sortable: false, width: '100px' }
]

// 方法
const fetchLogs = async () => {
  loading.logs = true
  try {
    // 模拟API调用
    await systemStore.fetchLogs(logFilters)
    // 更新统计数据 (模拟)
    logStats.info = Math.floor(Math.random() * 1000)
    logStats.warn = Math.floor(Math.random() * 50)
    logStats.error = Math.floor(Math.random() * 10)
    logStats.debug = Math.floor(Math.random() * 200)
  } catch (error) {
    console.error('获取日志失败:', error)
  } finally {
    loading.logs = false
  }
}

const getLogLevelColor = (level) => {
  const colors = {
    info: 'info',
    warn: 'warning',
    error: 'error',
    debug: 'purple'
  }
  return colors[level] || 'grey'
}

const getLogLevelIcon = (level) => {
  const icons = {
    info: 'mdi-information',
    warn: 'mdi-alert',
    error: 'mdi-close-circle',
    debug: 'mdi-bug'
  }
  return icons[level] || 'mdi-help-circle'
}

const getModuleText = (module) => {
  const option = logModuleOptions.find(opt => opt.value === module)
  return option ? option.title : module
}

const formatDateTime = (timestamp) => {
  if (!timestamp) return '-'
  try {
    return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })
  } catch (e) {
    return timestamp
  }
}

const viewLogDetails = (log) => {
  currentLog.value = log
  showLogDialog.value = true
}

const deleteLog = (log) => {
  ui.showConfirm('确定要删除这条日志吗？', async () => {
    try {
      await systemStore.deleteLog(log.id)
      await fetchLogs()
      ui.showNotification('日志删除成功', 'success')
    } catch (error) {
      console.error('删除日志失败:', error)
      ui.showNotification('删除日志失败', 'error')
    }
  }, null, { type: 'warning', title: '删除确认' })
}

const exportLogs = async () => {
  exporting.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 1500))
    // 模拟导出
    ui.showNotification('日志导出成功', 'success')
  } catch (e) {
    ui.showNotification('导出失败', 'error')
  } finally {
    exporting.value = false
  }
}

const clearLogs = () => {
  ui.showConfirm('确定要清空所有日志吗？此操作不可恢复！', async () => {
    clearing.value = true
    try {
      await systemStore.clearLogs()
      await fetchLogs()
      ui.showNotification('日志已清空', 'success')
    } catch (error) {
      console.error('清空日志失败:', error)
      ui.showNotification('清空日志失败', 'error')
    } finally {
      clearing.value = false
    }
  }, null, { type: 'error', title: '清空确认' })
}

onMounted(() => {
  fetchLogs()
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
