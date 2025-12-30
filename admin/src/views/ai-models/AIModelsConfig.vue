<template>
  <StandardPage title="大模型管理" subtitle="配置AI模型提供商及策略">
    <template #actions>
      <VBtn
        v-if="activeTab === 'models'"
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreateModel"
      >
        新建模型
      </VBtn>
      <VBtn
        v-else
        color="primary"
        prepend-icon="mdi-content-save"
        @click="saveScenes"
      >
        保存场景配置
      </VBtn>
    </template>

    <VCard elevation="0" border>
      <VTabs v-model="activeTab" color="primary">
        <VTab value="models">模型列表</VTab>
        <VTab value="strategies">策略配置</VTab>
        <VTab value="prompts">提示词管理</VTab>
      </VTabs>
      <VDivider />
      <VWindow v-model="activeTab">
        <VWindowItem value="models">
          <div class="d-flex align-center pa-4 gap-4 border-b">
            <div style="width: 300px">
              <VTextField
                v-model="searchModel"
                prepend-inner-icon="mdi-magnify"
                label="搜索模型提供商"
                single-line
                hide-details
                density="compact"
                variant="outlined"
                clearable
              />
            </div>
            <VSpacer />
          </div>
          <VDataTable
            :headers="modelHeaders"
            :items="providerRows"
            :items-per-page="10"
            :search="searchModel"
            hover
            class="clean-table"
            style="width: 100%"
          >
            <template #item.name="{ item }">
              {{ item.displayName || item.name }}
            </template>
            <template #item.apiKey="{ item }">
              <span class="text-medium-emphasis">{{ maskKey(item.apiKey) }}</span>
            </template>
            <template #item.enabled="{ item }">
              <VSwitch
                density="compact"
                :model-value="item.enabled"
                @update:model-value="val => toggleProviderEnabled(item.name, val)"
                color="primary"
                hide-details
                inset
              />
            </template>
          <template #item.actions="{ item }">
            <div class="d-flex justify-end">
              <VBtn
                icon
                size="small"
                variant="text"
                color="primary"
                class="me-1"
                @click="openProviderDialog(item)"
              >
                <VIcon icon="mdi-pencil-outline" size="20" />
                <VTooltip activator="parent" location="top">编辑配置</VTooltip>
              </VBtn>
              
              <VBtn
                icon
                size="small"
                variant="text"
                color="error"
                @click="deleteProviderItem(item)"
              >
                <VIcon icon="mdi-delete-outline" size="20" />
                <VTooltip activator="parent" location="top">删除提供商</VTooltip>
              </VBtn>
            </div>
          </template>
            <template #top>
              <div class="pa-4 bg-grey-lighten-5 text-body-2 text-medium-emphasis">
                <VIcon icon="mdi-information-outline" size="small" class="me-2" />
                已预置提供商：{{ presetPlatforms.join('、') }}。可同时启用多个。
              </div>
              <VDivider />
            </template>
            <template #no-data>
              <div class="text-center pa-8">
                <VIcon icon="mdi-robot-off" size="64" class="mb-4 text-disabled" />
                <div class="text-h6 text-medium-emphasis">暂无模型数据</div>
                <div class="text-body-2 text-disabled mt-2">请点击右上角新建模型</div>
              </div>
            </template>
          </VDataTable>
        </VWindowItem>

        <VWindowItem value="strategies">
          <div class="pa-4">
            <div class="text-subtitle-1 mb-2 font-weight-bold">场景配置</div>
            <VExpansionPanels multiple variant="accordion">
              <VExpansionPanel
                v-for="scene in scenes"
                :key="scene.key"
                elevation="0"
                class="border"
              >
                <VExpansionPanelTitle>{{ scene.title }}</VExpansionPanelTitle>
                <VExpansionPanelText>
                  <VRow class="mt-1">
                    <VCol cols="12" md="6">
                      <VSelect
                        :key="'provider-'+scene.key"
                        v-model="sceneForm.models[scene.key].provider"
                        :items="configuredProviderItems"
                        item-title="title"
                        item-value="value"
                        label="平台"
                        variant="outlined"
                        density="compact"
                      />
                    </VCol>
                    <VCol cols="12" md="6">
                      <VSelect
                        :key="'model-'+scene.key"
                        v-model="sceneForm.models[scene.key].model"
                        :items="configuredModelItems(sceneForm.models[scene.key].provider)"
                        item-title="title"
                        item-value="value"
                        label="模型"
                        variant="outlined"
                        density="compact"
                        :disabled="!sceneForm.models[scene.key].provider"
                      />
                    </VCol>
                  </VRow>
                </VExpansionPanelText>
              </VExpansionPanel>
            </VExpansionPanels>
          </div>
        </VWindowItem>

        <VWindowItem value="prompts">
          <PromptManager />
        </VWindowItem>
      </VWindow>
    </VCard>

    <!-- Dialogs -->
    <VDialog v-model="providerDialog" max-width="560px">
      <VCard>
        <VCardTitle class="pa-4">
          配置 {{ providerForm.provider }}
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VRow>
            <VCol cols="12">
              <VSwitch
                v-model="providerForm.enabled"
                label="启用此提供商"
                color="primary"
                inset
                hide-details
              />
            </VCol>
            <VCol cols="12" md="6">
              <VSelect
                v-model="providerForm.provider"
                :items="presetPlatforms"
                label="大模型平台"
                variant="outlined"
                density="compact"
                clearable
              />
            </VCol>
            <VCol cols="12" md="6">
              <VTextField
                v-model="providerForm.model"
                label="模型名称"
                variant="outlined"
                density="compact"
                :disabled="!providerForm.provider"
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="providerForm.apiKey"
                label="API Key"
                variant="outlined"
                density="compact"
                :placeholder="providerForm.apiKey && providerForm.apiKey.includes('*') ? '输入新密钥以更新' : 'API Key'"
                type="password"
              />
            </VCol>
          </VRow>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn variant="text" @click="providerDialog = false">取消</VBtn>
          <VBtn color="primary" @click="saveProvider" :loading="saving">保存</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="createModelDialog" max-width="560px">
      <VCard>
        <VCardTitle class="pa-4">新建大模型</VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VRow>
            <VCol cols="12" md="6">
              <VSelect
                v-model="createModelForm.provider"
                :items="presetPlatforms"
                label="大模型平台"
                variant="outlined"
                density="compact"
                clearable
              />
            </VCol>
            <VCol cols="12" md="6">
              <VTextField
                v-model="createModelForm.model"
                label="模型名称"
                variant="outlined"
                density="compact"
                :disabled="!createModelForm.provider"
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="createModelForm.apiKey"
                label="API Key"
                variant="outlined"
                density="compact"
                type="password"
              />
            </VCol>
            <VCol cols="12">
              <VSwitch
                v-model="createModelForm.enabled"
                label="立即启用"
                color="primary"
                inset
                hide-details
              />
            </VCol>
          </VRow>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn variant="text" @click="createModelDialog = false">取消</VBtn>
          <VBtn color="primary" @click="createModel" :loading="saving">创建</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="strategyDialog" max-width="800px">
      <VCard>
        <VCardTitle class="pa-4">
          {{ editingStrategy ? '编辑策略组' : '新建策略组' }}
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VRow>
            <VCol cols="12" md="6">
              <VTextField
                v-model="strategyForm.name"
                label="策略组名称"
                variant="outlined"
                density="compact"
                :disabled="isDefaultStrategy(strategyForm.id) || (editingStrategy && isDefaultStrategy(editingStrategy.id))"
              />
            </VCol>
            <VCol cols="12" md="6">
              <VTextField
                v-model="strategyForm.id"
                label="策略组ID"
                variant="outlined"
                density="compact"
                :disabled="isDefaultStrategy(strategyForm.id)"
              />
            </VCol>
            <VCol v-if="!isDefaultStrategy(strategyForm.id)" cols="12">
              <VAutocomplete
                v-model="strategyForm.scope"
                v-model:search="companySearch"
                :items="companyOptions"
                label="适用范围（公司）"
                variant="outlined"
                density="compact"
                multiple
                chips
                closable-chips
                item-title="name"
                item-value="id"
                clearable
                :loading="loadingCompanies"
                @update:search="searchCompanies"
              />
            </VCol>
            <VCol cols="12">
              <div class="text-subtitle-1 mb-2 font-weight-bold">场景配置</div>
              <VExpansionPanels multiple variant="accordion">
                <VExpansionPanel
                  v-for="scene in scenes"
                  :key="scene.key"
                  elevation="0"
                  class="border"
                >
                  <VExpansionPanelTitle>{{ scene.title }}</VExpansionPanelTitle>
                  <VExpansionPanelText>
                    <VRow class="mt-1">
                      <VCol cols="12" md="6">
                        <VSelect
                          :key="'provider-'+scene.key"
                          v-model="strategyForm.models[scene.key].provider"
                          :items="configuredProviderItems"
                          item-title="title"
                          item-value="value"
                          label="平台"
                          variant="outlined"
                          density="compact"
                        />
                      </VCol>
                      <VCol cols="12" md="6">
                        <VSelect
                          :key="'model-'+scene.key"
                          v-model="strategyForm.models[scene.key].model"
                          :items="configuredModelItems(strategyForm.models[scene.key].provider)"
                          item-title="title"
                          item-value="value"
                          label="模型"
                          variant="outlined"
                          density="compact"
                          :disabled="!strategyForm.models[scene.key].provider"
                        />
                      </VCol>
                    </VRow>
                  </VExpansionPanelText>
                </VExpansionPanel>
              </VExpansionPanels>
            </VCol>
          </VRow>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn variant="text" @click="strategyDialog = false">取消</VBtn>
          <VBtn color="primary" @click="saveStrategy" :loading="saving">保存</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, onMounted, computed, reactive } from 'vue'
import { aiModelAPI, companyAPI } from '@/api'
import StandardPage from '@/components/StandardPage.vue'
import PromptManager from './PromptManager.vue'
import ui from '@/utils/ui-components.js'

const loading = ref(false)
const saving = ref(false)
const searchModel = ref('')
const searchStrategy = ref('')
const aiConfig = ref({ providers: {}, taskMapping: {}, strategies: {} })
const activeTab = ref('models')
const providersList = ref([])
const providersRegistry = ref([])
const providerDialog = ref(false)
const providerForm = ref({ provider: '', enabled: false, apiKey: '', model: '' })
const createModelDialog = ref(false)
const createModelForm = ref({ provider: '', model: '', apiKey: '', enabled: true })
const createModelOptions = ref([])
const availableModels = ref([])

const platforms = computed(() => {
  return (aiConfig.value.strategies?.platforms || []).map(p => p.name)
})
const presetPlatforms = computed(() => {
  const base = ['SILICONFLOW', 'GLM', 'QWEN', 'DEEPSEEK']
  const extra = platforms.value || []
  return Array.from(new Set([...base, ...extra]))
})

const canonicalProviderKey = (name) => {
  const s = String(name || '').trim().toUpperCase()
  const map = {
    'QWEN':'QWEN','通义千问':'QWEN','QIANWEN':'QWEN','千问':'QWEN','阿里云百炼':'QWEN',
    'GLM':'GLM','ZHIPUAI':'GLM','智谱':'GLM','CHATGLM':'GLM','质谱AI':'GLM',
    'SILICONFLOW':'SILICONFLOW','硅基流动':'SILICONFLOW',
    'DEEPSEEK':'DEEPSEEK'
  }
  return map[s] || s
}

const baseKey = (name) => String(name || '').toUpperCase().split('_')[0]
const ensureUniqueKey = (providerName) => {
  const base = canonicalProviderKey(providerName)
  const keys = Object.keys(aiConfig.value.providers || {})
  const same = keys.filter(k => baseKey(k) === base)
  if (same.length === 0) return base
  let idx = 2
  let candidate = `${base}_${idx}`
  while (keys.includes(candidate)) { idx += 1; candidate = `${base}_${idx}` }
  return candidate
}

const reloadAIConfig = async () => {
  loading.value = true
  try {
    const res = await aiModelAPI.getAIConfig()
    const data = res.data?.data || res.data || {}
    aiConfig.value = data || { providers: {}, taskMapping: {}, strategies: {} }
    
    const pv = aiConfig.value.providers || {}
    const backendKeys = Object.keys(pv)
    
    // 保持现有的 providersList，只更新状态
    const newProvidersList = backendKeys.map((name) => {
      const remoteConf = pv[name] || {}
      const models = Array.isArray(remoteConf.models) ? remoteConf.models : (remoteConf.model ? [remoteConf.model] : [])
      return { 
        name, 
        enabled: !!remoteConf.enabled, 
        apiKey: remoteConf.apiKey || '', 
        model: remoteConf.model || '', 
        models 
      }
    })
    providersList.value = newProvidersList

    const tm = aiConfig.value.taskMapping || {}
    const a = tm['analysis'] || tm['resume_analysis'] || tm['resume_compare'] || {}
    const next = {
      analysis: { provider: a.provider || '', model: a.model || '' },
      chat: { provider: tm['chat']?.provider || '', model: tm['chat']?.model || '' }
    }
    sceneForm.value = { models: next }
  } finally {
    loading.value = false
  }
}

const toggleProviderEnabled = async (name, val) => {
  try {
    const key = canonicalProviderKey(name)
    if (!key) return
    await aiModelAPI.updateAIConfig({ providers: { [key]: { enabled: !!val } } })
    const p = providersList.value.find(x => x.name === name)
    if (p) p.enabled = !!val
  } catch {
    await reloadAIConfig()
  }
}

const openProviderDialog = (provider) => {
  providerForm.value.provider = provider.name
  providerForm.value.enabled = provider.enabled
  providerForm.value.apiKey = provider.apiKey
  providerForm.value.model = provider.model
  providerForm.value.models = Array.isArray(provider.models) ? [...provider.models] : (provider.model ? [provider.model] : [])
  providerDialog.value = true
  loadProviderDialogModels(provider.name)
}

const updateProviderModels = (val) => {
  // 当从远程加载完模型列表，或者用户选择了某个模型时，确保 providersList 同步更新
  const p = providersList.value.find(x => x.name === providerForm.value.provider)
  if (p) {
    p.models = Array.from(new Set([...(p.models || []), ...val]))
  }
}

const saveProvider = async () => {
  saving.value = true
  try {
    const key = canonicalProviderKey(providerForm.value.provider)
    if (!key) return
    const patch = { providers: { [key]: { enabled: providerForm.value.enabled, models: Array.isArray(providerForm.value.models) ? providerForm.value.models : (providerForm.value.model ? [providerForm.value.model] : []) } } }
    const apiKeyVal = providerForm.value.apiKey
    if (typeof apiKeyVal === 'string' && !apiKeyVal.includes('*') && apiKeyVal.trim() !== '') {
      patch.providers[key].apiKey = apiKeyVal
    }
    if (providerForm.value.model) {
      patch.providers[key].model = providerForm.value.model
    }
    await aiModelAPI.updateAIConfig(patch)
    providerDialog.value = false
    await reloadAIConfig()
  } finally {
    saving.value = false
  }
}

const loadProviderDialogModels = async (provider) => {
  if (!provider) { availableModels.value = []; return }
  try {
    const res = await aiModelAPI.listProviderModels(provider)
    const models = (res?.data?.data) || []
    availableModels.value = models
    
    // 同步到 providersList 中，以便策略配置能选到
    const p = providersList.value.find(x => x.name === provider)
    if (p) {
      p.models = Array.from(new Set([...(p.models || []), ...models]))
    }
  } catch { availableModels.value = [] }
}

const openCreateModel = () => { createModelForm.value = { provider:'', model:'', apiKey:'', enabled:true }; createModelOptions.value = []; createModelDialog.value = true }
const loadModelsForProvider = async (provider) => {
  if (!provider) { createModelOptions.value = []; return }
  try {
    const res = await aiModelAPI.listProviderModels(provider)
    const models = (res?.data?.data) || []
    createModelOptions.value = models
  } catch { createModelOptions.value = [] }
}
const createModel = async () => {
  saving.value = true
  try {
    const key = ensureUniqueKey(createModelForm.value.provider)
    if (!key) return
    const patch = { providers: { [key]: { enabled: !!createModelForm.value.enabled } } }
    if (createModelForm.value.apiKey && !createModelForm.value.apiKey.includes('*')) patch.providers[key].apiKey = createModelForm.value.apiKey
    if (createModelForm.value.model) patch.providers[key].model = createModelForm.value.model
    await aiModelAPI.updateAIConfig(patch)
    createModelDialog.value = false
    await reloadAIConfig()
  } finally { saving.value = false }
}

const maskKey = (k) => { if (!k) return ''; return k.length <= 8 ? '****' : `${k.slice(0,4)}****${k.slice(-4)}` }
const modelHeaders = [
  { title:'大模型平台', key:'name', align: 'start' },
  { title:'默认模型', key:'model', align: 'start' },
  { title:'API Key', key:'apiKey', align: 'start' },
  { title:'启用', key:'enabled', width:120, align: 'center' },
  { title:'操作', key:'actions', width:120, sortable:false, align: 'end' }
]
const providerRows = computed(() => providersList.value
  .map(p => ({ name:p.name, displayName: displayProviderName(p.name), models: p.models || [], model:(p.models?.[0] || p.model || ''), apiKey:p.apiKey || '', enabled: !!p.enabled }))
)

// 已配置的提供商与模型选项
const providerNameMap = {
  QWEN: '阿里云百炼 (QWEN)',
  GLM: '质谱AI开放平台 (GLM)',
  SILICONFLOW: '硅基流动 (综合平台)',
  DEEPSEEK: 'DeepSeek 官方'
}
const displayProviderName = (name) => providerNameMap[baseKey(name)] || name
const configuredProviderItems = computed(() => providersList.value.map(p => ({ title: displayProviderName(p.name), value: p.name })))
const configuredModelItems = (providerName) => {
  const p = providersList.value.find(x => x.name === providerName)
  if (!p) return []
  
  // 综合 models 数组和单个 model 字段
  const models = []
  if (Array.isArray(p.models)) {
    models.push(...p.models)
  }
  if (p.model && !models.includes(p.model)) {
    models.push(p.model)
  }
  
  // 如果都没有，尝试从远程获取一次（异步不适合这里，但可以作为兜底）
  return models.map(x => ({ title: x, value: x }))
}

const scenes = [
  { key:'analysis', title:'深度解析' },
  { key:'chat', title:'对话-AI助理' }
]
const sceneForm = ref({ models: Object.fromEntries(scenes.map(s=>[s.key,{ provider:'', model:'' }])) })
const saveScenes = async () => {
  saving.value = true
  try {
    const mapping = {}
    const aSel = sceneForm.value.models['analysis'] || {}
    const aProv = aSel.provider // 直接使用配置中的 provider key，不再 canonicalize 导致丢失后缀
    const aModel = aSel.model || ''
    if (aProv && aModel) {
      mapping['analysis'] = { provider: aProv, model: aModel }
      mapping['resume_analysis'] = { provider: aProv, model: aModel }
      mapping['resume_compare'] = { provider: aProv, model: aModel }
    }
    const cSel = sceneForm.value.models['chat'] || {}
    const cProv = cSel.provider
    const cModel = cSel.model || ''
    if (cProv && cModel) mapping['chat'] = { provider: cProv, model: cModel }
    
    await aiModelAPI.updateAIConfig({ taskMapping: mapping })
    await reloadAIConfig()
    ui.showNotification('保存成功', 'success')
  } finally { saving.value = false }
}

const isDefaultStrategy = (id) => id === 'default'
const editingStrategy = ref(null)
const strategyDialog = ref(false)
const strategyForm = ref({ id: '', name: '', scope: [], models: Object.fromEntries(scenes.map(s => [s.key, { provider: '', model: '' }])) })

const openCreateStrategy = () => {
  editingStrategy.value = null
  strategyForm.value = {
    id: '',
    name: '',
    scope: [],
    models: Object.fromEntries(scenes.map(s => [s.key, { provider: '', model: '' }]))
  }
  strategyDialog.value = true
}

const openEditStrategy = (strategy) => {
  editingStrategy.value = strategy
  strategyForm.value = JSON.parse(JSON.stringify(strategy))
  // 确保所有场景都有对应的模型配置对象
  scenes.forEach(s => {
    if (!strategyForm.value.models[s.key]) {
      strategyForm.value.models[s.key] = { provider: '', model: '' }
    }
  })
  strategyDialog.value = true
}

const saveStrategy = async () => {
  saving.value = true
  try {
    const s = strategyForm.value
    const models = {}
    Object.keys(s.models).forEach(k => {
      const m = s.models[k]
      if (m.provider && m.model) {
        models[k] = { provider: m.provider, model: m.model }
      }
    })
    const payload = {
      strategies: {
        [s.id]: {
          id: s.id,
          name: s.name,
          scope: s.scope,
          models: models
        }
      }
    }
    await aiModelAPI.updateAIConfig(payload)
    strategyDialog.value = false
    await reloadAIConfig()
    ui.showNotification('保存成功', 'success')
  } finally { saving.value = false }
}

// 公司选择
const companyOptions = ref([])
const loadingCompanies = ref(false)
const companySearch = ref('')
const searchCompanies = async (q) => {
  loadingCompanies.value = true
  try {
    const res = await companyAPI.getList({ page:1, itemsPerPage:20, name:q || '' })
    const items = res.data?.items || res.data || []
    companyOptions.value = items.map(it => ({ id: it.id || it.company_id || it._id || it.name, name: it.name || it.companyName || it.title }))
  } catch { companyOptions.value = [] } finally { loadingCompanies.value = false }
}

// 占位函数：测试提供商
const deleteProviderItem = (item) => {
  if (!item || !item.name) return
  ui.showConfirm(`确定删除提供商 ${item.name} 吗？`, async () => {
    try {
      const reg = providersRegistry.value.find(r => String(r.name).toUpperCase() === String(item.name).toUpperCase())
      if (reg && reg.id) {
        await aiModelAPI.delete(reg.id)
      } else {
        const key = canonicalProviderKey(item.name)
        await aiModelAPI.updateAIConfig({ providers: { [key]: { enabled:false, apiKey:null, model:null, models:[], baseUrl:null } } })
      }
      ui.showNotification('删除成功', 'success')
      providersList.value = providersList.value.filter(p => p.name !== item.name)
      await Promise.all([reloadAIConfig(), loadProviderRegistry()])
    } catch (e) {
      console.error(e)
      ui.showNotification('删除失败', 'error')
    }
  }, null, { type: 'warning', title: '删除确认' })
}

 

onMounted(async () => { await reloadAIConfig(); await searchCompanies(''); await loadProviderRegistry() })
const loadProviderRegistry = async () => {
  try {
    const res = await aiModelAPI.getList({ itemsPerPage: 100 })
    const items = res.data?.items || res.data || []
    providersRegistry.value = items.map(it => ({ id: it.id || it._id, name: it.name || it.provider || it.key }))
  } catch { providersRegistry.value = [] }
}
const normalizeModelItems = (arr) => {
  if (!arr) return []
  const list = Array.isArray(arr) ? arr : (Array.isArray(arr?.value) ? arr.value : [])
  return list.map(m => ({ title: String(m), value: String(m) }))
}
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
