<template>
  <StandardPage
    title="简历管理"
    subtitle="管理系统中的所有简历数据"
  >
    <!-- 统计卡片 -->
    <VRow class="mb-6">
      <VCol cols="12" md="4" sm="6">
        <VCard>
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded
              color="primary"
              variant="tonal"
              class="me-4"
              size="48"
            >
              <VIcon icon="mdi-file-document-multiple" size="24" />
            </VAvatar>
            <div>
              <div class="text-h4 font-weight-bold">{{ stats.total || 0 }}</div>
              <div class="text-caption text-medium-emphasis">总简历数</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" md="4" sm="6">
        <VCard>
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded
              color="success"
              variant="tonal"
              class="me-4"
              size="48"
            >
              <VIcon icon="mdi-calendar-month" size="24" />
            </VAvatar>
            <div>
              <div class="text-h4 font-weight-bold">{{ stats.month || 0 }}</div>
              <div class="text-caption text-medium-emphasis">本月新增</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" md="4" sm="6">
        <VCard>
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded
              color="info"
              variant="tonal"
              class="me-4"
              size="48"
            >
              <VIcon icon="mdi-calendar-week" size="24" />
            </VAvatar>
            <div>
              <div class="text-h4 font-weight-bold">{{ stats.week || 0 }}</div>
              <div class="text-caption text-medium-emphasis">本周新增</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 搜索栏 -->
    <VCard class="mb-6" elevation="0" border>
      <VCardText class="pa-4">
        <VRow>
          <VCol cols="12" md="4">
            <VAutocomplete
              v-model="filters.company_id"
              :items="companies"
              item-title="name"
              item-value="id"
              label="按公司搜索"
              placeholder="选择公司"
              variant="outlined"
              density="comfortable"
              hide-details
              clearable
              @update:model-value="handleSearch"
            />
          </VCol>
          <VCol cols="12" md="4">
            <VTextField
              v-model="filters.search"
              prepend-inner-icon="mdi-magnify"
              label="搜索简历文件名"
              placeholder="输入关键词"
              variant="outlined"
              density="comfortable"
              hide-details
              clearable
              @keyup.enter="handleSearch"
              @click:clear="handleSearch"
            />
          </VCol>
          <VCol cols="12" md="4" class="d-flex align-center">
            <VBtn
              color="primary"
              variant="flat"
              class="me-2"
              @click="handleSearch"
            >
              搜索
            </VBtn>
            <VBtn
              variant="outlined"
              @click="resetFilters"
            >
              重置
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- 简历列表 -->
    <VCard elevation="0" border>
      <VDataTableServer
        v-model:items-per-page="filters.limit"
        :headers="headers"
        :items="items"
        :items-length="total"
        :loading="loading"
        :items-per-page-options="[10, 20, 50, 100]"
        @update:options="loadItems"
        hover
      >
        <template v-slot:item.name="{ item }">
          <div class="font-weight-medium">{{ item.name }}</div>
          <div class="text-caption text-medium-emphasis">{{ item.file_name }}</div>
        </template>

        <template v-slot:item.company="{ item }">
          <VChip
            size="small"
            :color="!item.Company ? 'default' : 'primary'"
            variant="tonal"
          >
            {{ item.Company?.name || '个人上传' }}
          </VChip>
        </template>

        <template v-slot:item.jobs="{ item }">
          <div class="d-flex flex-wrap ga-1">
            <VChip
              v-for="rj in item.ResumeJobs"
              :key="rj.id"
              size="x-small"
              variant="outlined"
            >
              {{ rj.Job?.title || '未知职位' }}
            </VChip>
            <span v-if="!item.ResumeJobs?.length" class="text-caption text-disabled">无</span>
          </div>
        </template>

        <template v-slot:item.created_at="{ item }">
          {{ formatDate(item.upload_date) }}
        </template>

        <template v-slot:item.actions="{ item }">
          <div class="d-flex justify-end align-center">
            <VBtn
              variant="text"
              size="small"
              icon
              color="success"
              class="me-1"
              @click="openAttachment(item)"
            >
              <VIcon icon="mdi-file-download-outline" size="20" />
              <VTooltip activator="parent" location="top">打开附件</VTooltip>
            </VBtn>
            <VBtn
              variant="text"
              size="small"
              icon
              color="info"
              class="me-1"
              @click="generateLink(item)"
            >
              <VIcon icon="mdi-link-variant" size="20" />
              <VTooltip activator="parent" location="top">生成面试链接</VTooltip>
            </VBtn>
            <VBtn
              variant="text"
              size="small"
              icon
              color="primary"
              @click="viewDetail(item)"
            >
              <VIcon icon="mdi-eye-outline" size="20" />
              <VTooltip activator="parent" location="top">查看详情</VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>
    <!-- 链接生成弹窗 -->
    <VDialog v-model="showLinkDialog" max-width="500">
      <VCard>
        <VCardTitle class="pa-4">AI面试链接生成</VCardTitle>
        <VCardText class="pa-4">
          <div class="text-body-2 mb-4">请复制以下链接发送给候选人：</div>
          <VTextField
            v-model="generatedLink"
            readonly
            variant="outlined"
            append-inner-icon="mdi-content-copy"
            @click:append-inner="copyLink"
          />
        </VCardText>
        <VCardActions class="pa-4 pt-0 justify-end">
          <VBtn color="primary" @click="showLinkDialog = false">关闭</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resumeAPI, companyAPI, interviewAPI } from '@/api'
import StandardPage from '@/components/StandardPage.vue'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const route = useRoute()
const router = useRouter()

// 状态
const loading = ref(false)
const generatingLink = ref(false)
const items = ref([])
const total = ref(0)
const companies = ref([])
const stats = ref({
  total: 0,
  month: 0,
  week: 0
})
const showLinkDialog = ref(false)
const generatedLink = ref('')

const filters = reactive({
  page: 1,
  limit: 10,
  company_id: null,
  search: ''
})

const headers = [
  { title: '姓名', key: 'name', sortable: false, minWidth: '100px' },
  { title: '所属公司', key: 'company', sortable: false, minWidth: '150px' },
  { title: '关联职位', key: 'jobs', sortable: false, minWidth: '150px' },
  { title: '上传时间', key: 'created_at', sortable: true, width: '150px' },
  { title: '操作', key: 'actions', sortable: false, align: 'end', width: '120px' }
]

// 方法
const formatDate = (date) => {
  if (!date) return '-'
  return format(new Date(date), 'yyyy-MM-dd HH:mm', { locale: zhCN })
}

const loadStats = async () => {
  try {
    const { data } = await resumeAPI.getStats()
    stats.value = data
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}

const loadCompanies = async () => {
  try {
    const { data } = await companyAPI.getList({ limit: 1000 })
    companies.value = data.items
  } catch (error) {
    console.error('Failed to load companies:', error)
  }
}

const loadItems = async (options = {}) => {
  loading.value = true
  try {
    const { page, itemsPerPage } = options
    if (page) filters.page = page
    if (itemsPerPage) filters.limit = itemsPerPage

    const { data } = await resumeAPI.getList(filters)
    items.value = data.list
    total.value = data.total
  } catch (error) {
    console.error('Failed to load resumes:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  filters.page = 1
  loadItems()
}

const resetFilters = () => {
  filters.company_id = null
  filters.search = ''
  handleSearch()
}

const viewDetail = (item) => {
  router.push({ name: 'resume-detail', params: { id: item.id } })
}

const openAttachment = (item) => {
  if (item.file_path) {
    const url = item.file_path.startsWith('http') 
      ? item.file_path 
      : `/uploads/${item.file_path}`
    window.open(url, '_blank')
  } else {
    alert('附件路径不存在')
  }
}

const generateLink = async (item) => {
  generatingLink.value = true
  try {
    // 假设 AI 面试页面运行在 5173 端口
    const baseUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:5173'
      : `${window.location.protocol}//${window.location.hostname}:5173`
      
    // 优先尝试获取已存在的未完成会话 (UUID)
    try {
      const { data } = await interviewAPI.findUnfinishedSession(item.id)
      if (data && data.data && data.data.id) {
        generatedLink.value = `${baseUrl}/?id=${data.data.id}`
      } else {
        // 如果没有未完成会话，尝试创建一个新会话以获取 UUID
        try {
          // 创建会话需要 resumeId，这里我们只提供 resumeId，让后端处理默认值
          const createRes = await interviewAPI.createSession({ 
            resumeId: item.id,
            // 可选：如果不希望立即生成题目，可以传递一个标志，但目前的 createSession 逻辑会生成题目
            // 这里我们接受预生成的行为，以确保获得 UUID
          })
          
          if (createRes.data && createRes.data.success && createRes.data.data.sessionId) {
            generatedLink.value = `${baseUrl}/?id=${createRes.data.data.sessionId}`
          } else {
            // 创建失败，回退到 resumeId
            console.warn('Create session returned no ID:', createRes)
            generatedLink.value = `${baseUrl}/?resumeId=${item.id}`
          }
        } catch (createError) {
          console.error('Failed to create session for link:', createError)
          // 创建出错，回退到 resumeId
          generatedLink.value = `${baseUrl}/?resumeId=${item.id}`
        }
      }
    } catch (e) {
      console.warn('Failed to fetch session:', e)
      // 降级：使用 resumeId
      generatedLink.value = `${baseUrl}/?resumeId=${item.id}`
    }

    showLinkDialog.value = true
  } finally {
    generatingLink.value = false
  }
}

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(generatedLink.value)
    // 这里可以使用 toast 提示，但为了简单直接 alert 或不做处理(用户已看到复制图标)
    alert('链接已复制到剪贴板')
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

onMounted(async () => {
  // 检查是否有路由参数传入 company_id
  if (route.query.company_id) {
    filters.company_id = parseInt(route.query.company_id)
  }
  
  await Promise.all([
    loadStats(),
    loadCompanies(),
    loadItems()
  ])
})
</script>
