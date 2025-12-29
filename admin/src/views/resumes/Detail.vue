<template>
  <StandardPage
    title="简历详情"
    :subtitle="resume ? `${resume.name || '未命名'} - ${resume.Company?.name || '个人上传'}` : '查看简历解析内容和相关信息'"
    show-back
    @back="goBack"
  >
    <template #actions>
      <VBtn
        variant="outlined"
        color="primary"
        prepend-icon="mdi-file-download-outline"
        @click="openAttachment"
      >
        打开附件
      </VBtn>
    </template>

    <div v-if="loading" class="d-flex justify-center align-center py-12">
      <VProgressCircular indeterminate color="primary" size="64" />
    </div>

    <template v-else-if="resume">
      <VRow>
        <!-- 主内容区 -->
        <VCol cols="12" md="8">
          <!-- 解析摘要 -->
          <VCard variant="outlined" class="mb-6">
            <VCardTitle class="pa-4 d-flex align-center">
              <VIcon icon="mdi-file-document-edit-outline" class="me-2" color="primary" />
              解析摘要
            </VCardTitle>
            <VDivider />
            <VCardText class="pa-4">
              <div v-if="resume.parsed_data">
                <div class="mb-6">
                  <div class="text-subtitle-2 font-weight-bold mb-2">个人总结 / 核心优势</div>
                  <div class="summary-content text-body-1">
                    {{ decodeText(resume.parsed_data.summary) || '暂无总结内容' }}
                  </div>
                </div>

                <VRow>
                  <VCol cols="12" sm="6">
                    <div class="mb-4">
                      <div class="text-subtitle-2 font-weight-bold mb-1">教育背景</div>
                      <div class="text-body-2">{{ decodeText(resume.parsed_data.education) || '未解析' }}</div>
                    </div>
                  </VCol>
                  <VCol cols="12" sm="6">
                    <div class="mb-4">
                      <div class="text-subtitle-2 font-weight-bold mb-1">工作年限</div>
                      <div class="text-body-2">{{ resume.parsed_data.experience_years || '0' }} 年</div>
                    </div>
                  </VCol>
                </VRow>

                <div class="mb-0">
                  <div class="text-subtitle-2 font-weight-bold mb-2">技能关键词</div>
                  <div class="d-flex flex-wrap ga-2">
                    <VChip
                      v-for="skill in resume.parsed_data.skills || []"
                      :key="skill"
                      size="small"
                      variant="outlined"
                      color="primary"
                    >
                      {{ decodeText(skill) }}
                    </VChip>
                    <div v-if="!resume.parsed_data.skills?.length" class="text-caption text-disabled">未提取技能</div>
                  </div>
                </div>
              </div>
              <div v-else class="text-center py-8 text-medium-emphasis">
                <VIcon icon="mdi-alert-circle-outline" size="48" class="mb-2" />
                <div>暂无解析数据</div>
              </div>
            </VCardText>
          </VCard>

          <!-- 原始文本内容 -->
          <VCard variant="outlined">
            <VCardTitle class="pa-4 d-flex align-center">
              <VIcon icon="mdi-text-box-outline" class="me-2" color="primary" />
              原始文本内容
              <VSpacer />
              <VBtn
                variant="text"
                size="small"
                :append-icon="showRawText ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                @click="showRawText = !showRawText"
              >
                {{ showRawText ? '收起' : '展开' }}
              </VBtn>
            </VCardTitle>
            <VDivider v-if="showRawText" />
            <VExpandTransition>
              <div v-show="showRawText">
                <VCardText class="pa-4">
                  <pre class="raw-text-container text-body-2">{{ resume.raw_text || '暂无原始文本' }}</pre>
                </VCardText>
              </div>
            </VExpandTransition>
          </VCard>
        </VCol>

          <!-- 侧边栏信息 -->
        <VCol cols="12" md="4">
          <VCard variant="outlined" class="mb-6">
            <VCardTitle class="pa-4 d-flex align-center">
              <VIcon icon="mdi-account-circle-outline" class="me-2" color="primary" />
              基本信息
            </VCardTitle>
            <VDivider />
            <VList class="pa-2">
              <VListItem>
                <template #prepend>
                  <VIcon icon="mdi-account-outline" size="small" class="me-2" />
                </template>
                <VListItemTitle class="text-caption text-medium-emphasis">姓名</VListItemTitle>
                <VListItemSubtitle class="text-body-1 font-weight-bold text-high-emphasis">
                  {{ decodeText(resume.name || resume.parsed_data?.name) || '未知' }}
                </VListItemSubtitle>
              </VListItem>

              <VListItem>
                <template #prepend>
                  <VIcon icon="mdi-office-building-outline" size="small" class="me-2" />
                </template>
                <VListItemTitle class="text-caption text-medium-emphasis">所属企业</VListItemTitle>
                <VListItemSubtitle class="text-body-1 text-high-emphasis">
                  {{ resume.Company?.name || '个人上传' }}
                </VListItemSubtitle>
              </VListItem>

              <VListItem>
                <template #prepend>
                  <VIcon icon="mdi-calendar-clock-outline" size="small" class="me-2" />
                </template>
                <VListItemTitle class="text-caption text-medium-emphasis">上传时间</VListItemTitle>
                <VListItemSubtitle class="text-body-2 text-high-emphasis">
                  {{ formatDate(resume.upload_date) }}
                </VListItemSubtitle>
              </VListItem>

              <VListItem>
                <template #prepend>
                  <VIcon icon="mdi-briefcase-outline" size="small" class="me-2" />
                </template>
                <VListItemTitle class="text-caption text-medium-emphasis">关联职位</VListItemTitle>
                <div class="d-flex flex-wrap ga-1 mt-1">
                  <VChip
                    v-for="rj in resume.ResumeJobs"
                    :key="rj.id"
                    size="x-small"
                    variant="tonal"
                    color="primary"
                  >
                    {{ rj.Job?.title || '未知职位' }}
                  </VChip>
                  <div v-if="!resume.ResumeJobs?.length" class="text-caption text-disabled">暂无关联职位</div>
                </div>
              </VListItem>
            </VList>
          </VCard>

          <VCard variant="outlined">
            <VCardTitle class="pa-4 d-flex align-center">
              <VIcon icon="mdi-file-outline" class="me-2" color="primary" />
              文件信息
            </VCardTitle>
            <VDivider />
            <VList class="pa-2">
              <VListItem>
                <template #prepend>
                  <VIcon icon="mdi-file-document-outline" size="small" class="me-2" />
                </template>
                <VListItemTitle class="text-caption text-medium-emphasis">文件名</VListItemTitle>
                <VListItemSubtitle class="text-body-2 text-high-emphasis text-break">
                  {{ resume.file_name }}
                </VListItemSubtitle>
              </VListItem>

              <VListItem>
                <template #prepend>
                  <VIcon icon="mdi-weight-kilogram" size="small" class="me-2" />
                </template>
                <VListItemTitle class="text-caption text-medium-emphasis">文件大小</VListItemTitle>
                <VListItemSubtitle class="text-body-2 text-high-emphasis">
                  {{ (resume.file_size / 1024 / 1024).toFixed(2) }} MB
                </VListItemSubtitle>
              </VListItem>
            </VList>
          </VCard>
        </VCol>
      </VRow>
    </template>

    <div v-else class="text-center py-12">
      <VIcon icon="mdi-file-question-outline" size="64" color="disabled" class="mb-4" />
      <div class="text-h6 text-medium-emphasis">未找到简历信息</div>
    </div>
  </StandardPage>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resumeAPI } from '@/api'
import StandardPage from '@/components/StandardPage.vue'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const resume = ref(null)
const showRawText = ref(false)

/**
 * 格式化日期
 */
const formatDate = (date) => {
  if (!date) return '-'
  return format(new Date(date), 'yyyy-MM-dd HH:mm', { locale: zhCN })
}

/**
 * 解码/处理文本乱码问题
 * 处理 Unicode 转义字符以及可能的 JSON 字符串
 */
const decodeText = (text) => {
  if (text === null || text === undefined) return ''
  
  // 如果是对象，转为字符串（优先处理 summary 等字段）
  if (typeof text === 'object') {
    // 如果是数组，递归处理每个元素并用逗号连接
    if (Array.isArray(text)) {
      return text.map(item => decodeText(item)).join('、')
    }
    // 如果是普通对象，尝试获取可能的内容字段
    return text.content || text.text || JSON.stringify(text)
  }

  let decoded = String(text)

  try {
    // 1. 处理 Unicode 转义 (\uXXXX)
    if (decoded.includes('\\u')) {
      try {
        // 尝试通过 JSON.parse 解码
        const temp = JSON.parse('"' + decoded.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"')
        if (temp) decoded = temp
      } catch (e) {
        // 降级方案：正则替换
        decoded = decoded.replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => {
          return String.fromCharCode(parseInt(grp, 16))
        })
      }
    }

    // 2. 处理可能的双重转义
    if (decoded.includes('%')) {
      try {
        decoded = decodeURIComponent(decoded)
      } catch (e) {
        // 忽略解码失败
      }
    }

    // 3. 移除多余的引号（如果解析结果仍然带引号）
    if (decoded.startsWith('"') && decoded.endsWith('"')) {
      decoded = decoded.slice(1, -1)
    }

    return decoded
  } catch (error) {
    console.error('Text decoding error:', error)
    return text
  }
}

const goBack = () => {
  router.back()
}

const loadDetail = async () => {
  loading.value = true
  try {
    const { data } = await resumeAPI.getDetail(route.params.id)
    resume.value = data
  } catch (error) {
    console.error('Failed to load resume detail:', error)
  } finally {
    loading.value = false
  }
}

const openAttachment = () => {
  if (resume.value?.file_path) {
    // 统一处理路径
    let path = resume.value.file_path
    // 如果是相对路径且不以 uploads 开头，添加 uploads
    if (!path.startsWith('http') && !path.startsWith('/uploads') && !path.startsWith('uploads/')) {
      path = `/uploads/${path}`
    } else if (path.startsWith('uploads/')) {
      path = `/${path}`
    }
    window.open(path, '_blank')
  } else {
    alert('附件路径不存在')
  }
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.summary-content {
  line-height: 1.8;
  white-space: pre-wrap;
  color: #374151;
  font-size: 1rem;
}

.raw-text-container {
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 500px;
  overflow-y: auto;
  line-height: 1.6;
  color: #4b5563;
  background-color: #f9fafb;
  padding: 16px;
  border-radius: 8px;
}

:deep(.v-card) {
  border-color: #e5e7eb !important;
  border-radius: 12px !important;
  transition: all 0.3s ease;
}

:deep(.v-card:hover) {
  border-color: rgb(var(--v-theme-primary)) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
}

:deep(.v-card-title) {
  font-size: 1.1rem;
  font-weight: 600;
  padding: 16px 20px !important;
}

:deep(.v-list-item) {
  padding: 8px 16px !important;
}

:deep(.v-list-item-title) {
  margin-bottom: 4px !important;
  opacity: 0.7;
}

:deep(.v-list-item-subtitle) {
  opacity: 1 !important;
}

.ga-2 {
  gap: 8px !important;
}

.ga-1 {
  gap: 4px !important;
}
</style>
