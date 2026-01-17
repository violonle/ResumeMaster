<template>
  <StandardPage
    title="仪表板"
    subtitle="欢迎使用争湃·简历大师后台管理系统"
  >
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
          <VCardText class="d-flex align-center pa-6">
            <VAvatar
              rounded="lg"
              color="primary"
              variant="tonal"
              size="56"
              class="me-4"
            >
              <VIcon
                icon="mdi-file-document-multiple"
                size="28"
              />
            </VAvatar>
            <div>
              <div class="text-h4 font-weight-bold mb-1">
                {{ dashboardStore.stats.totalResumes || 0 }}
              </div>
              <div class="text-body-2 text-medium-emphasis font-weight-medium">
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
          <VCardText class="d-flex align-center pa-6">
            <VAvatar
              rounded="lg"
              color="info"
              variant="tonal"
              size="56"
              class="me-4"
            >
              <VIcon
                icon="mdi-briefcase-variant"
                size="28"
              />
            </VAvatar>
            <div>
              <div class="text-h4 font-weight-bold mb-1">
                {{ dashboardStore.stats.totalJobs || 0 }}
              </div>
              <div class="text-body-2 text-medium-emphasis font-weight-medium">
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
          <VCardText class="d-flex align-center pa-6">
            <VAvatar
              rounded="lg"
              color="success"
              variant="tonal"
              size="56"
              class="me-4"
            >
              <VIcon
                icon="mdi-office-building"
                size="28"
              />
            </VAvatar>
            <div>
              <div class="text-h4 font-weight-bold mb-1">
                {{ dashboardStore.stats.totalCompanies || 0 }}
              </div>
              <div class="text-body-2 text-medium-emphasis font-weight-medium">
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
          <VCardText class="d-flex align-center pa-6">
            <VAvatar
              rounded="lg"
              color="warning"
              variant="tonal"
              size="56"
              class="me-4"
            >
              <VIcon
                icon="mdi-credit-card"
                size="28"
              />
            </VAvatar>
            <div>
              <div class="text-h4 font-weight-bold mb-1">
                {{ dashboardStore.stats.activeSubscriptions || 0 }}
              </div>
              <div class="text-body-2 text-medium-emphasis font-weight-medium">
                活跃订阅
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 图表和活动 -->
    <VRow>
      <!-- 用户增长图表 -->
      <VCol
        cols="12"
        lg="8"
      >
        <VCard class="h-100">
          <VCardItem class="pa-6 pb-2">
            <VCardTitle class="text-h6 font-weight-bold">
              用户增长趋势
            </VCardTitle>
          </VCardItem>
          <VCardText class="pa-6 pt-2">
            <div
              v-if="dashboardStore.loading"
              class="d-flex justify-center align-center py-10"
            >
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <div
              v-else-if="!userGrowthSeries.length"
              class="text-center text-medium-emphasis py-10"
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

      <!-- 最近活动 -->
      <VCol
        cols="12"
        lg="4"
      >
        <VCard class="h-100">
          <VCardItem class="pa-6 pb-2">
            <VCardTitle class="text-h6 font-weight-bold">
              最近活动
            </VCardTitle>
          </VCardItem>
          <VCardText class="pa-0">
            <VList
              v-if="dashboardStore.recentActivities && dashboardStore.recentActivities.length"
              lines="two"
              class="pa-2"
            >
              <VListItem
                v-for="activity in dashboardStore.recentActivities"
                :key="activity.id"
                rounded="lg"
                class="mb-1"
              >
                <template #prepend>
                  <VAvatar
                    size="40"
                    :color="getActivityColor(activity.type)"
                    variant="tonal"
                    rounded="lg"
                  >
                    <VIcon
                      :icon="getActivityIcon(activity.type)"
                      size="20"
                    />
                  </VAvatar>
                </template>
                
                <VListItemTitle class="font-weight-medium text-body-2">
                  {{ activity.title }}
                </VListItemTitle>
                <VListItemSubtitle>
                  <div class="text-caption mt-1">
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
              class="text-center pa-10"
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

    <!-- 订阅分布 -->
    <VRow class="mt-6">
      <VCol
        cols="12"
        lg="6"
      >
        <VCard class="h-100">
          <VCardItem class="pa-6 pb-2">
            <VCardTitle class="text-h6 font-weight-bold">
              订阅分布
            </VCardTitle>
          </VCardItem>
          <VCardText class="pa-6 pt-2">
            <div v-if="dashboardStore.loading">
              图表加载中...
            </div>
            <div v-else-if="!subscriptionSeries.length">
              暂无数据
            </div>
            <VueApexCharts
              v-else
              type="donut"
              height="300"
              :options="subscriptionChartOptions"
              :series="subscriptionSeries"
            />
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        lg="6"
      >
        <VCard title="收入趋势">
          <VCardText>
            <div v-if="dashboardStore.loading">
              图表加载中...
            </div>
            <div v-else-if="!revenueSeries.length">
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
        lg="6"
      >
        <VCard title="AI模型调用量">
          <VCardText>
            <div v-if="dashboardStore.loading">
              图表加载中...
            </div>
            <div v-else-if="!aiUsageSeries.length">
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
    </div>
  </standardpage>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import VueApexCharts from 'vue3-apexcharts'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const dashboardStore = useDashboardStore()

const chartOptions = ref({
  chart: {
    type: 'line',
    height: 350,
    toolbar: { show: false },
  },
  stroke: {
    curve: 'smooth',
    width: 3,
  },
  markers: {
    size: 5,
  },
  xaxis: {
    type: 'datetime',
  },
  yaxis: {
    title: {
      text: '用户数量',
    },
  },
  colors: ['#3B82F6'],
})

const userGrowthSeries = computed(() => {
  const data = dashboardStore.chartData.userGrowth?.map(item => [item.date, item.count]) || []
  return data.length > 0 ? [{
    name: '用户数量',
    data: data
  }] : []
})

const subscriptionChartOptions = ref({
  chart: {
    type: 'donut',
    height: 300,
  },
  labels: ['免费版', '专业版', '企业版'],
  colors: ['#10B981', '#F59E0B', '#3B82F6'],
  legend: {
    position: 'bottom',
  },
})

const subscriptionSeries = computed(() => 
  dashboardStore.chartData.subscriptionDistribution?.map(item => item.count) || []
)

const revenueChartOptions = ref({
  chart: {
    type: 'area',
    height: 300,
    toolbar: { show: false },
  },
  stroke: {
    curve: 'smooth',
    width: 2,
  },
  xaxis: {
    type: 'datetime',
  },
  yaxis: {
    title: {
      text: '收入 (¥)',
    },
  },
  colors: ['#8B5CF6'],
})

const revenueSeries = computed(() => {
  const data = dashboardStore.chartData.revenueTrend?.map(item => [item.date, item.amount]) || []
  return data.length > 0 ? [{
    name: '收入',
    data: data
  }] : []
})

const aiUsageChartOptions = ref({
  chart: { type: 'bar', height: 300, animations: { enabled: true, easing: 'easeinout', speed: 600 } },
  plotOptions: { bar: { columnWidth: '45%', distributed: true } },
  xaxis: { categories: (dashboardStore.chartData.aiUsage||[]).map(i => i.model) },
  colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'],
})

const aiUsageSeries = computed(() => {
  const data = dashboardStore.chartData.aiUsage?.map(item => item.calls) || []
  return data.length > 0 ? [{ name: '调用量', data }] : []
})

const getActivityColor = (type) => {
  const colors = {
    user: 'primary',
    company: 'success',
    subscription: 'warning',
    system: 'info',
    ai: 'secondary',
  }
  return colors[type] || 'primary'
}

const getActivityIcon = (type) => {
  const icons = {
    user: 'mdi-account',
    company: 'mdi-office-building',
    subscription: 'mdi-credit-card',
    system: 'mdi-cog',
    ai: 'mdi-robot',
  }
  return icons[type] || 'mdi-information'
}

const formatTime = (date) => {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: zhCN })
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
