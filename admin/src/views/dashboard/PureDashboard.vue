<template>
  <StandardPage
    title="仪表板"
    subtitle="欢迎使用争湃·简历大师管理后台"
  >
    <template #actions>
      <VBtn
        color="primary"
        prepend-icon="mdi-plus"
        @click="handleCreate"
      >
        新建项目
      </VBtn>
    </template>

    <!-- 统计卡片 -->
    <VRow class="mb-6">
      <VCol
        cols="12"
        md="3"
        sm="6"
      >
        <VCard
          class="h-100"
          :loading="dashboardStore.loading"
        >
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded="lg"
              color="primary"
              variant="tonal"
              size="48"
              class="me-4"
            >
              <VIcon
                icon="mdi-file-document-multiple"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">
                {{ dashboardStore.stats.totalResumes || 0 }}
              </div>
              <div class="text-caption text-medium-emphasis">
                总简历数
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="3"
        sm="6"
      >
        <VCard
          class="h-100"
          :loading="dashboardStore.loading"
        >
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded="lg"
              color="info"
              variant="tonal"
              size="48"
              class="me-4"
            >
              <VIcon
                icon="mdi-briefcase-variant"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">
                {{ dashboardStore.stats.totalJobs || 0 }}
              </div>
              <div class="text-caption text-medium-emphasis">
                总职位数
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="3"
        sm="6"
      >
        <VCard
          class="h-100"
          :loading="dashboardStore.loading"
        >
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded="lg"
              color="success"
              variant="tonal"
              size="48"
              class="me-4"
            >
              <VIcon
                icon="mdi-office-building"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">
                {{ dashboardStore.stats.totalCompanies || 0 }}
              </div>
              <div class="text-caption text-medium-emphasis">
                企业数量
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="3"
        sm="6"
      >
        <VCard
          class="h-100"
          :loading="dashboardStore.loading"
        >
          <VCardText class="d-flex align-center pa-4">
            <VAvatar
              rounded="lg"
              color="warning"
              variant="tonal"
              size="48"
              class="me-4"
            >
              <VIcon
                icon="mdi-credit-card"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">
                {{ dashboardStore.stats.activeSubscriptions || 0 }}
              </div>
              <div class="text-caption text-medium-emphasis">
                活跃订阅
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 图表与活动 -->
    <VRow>
      <VCol
        cols="12"
        lg="8"
      >
        <VCard title="用户增长趋势">
          <VCardText>
            <div
              v-if="dashboardStore.loading"
              class="d-flex justify-center align-center py-8"
            >
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <div
              v-else-if="!userGrowthSeries.length"
              class="text-center pa-8 text-medium-emphasis"
            >
              暂无数据
            </div>
            <VueApexCharts
              v-else
              type="line"
              height="350"
              :options="chartOptions"
              :series="userGrowthSeries"
            />
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        lg="4"
      >
        <VCard title="最近活动">
          <VCardText>
            <VList
              v-if="dashboardStore.recentActivities && dashboardStore.recentActivities.length"
              lines="two"
              class="pa-0"
            >
              <VListItem
                v-for="activity in dashboardStore.recentActivities"
                :key="activity.id"
                class="px-0"
              >
                <template #prepend>
                  <VAvatar
                    size="40"
                    :color="getActivityColor(activity.type)"
                    variant="tonal"
                    class="me-3"
                  >
                    <VIcon
                      :icon="getActivityIcon(activity.type)"
                      size="20"
                    />
                  </VAvatar>
                </template>
                <VListItemTitle class="font-weight-medium">
                  {{ activity.title }}
                </VListItemTitle>
                <VListItemSubtitle>
                  <div class="text-caption">
                    {{ activity.description }}
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    {{ formatTime(activity.createdAt) }}
                  </div>
                </VListItemSubtitle>
              </VListItem>
            </VList>
            <div
              v-else
              class="text-center pa-8"
            >
              <VIcon
                icon="mdi-information-outline"
                size="48"
                class="mb-4 text-disabled"
              />
              <div class="text-body-1 text-medium-emphasis">
                暂无活动记录
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 订阅分布与收入趋势、AI调用量 -->
    <VRow class="mt-2">
      <VCol
        cols="12"
        lg="4"
      >
        <VCard
          title="订阅分布"
          class="h-100"
        >
          <VCardText>
            <div
              v-if="dashboardStore.loading"
              class="d-flex justify-center align-center py-8"
            >
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <div
              v-else-if="!subscriptionSeries.length"
              class="text-center pa-8 text-medium-emphasis"
            >
              暂无数据
            </div>
            <VueApexCharts
              v-else
              type="donut"
              height="300"
              :options="{...subscriptionChartOptions, labels: subscriptionLabels}"
              :series="subscriptionSeries"
            />
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        cols="12"
        lg="4"
      >
        <VCard
          title="收入趋势"
          class="h-100"
        >
          <VCardText>
            <div
              v-if="dashboardStore.loading"
              class="d-flex justify-center align-center py-8"
            >
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <div
              v-else-if="!revenueSeries.length"
              class="text-center pa-8 text-medium-emphasis"
            >
              暂无数据
            </div>
            <VueApexCharts
              v-else
              type="area"
              height="300"
              :options="revenueChartOptions"
              :series="revenueSeries"
            />
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        cols="12"
        lg="4"
      >
        <VCard
          title="AI模型调用量"
          class="h-100"
        >
          <VCardText>
            <div
              v-if="dashboardStore.loading"
              class="d-flex justify-center align-center py-8"
            >
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <div
              v-else-if="!aiUsageSeries.length"
              class="text-center pa-8 text-medium-emphasis"
            >
              暂无数据
            </div>
            <VueApexCharts
              v-else
              type="bar"
              height="300"
              :options="aiUsageChartOptions"
              :series="aiUsageSeries"
            />
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </StandardPage>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useDashboardStore } from '@/stores/dashboard'
import StandardPage from '@/components/StandardPage.vue'

const dashboardStore = useDashboardStore()

const handleCreate = () => {
  // TODO: Implement create project logic
  console.log('Create project clicked')
}

const chartOptions = ref({ chart:{ type:'line', height:350, toolbar:{ show:false }, fontFamily: 'inherit' }, stroke:{ curve:'smooth', width:3 }, markers:{ size:5 }, xaxis:{ type:'datetime' }, yaxis:{ title:{ text:'增长趋势' } }, colors:['#3B82F6'], grid: { borderColor: '#f3f4f6' } })
const userGrowthSeries = computed(() => { const data = (dashboardStore.chartData.userGrowth||[]).map(item => [item.date, item.count || 0]); return data.length ? [{ name:'数量', data }] : [] })
const subscriptionChartOptions = ref({ chart:{ type:'donut', height:300, fontFamily: 'inherit' }, labels:[], colors:['#10B981','#F59E0B','#3B82F6','#EF4444','#8B5CF6','#06B6D4'], legend:{ position:'bottom' }, plotOptions: { pie: { donut: { size: '70%' } } } })
const subscriptionLabels = computed(() => (dashboardStore.chartData.subscriptionDistribution||[]).map(item => item.name))
const subscriptionSeries = computed(() => (dashboardStore.chartData.subscriptionDistribution||[]).map(item => item.count))
const revenueChartOptions = ref({ chart:{ type:'area', height:300, toolbar:{ show:false }, fontFamily: 'inherit' }, stroke:{ curve:'smooth', width:2 }, xaxis:{ type:'datetime' }, yaxis:{ title:{ text:'收入 (¥)' } }, colors:['#8B5CF6'], fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.9, stops: [0, 90, 100] } }, grid: { borderColor: '#f3f4f6' } })
const revenueSeries = computed(() => { const data = (dashboardStore.chartData.revenueTrend||[]).map(item => [item.date, Number(item.amount || 0)]); return data.length ? [{ name:'收入', data }] : [] })
const aiUsageChartOptions = ref({ chart:{ type:'bar', height:300, fontFamily: 'inherit', toolbar: { show: false }, animations:{ enabled:true, easing:'easeinout', speed:600 } }, plotOptions:{ bar:{ columnWidth:'45%', distributed:true, borderRadius: 4 } }, xaxis:{ categories:(dashboardStore.chartData.aiUsage||[]).map(i=>i.model) }, colors:['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4'], grid: { borderColor: '#f3f4f6' } })
const aiUsageSeries = computed(() => { const data = (dashboardStore.chartData.aiUsage||[]).map(item => item.calls || 0); return data.length ? [{ name:'调用量', data }] : [] })

const getActivityColor = (type) => ({ user:'primary', company:'success', subscription:'warning', system:'info', ai:'secondary' }[type] || 'primary')
const getActivityIcon = (type) => ({ user:'mdi-account', company:'mdi-office-building', subscription:'mdi-credit-card', system:'mdi-cog', ai:'mdi-robot' }[type] || 'mdi-information')
const formatTime = (date) => {
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? '未知时间' : formatDistanceToNow(d, { addSuffix: true, locale: zhCN })
}

onMounted(async () => {
  await Promise.all([
    dashboardStore.fetchChartData('userGrowth'),
    dashboardStore.fetchChartData('subscriptionDistribution'),
    dashboardStore.fetchChartData('revenueTrend'),
    dashboardStore.fetchChartData('aiUsage'),
  ])
  await dashboardStore.fetchStats()
  await dashboardStore.fetchRecentActivities()
})
</script>

<style scoped>
.v-card-text {
  position: relative;
}
</style>
