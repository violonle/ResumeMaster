<template>
  <StandardPage
    title="职位详情"
    subtitle="查看职位的详细信息及投递情况"
  >
    <template #actions>
      <VBtn
        variant="outlined"
        prepend-icon="mdi-arrow-left"
        @click="router.back()"
      >
        返回
      </VBtn>
    </template>

    <VRow v-if="job">
      <VCol
        cols="12"
        md="8"
      >
        <VCard
          elevation="0"
          border
          class="mb-6"
        >
          <VCardTitle class="pa-4 d-flex align-center">
            <span class="text-h5 font-weight-bold">{{ job.title }}</span>
            <VChip
              :color="job.status === 'active' ? 'success' : 'grey'"
              class="ms-4"
              size="small"
              variant="tonal"
              label
            >
              {{ job.status === 'active' ? '招募中' : '已关闭' }}
            </VChip>
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-4">
            <div class="d-flex flex-wrap ga-4 mb-6">
              <div class="d-flex align-center">
                <VIcon
                  icon="mdi-currency-cny"
                  color="warning"
                  class="me-1"
                />
                <span class="text-subtitle-1 font-weight-bold text-warning">
                  {{ job.salary_min }}k - {{ job.salary_max }}k
                </span>
              </div>
              <div class="d-flex align-center">
                <VIcon
                  icon="mdi-map-marker-outline"
                  color="primary"
                  class="me-1"
                />
                <span>{{ job.city || '地点不限' }}</span>
              </div>
              <div class="d-flex align-center">
                <VIcon
                  icon="mdi-briefcase-outline"
                  color="primary"
                  class="me-1"
                />
                <span>{{ job.experience || '经验不限' }}</span>
              </div>
              <div class="d-flex align-center">
                <VIcon
                  icon="mdi-school-outline"
                  color="primary"
                  class="me-1"
                />
                <span>{{ job.education || '学历不限' }}</span>
              </div>
            </div>

            <div class="mb-6">
              <div class="text-h6 font-weight-bold mb-2">
                职位描述
              </div>
              <div class="text-body-1 whitespace-pre-wrap">
                {{ job.description || '暂无描述' }}
              </div>
            </div>

            <div>
              <div class="text-h6 font-weight-bold mb-2">
                职位要求
              </div>
              <div class="text-body-1 whitespace-pre-wrap">
                {{ job.requirement || '暂无要求' }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="4"
      >
        <VCard
          elevation="0"
          border
          class="mb-6"
        >
          <VCardTitle class="pa-4">
            所属企业
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-4">
            <div
              v-if="job.Company"
              class="d-flex align-center"
            >
              <VAvatar
                color="primary"
                variant="tonal"
                class="me-3"
              >
                <VIcon icon="mdi-office-building" />
              </VAvatar>
              <div>
                <div class="text-subtitle-1 font-weight-bold">
                  {{ job.Company.name }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  企业 ID: {{ job.Company.id }}
                </div>
              </div>
            </div>
            <VBtn
              block
              color="primary"
              variant="tonal"
              class="mt-4"
              @click="viewCompany"
            >
              查看企业详情
            </VBtn>
          </VCardText>
        </VCard>

        <VCard
          elevation="0"
          border
        >
          <VCardTitle class="pa-4">
            投递概况
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-4">
            <div class="d-flex justify-space-between align-center mb-4">
              <span class="text-body-2">累计收到简历</span>
              <span class="text-h6 font-weight-bold">{{ stats.totalResumes || 0 }}</span>
            </div>
            <VBtn
              block
              color="success"
              prepend-icon="mdi-file-document-outline"
              @click="viewResumes"
            >
              管理关联简历
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <div
      v-else-if="loading"
      class="d-flex justify-center align-center pa-12"
    >
      <VProgressCircular
        indeterminate
        color="primary"
      />
    </div>
  </StandardPage>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { jobAPI } from '@/api'
import StandardPage from '@/components/StandardPage.vue'

const route = useRoute()
const router = useRouter()
const jobId = route.params.id

const loading = ref(true)
const job = ref(null)
const stats = ref({
  totalResumes: 0
})

const loadJobDetail = async () => {
  loading.value = true
  try {
    const { data } = await jobAPI.getDetail(jobId)
    job.value = data
  } catch (error) {
    console.error('Failed to load job detail:', error)
  } finally {
    loading.value = false
  }
}

const viewCompany = () => {
  if (job.value?.company_id) {
    router.push({ name: 'company-detail', params: { id: job.value.company_id } })
  }
}

const viewResumes = () => {
  router.push({ name: 'resumes', query: { job_id: jobId } })
}

onMounted(() => {
  loadJobDetail()
})
</script>

<style scoped>
.whitespace-pre-wrap {
  white-space: pre-wrap;
}
</style>
