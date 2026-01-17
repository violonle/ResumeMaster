<template>
  <StandardPage
    title="订阅计划"
    subtitle="管理系统的会员订阅套餐与配额"
  >
    <template #actions>
      <VBtn
        color="primary"
        prepend-icon="mdi-plus"
        height="40"
        @click="openCreate"
      >
        新增计划
      </VBtn>
    </template>

    <VCard
      elevation="0"
      border
    >
      <VDataTable
        :items="plans"
        :headers="headers"
        class="clean-table pa-2"
        hover
      >
        <template #item.name="{ item }">
          <div class="font-weight-medium">
            {{ item.name }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ item.key }}
          </div>
        </template>

        <template #item.price="{ item }">
          <div class="font-weight-bold text-primary">
            ¥{{ item.price }}
          </div>
        </template>

        <template #item.quota="{ item }">
          <div class="d-flex flex-column gap-1 py-2">
            <VChip
              size="x-small"
              variant="tonal"
              color="info"
              label
              class="justify-center"
              style="width: fit-content"
            >
              解析: {{ item.quota?.resume_parses_per_month ?? 0 }}/月
            </VChip>
            <VChip
              size="x-small"
              variant="tonal"
              color="warning"
              label
              class="justify-center"
              style="width: fit-content"
            >
              并发: {{ item.quota?.concurrent ?? 0 }}
            </VChip>
            <VChip
              size="x-small"
              variant="tonal"
              color="success"
              label
              class="justify-center"
              style="width: fit-content"
            >
              AI: {{ item.quota?.ai_calls ?? 0 }}
            </VChip>
          </div>
        </template>

        <template #item.status="{ item }">
          <VChip
            :color="item.status==='active' ? 'success' : 'grey'"
            size="small"
            variant="tonal"
            class="font-weight-medium"
            label
          >
            {{ item.status==='active' ? '启用' : '停用' }}
          </VChip>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex">
            <VTooltip
              text="编辑计划"
              location="top"
            >
              <template #activator="{ props }">
                <VBtn
                  icon
                  variant="text"
                  color="primary"
                  size="small"
                  class="me-1"
                  v-bind="props"
                  @click="openEdit(item)"
                >
                  <VIcon
                    icon="mdi-pencil-outline"
                    size="20"
                  />
                </VBtn>
              </template>
            </VTooltip>
            
            <VTooltip
              text="删除计划"
              location="top"
            >
              <template #activator="{ props }">
                <VBtn
                  icon
                  color="error"
                  variant="text"
                  size="small"
                  v-bind="props"
                  @click="remove(item)"
                >
                  <VIcon
                    icon="mdi-delete-outline"
                    size="20"
                  />
                </VBtn>
              </template>
            </VTooltip>
          </div>
        </template>

        <template #no-data>
          <div class="text-center pa-8">
            <VIcon
              icon="mdi-file-document-remove-outline"
              size="64"
              class="mb-4 text-disabled"
            />
            <div class="text-h6 text-medium-emphasis">
              暂无订阅计划
            </div>
            <div class="text-body-2 text-disabled mt-2">
              请点击右上角新增计划
            </div>
          </div>
        </template>
      </VDataTable>
    </VCard>

    <VDialog
      v-model="dialog"
      max-width="600"
      persistent
    >
      <VCard>
        <VCardTitle class="d-flex align-center pa-4">
          <span class="text-h6 font-weight-bold">{{ editing ? '编辑订阅计划' : '新增订阅计划' }}</span>
          <VSpacer />
          <VBtn
            icon="mdi-close"
            variant="text"
            size="small"
            @click="close"
          />
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VRow>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.key"
                label="标识（英文）"
                placeholder="例如: pro_monthly"
                hint="唯一标识符，不可重复"
                persistent-hint
                required
                variant="outlined"
                density="compact"
                :readonly="editing"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.name"
                label="计划名称"
                placeholder="例如: 专业版月付"
                required
                variant="outlined"
                density="compact"
              />
            </VCol>
            
            <VCol cols="12">
              <div class="text-subtitle-2 font-weight-bold mb-2 text-medium-emphasis">
                多语言名称
              </div>
              <VRow dense>
                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="form.i18n_names.zh"
                    label="中文名称"
                    prepend-inner-icon="mdi-translate"
                    variant="outlined"
                    density="compact"
                    hide-details="auto"
                  />
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="form.i18n_names.en"
                    label="英文名称"
                    prepend-inner-icon="mdi-translate"
                    variant="outlined"
                    density="compact"
                    hide-details="auto"
                  />
                </VCol>
              </VRow>
            </VCol>

            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model.number="form.price"
                label="价格"
                prefix="¥"
                type="number"
                min="0"
                variant="outlined"
                density="compact"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="form.status"
                :items="[
                  { title: '启用', value: 'active' },
                  { title: '停用', value: 'inactive' }
                ]"
                label="状态"
                variant="outlined"
                density="compact"
              />
            </VCol>

            <VCol cols="12">
              <VDivider class="mb-4" />
              <div class="text-subtitle-2 font-weight-bold mb-2 text-medium-emphasis">
                配额限制
              </div>
              <VRow dense>
                <VCol
                  cols="12"
                  sm="4"
                >
                  <VTextField
                    v-model.number="form.quota.resume_parses_per_month"
                    type="number"
                    label="简历解析/月"
                    min="0"
                    variant="outlined"
                    density="compact"
                    hide-details="auto"
                  />
                </VCol>
                <VCol
                  cols="12"
                  sm="4"
                >
                  <VTextField
                    v-model.number="form.quota.concurrent"
                    type="number"
                    label="并发请求数"
                    min="1"
                    variant="outlined"
                    density="compact"
                    hide-details="auto"
                  />
                </VCol>
                <VCol
                  cols="12"
                  sm="4"
                >
                  <VTextField
                    v-model.number="form.quota.ai_calls"
                    type="number"
                    label="AI调用次数"
                    min="0"
                    variant="outlined"
                    density="compact"
                    hide-details="auto"
                  />
                </VCol>
              </VRow>
            </VCol>

            <VCol cols="12">
              <VTextarea
                v-model="featuresText"
                label="特性列表"
                placeholder="输入特性描述，用英文逗号分隔"
                rows="3"
                hint="例如: 极速解析, 优先支持, 专属客服"
                persistent-hint
                variant="outlined"
                density="compact"
              />
            </VCol>
          </VRow>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn
            variant="text"
            color="medium-emphasis"
            class="px-4"
            @click="close"
          >
            取消
          </VBtn>
          <VBtn
            color="primary"
            class="px-6"
            variant="flat"
            @click="save"
          >
            保存
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useSubscriptionStore } from '@/stores/subscription'
import { subscriptionAPI } from '@/api'
import StandardPage from '@/components/StandardPage.vue'
import ui from '@/utils/ui-components.js'

const store = useSubscriptionStore()
const plans = ref([])
const dialog = ref(false)
const editing = ref(false)
const currentId = ref(null)

const form = ref({ key:'', name:'', i18n_names:{ zh:'', en:'' }, features:[], price:0, status:'active', quota:{ resume_parses_per_month:100, concurrent:1, ai_calls:10000 } })
const featuresText = ref('')
const headers = [
  { title:'计划信息', key:'name', align: 'start' },
  { title:'价格', key:'price', align: 'start' },
  { title:'配额限制', key:'quota', align: 'start', sortable: false },
  { title:'状态', key:'status', align: 'start' },
  { title:'操作', key:'actions', align: 'end', sortable:false },
]

const load = async () => {
  const res = await store.fetchSubscriptionPlans()
  plans.value = res || []
}

const fetchIdByKey = async (key) => {
  try {
    const res = await subscriptionAPI.getPlans()
    const list = res.data || []
    const found = list.find(p => p.key === key)
    return found?.id || null
  } catch (_) { return null }
}

const openCreate = () => { editing.value = false; currentId.value = null; form.value = { key:'', name:'', i18n_names:{ zh:'', en:'' }, features:[], price:0, status:'active', quota:{ resume_parses_per_month:100, concurrent:1, ai_calls:10000 } }; featuresText.value=''; dialog.value = true }
const resolvePlanId = (row) => {
  const item = row?.raw ?? row
  if (item?.id) return item.id
  if (item?.key) {
    const found = plans.value.find(p => p.key === item.key)
    if (found?.id) return found.id
  }
  if (item?.name) {
    const found = plans.value.find(p => p.name === item.name && (p.price ?? 0) === (item.price ?? 0))
    if (found?.id) return found.id
  }
  return null
}

const openEdit = (row) => {
  const item = row?.raw ?? row
  const id = resolvePlanId(item)
  editing.value = true
  currentId.value = id || null
  form.value = {
    id: id || null,
    key: item.key,
    name: item.name,
    i18n_names: item.i18n_names || { zh:'', en:'' },
    features: Array.isArray(item.features) ? item.features : [],
    price: item.price ?? 0,
    status: (typeof item.status === 'string' ? item.status : 'inactive'),
    quota: item.quota || { resume_parses_per_month:0, concurrent:0, ai_calls:0 }
  }
  featuresText.value = (form.value.features || []).join(',')
  dialog.value = true
}
const close = () => { dialog.value = false }
const save = async () => {
  const f = { ...form.value }
  const features = featuresText.value ? featuresText.value.split(',').map(s=>s.trim()).filter(Boolean) : []
  const qp = Number(f.quota?.resume_parses_per_month ?? 0)
  const qc = Number(f.quota?.concurrent ?? 1)
  const qa = Number(f.quota?.ai_calls ?? 0)
  const price = Number(f.price ?? 0)
  const key = String(f.key || '').trim()
  const name = String(f.name || '').trim()
  const status = f.status === 'inactive' ? 'inactive' : 'active'
  const payload = { key, name, i18n_names: f.i18n_names || { zh:'', en:'' }, features, price, status, quota: { resume_parses_per_month: qp, concurrent: qc, ai_calls: qa } }

  if (!key || !name) { ui.showAlert('请填写完整的标识与名称', { type: 'warning' }); return }
  if (qp < 0 || qc < 1 || qa < 0 || price < 0) { ui.showAlert('请输入合法的配额与价格', { type: 'warning' }); return }

  try {
    if (editing.value) {
      const id = await fetchIdByKey(form.value.key)
      if (id) {
        await store.updatePlan(Number(id), payload)
      } else {
        await store.createPlan(payload)
      }
    } else {
      await store.createPlan(payload)
    }
    dialog.value = false
    await load()
  } catch (error) {
    const msg = (error?.response?.data?.message) || (error?.response?.data?.error) || error?.message || '保存失败'
    ui.showAlert(msg, { type: 'error' })
  }
}
const remove = async (row) => {
  const item = row?.raw ?? row
  ui.showConfirm(`确定要删除计划 "${item.name}" 吗？`, async () => {
    const id = await fetchIdByKey(item?.key)
    if (id) {
      await store.deletePlan(Number(id))
    } else {
      ui.showAlert('未找到对应计划ID，无法删除，请刷新后重试', { type: 'error' })
    }
    await load()
  }, null, { type: 'danger', title: '删除确认' })
}

onMounted(load)
</script>

<style scoped>
.gap-1 { gap: 4px; }
</style>
