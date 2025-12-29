<template>
  <StandardPage
    :title="companyName + ' - 职位列表'"
    :subtitle="'管理该企业的职位发布数据'"
  >
    <template #actions>
      <VBtn
        variant="outlined"
        prepend-icon="mdi-arrow-left"
        @click="router.back()"
        class="me-2"
      >
        返回
      </VBtn>
      <VBtn
        color="primary"
        prepend-icon="mdi-plus"
        @click="showCreateDialog = true"
      >
        发布新职位
      </VBtn>
    </template>

    <!-- 搜索栏 -->
    <VCard class="mb-6" elevation="0" border>
      <VCardText class="pa-4">
        <VRow>
          <VCol cols="12" md="8">
            <VTextField
              v-model="filters.search"
              prepend-inner-icon="mdi-magnify"
              label="搜索职位名称"
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
            <VBtn color="primary" variant="flat" class="me-2" @click="handleSearch">搜索</VBtn>
            <VBtn variant="outlined" @click="resetFilters">重置</VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- 职位列表 -->
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
        <template v-slot:item.title="{ item }">
          <div class="font-weight-medium text-primary cursor-pointer" @click="viewDetail(item)">
            {{ item.title }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ item.category }} · {{ item.experience }} · {{ item.education }}
          </div>
        </template>

        <template v-slot:item.salary="{ item }">
          <div class="text-warning font-weight-bold">
            {{ item.salary_min }}k - {{ item.salary_max }}k
          </div>
        </template>

        <template v-slot:item.status="{ item }">
          <VChip
            :color="item.status === 'active' ? 'success' : 'grey'"
            size="small"
            variant="tonal"
            label
          >
            {{ item.status === 'active' ? '招募中' : '已关闭' }}
          </VChip>
        </template>

        <template v-slot:item.created_at="{ item }">
          {{ formatDate(item.created_at) }}
        </template>

        <template v-slot:item.actions="{ item }">
          <div class="d-flex justify-end align-center">
            <VBtn
              variant="text"
              size="small"
              icon
              color="info"
              class="me-1"
              @click="viewDetail(item)"
            >
              <VIcon icon="mdi-eye-outline" size="20" />
              <VTooltip activator="parent" location="top">查看详情</VTooltip>
            </VBtn>
            
            <VBtn
              variant="text"
              size="small"
              icon
              color="primary"
              class="me-1"
              @click="editJob(item)"
            >
              <VIcon icon="mdi-pencil-outline" size="20" />
              <VTooltip activator="parent" location="top">编辑职位</VTooltip>
            </VBtn>

            <VBtn
              variant="text"
              size="small"
              icon
              color="success"
              class="me-1"
              @click="viewResumes(item)"
            >
              <VIcon icon="mdi-file-document-outline" size="20" />
              <VTooltip activator="parent" location="top">关联简历</VTooltip>
            </VBtn>

            <VBtn
              variant="text"
              size="small"
              icon
              color="error"
              @click="confirmDelete(item)"
            >
              <VIcon icon="mdi-trash-can-outline" size="20" />
              <VTooltip activator="parent" location="top">删除职位</VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- 发布/编辑职位对话框 -->
    <VDialog v-model="showCreateDialog" max-width="800px">
      <VCard>
        <VCardTitle class="pa-4">
          <span class="text-h5">{{ editingJob ? '编辑职位' : '发布新职位' }}</span>
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VForm ref="jobForm">
            <VRow>
              <VCol cols="12" md="6">
                <VTextField
                  v-model="jobFormData.title"
                  label="职位名称"
                  required
                  variant="outlined"
                  density="comfortable"
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField
                  v-model="jobFormData.category"
                  label="职位类别"
                  variant="outlined"
                  density="comfortable"
                />
              </VCol>
              <VCol cols="12" md="4">
                <VTextField
                  v-model.number="jobFormData.salary_min"
                  label="薪资下限 (k)"
                  type="number"
                  variant="outlined"
                  density="comfortable"
                />
              </VCol>
              <VCol cols="12" md="4">
                <VTextField
                  v-model.number="jobFormData.salary_max"
                  label="薪资上限 (k)"
                  type="number"
                  variant="outlined"
                  density="comfortable"
                />
              </VCol>
              <VCol cols="12" md="4">
                <VSelect
                  v-model="jobFormData.status"
                  :items="[{ title: '招募中', value: 'active' }, { title: '已关闭', value: 'inactive' }]"
                  label="状态"
                  variant="outlined"
                  density="comfortable"
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="jobFormData.description"
                  label="职位描述"
                  rows="5"
                  variant="outlined"
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="jobFormData.requirement"
                  label="职位要求"
                  rows="5"
                  variant="outlined"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn color="grey" variant="text" @click="closeDialog">取消</VBtn>
          <VBtn color="primary" @click="handleSubmit" :loading="saving">
            {{ editingJob ? '保存' : '发布' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 删除确认 -->
    <VDialog v-model="showDeleteDialog" max-width="400px">
      <VCard>
        <VCardTitle class="text-h5">确定删除？</VCardTitle>
        <VCardText>此操作不可撤销，将删除该职位及其关联的所有数据。</VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn color="grey" variant="text" @click="showDeleteDialog = false">取消</VBtn>
          <VBtn color="error" @click="handleDelete" :loading="deleting">删除</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCompanyStore } from '@/stores/company'
import { jobAPI } from '@/api'
import StandardPage from '@/components/StandardPage.vue'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const route = useRoute()
const router = useRouter()
const companyStore = useCompanyStore()
const companyId = parseInt(route.params.id)

// 状态
const loading = ref(false)
const items = ref([])
const total = ref(0)
const saving = ref(false)
const deleting = ref(false)
const showCreateDialog = ref(false)
const showDeleteDialog = ref(false)
const editingJob = ref(null)
const deletingJob = ref(null)

const filters = reactive({
  page: 1,
  limit: 10,
  company_id: companyId,
  search: ''
})

const jobFormData = reactive({
  title: '',
  category: '',
  salary_min: 0,
  salary_max: 0,
  experience: '不限',
  education: '不限',
  city: '',
  description: '',
  requirement: '',
  status: 'active',
  company_id: companyId
})

const headers = [
  { title: '职位名称', key: 'title', sortable: false, minWidth: '150px' },
  { title: '薪资范围', key: 'salary', sortable: false, width: '120px' },
  { title: '状态', key: 'status', width: '100px' },
  { title: '发布时间', key: 'created_at', width: '150px' },
  { title: '操作', key: 'actions', sortable: false, align: 'end', width: '220px' }
]

const companyName = computed(() => {
  return companyStore.currentCompany?.name || '加载中...'
})

// 方法
const formatDate = (date) => {
  if (!date) return '-'
  return format(new Date(date), 'yyyy-MM-dd HH:mm', { locale: zhCN })
}

const loadItems = async (options = {}) => {
  loading.value = true
  try {
    const { page, itemsPerPage } = options
    if (page) filters.page = page
    if (itemsPerPage) filters.limit = itemsPerPage

    const { data } = await jobAPI.getList(filters)
    items.value = data.list
    total.value = data.total
  } catch (error) {
    console.error('Failed to load jobs:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  filters.page = 1
  loadItems()
}

const resetFilters = () => {
  filters.search = ''
  filters.page = 1
  loadItems()
}

const viewDetail = (item) => {
  // 假设职位详情页路由为 job-detail
  router.push({ name: 'job-detail', params: { id: item.id } })
}

const editJob = (item) => {
  editingJob.value = item
  Object.assign(jobFormData, {
    title: item.title,
    category: item.category,
    salary_min: item.salary_min,
    salary_max: item.salary_max,
    experience: item.experience,
    education: item.education,
    city: item.city,
    description: item.description,
    requirement: item.requirement,
    status: item.status,
    company_id: companyId
  })
  showCreateDialog.value = true
}

const viewResumes = (item) => {
  // 跳转到简历列表并带上职位 ID 过滤
  router.push({ name: 'resumes', query: { job_id: item.id } })
}

const confirmDelete = (item) => {
  deletingJob.value = item
  showDeleteDialog.value = true
}

const handleDelete = async () => {
  if (!deletingJob.value) return
  deleting.value = true
  try {
    await jobAPI.delete(deletingJob.value.id)
    showDeleteDialog.value = false
    loadItems()
  } catch (error) {
    console.error('Failed to delete job:', error)
  } finally {
    deleting.value = false
  }
}

const closeDialog = () => {
  showCreateDialog.value = false
  editingJob.value = null
  Object.assign(jobFormData, {
    title: '',
    category: '',
    salary_min: 0,
    salary_max: 0,
    experience: '不限',
    education: '不限',
    city: '',
    description: '',
    requirement: '',
    status: 'active',
    company_id: companyId
  })
}

const handleSubmit = async () => {
  saving.value = true
  try {
    if (editingJob.value) {
      await jobAPI.update(editingJob.value.id, jobFormData)
    } else {
      await jobAPI.create(jobFormData)
    }
    closeDialog()
    loadItems()
  } catch (error) {
    console.error('Failed to save job:', error)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (!companyStore.currentCompany || companyStore.currentCompany.id !== companyId) {
    await companyStore.fetchCompanyDetail(companyId)
  }
  loadItems()
})
</script>
