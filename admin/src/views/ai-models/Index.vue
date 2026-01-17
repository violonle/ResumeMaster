<template>
  <StandardPage
    title="大模型管理"
    subtitle="管理所有AI大模型配置"
  >
    <template #actions>
      <VBtn
        color="primary"
        prepend-icon="mdi-plus"
        class="me-2"
        @click="showCreateDialog = true"
      >
        新建提供商
      </VBtn>
      <VBtn
        color="info"
        prepend-icon="mdi-test-tube"
        :disabled="aiModelStore.modelKeys.length === 0"
        @click="showBatchTestDialog = true"
      >
        批量测试
      </VBtn>
    </template>

    <!-- 统计卡片 -->
    <VRow class="mb-6">
      <VCol
        cols="12"
        md="3"
        sm="6"
      >
        <VCard>
          <VCardText class="d-flex align-center">
            <VAvatar
              rounded
              color="primary"
              variant="tonal"
              class="me-4"
            >
              <VIcon
                icon="mdi-robot"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="text-h4">
                {{ aiModelStore.totalItems }}
              </div>
              <div class="text-caption text-medium-emphasis">
                总模型数
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
        <VCard>
          <VCardText class="d-flex align-center">
            <VAvatar
              rounded
              color="success"
              variant="tonal"
              class="me-4"
            >
              <VIcon
                icon="mdi-check-circle"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="text-h4">
                {{ activeModels }}
              </div>
              <div class="text-caption text-medium-emphasis">
                活跃模型
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
        <VCard>
          <VCardText class="d-flex align-center">
            <VAvatar
              rounded
              color="warning"
              variant="tonal"
              class="me-4"
            >
              <VIcon
                icon="mdi-pause-circle"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="text-h4">
                {{ inactiveModels }}
              </div>
              <div class="text-caption text-medium-emphasis">
                暂停模型
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
        <VCard>
          <VCardText class="d-flex align-center">
            <VAvatar
              rounded
              color="error"
              variant="tonal"
              class="me-4"
            >
              <VIcon
                icon="mdi-close-circle"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="text-h4">
                {{ errorModels }}
              </div>
              <div class="text-caption text-medium-emphasis">
                异常模型
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 搜索和筛选 -->
    <VCard class="mb-6">
      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="4"
          >
            <VTextField
              v-model="searchQuery"
              placeholder="搜索提供商"
              prepend-inner-icon="mdi-magnify"
              clearable
              @input="handleSearch"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <VSelect
              v-model="providerFilter"
              :items="providerOptions"
              label="提供商"
              clearable
              @update:model-value="handleFilter"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <VSelect
              v-model="enabledFilter"
              :items="enabledOptions"
              label="启用状态"
              clearable
              @update:model-value="handleFilter"
            />
          </VCol>
          <VCol
            cols="12"
            md="2"
          >
            <VBtn
              color="primary"
              variant="tonal"
              :loading="aiModelStore.loading"
              block
              @click="handleRefresh"
            >
              <VIcon icon="mdi-refresh" />
              刷新
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- 模型列表 -->
    <VCard
      elevation="0"
      border
    >
      <VCardText class="pa-0">
        <VDataTable
          v-model:page="currentPage"
          :headers="headers"
          :items="aiModelStore.providers"
          :loading="aiModelStore.loading"
          :items-per-page="aiModelStore.filters.itemsPerPage"
          :items-length="aiModelStore.totalItems"
          class="clean-table"
          hover
          @update:page="handlePageChange"
          @update:items-per-page="handleItemsPerPageChange"
        >
          <!-- 提供商列 -->
          <template #item.provider="{ item }">
            <VChip
              :color="getPlatformColor(item.provider)"
              size="small"
            >
              {{ getPlatformText(item.provider) }}
            </VChip>
          </template>

          <!-- 启用列 -->
          <template #item.enabled="{ item }">
            <VChip
              :color="item.enabled ? 'success' : 'warning'"
              size="small"
            >
              {{ item.enabled ? '启用' : '禁用' }}
            </VChip>
          </template>

          

          <!-- 操作列 -->
          <template #item.actions="{ item }">
            <div class="d-flex gap-2">
              <VBtn
                icon
                size="small"
                color="info"
                variant="text"
                :loading="testingModel === item.id"
                @click="openTestDialog(item)"
              >
                <VIcon icon="mdi-test-tube" />
              </VBtn>
              <VBtn
                icon
                size="small"
                color="secondary"
                variant="text"
                @click="openKeysDialog(item)"
              >
                <VIcon icon="mdi-key" />
              </VBtn>
              
              <VBtn
                v-if="item.enabled"
                icon
                size="small"
                color="warning"
                variant="text"
                @click="toggleProvider(item)"
              >
                <VIcon icon="mdi-pause" />
              </VBtn>
              
              <VBtn
                v-else
                icon
                size="small"
                color="success"
                variant="text"
                @click="toggleProvider(item)"
              >
                <VIcon icon="mdi-play" />
              </VBtn>
              
              <VBtn
                icon
                size="small"
                color="primary"
                variant="text"
                @click="editProvider(item)"
              >
                <VIcon icon="mdi-pencil" />
              </VBtn>
              
              <VBtn
                icon
                size="small"
                color="error"
                variant="text"
                @click="confirmDelete(item)"
              >
                <VIcon icon="mdi-delete" />
              </VBtn>
            </div>
          </template>

          <!-- 空状态 -->
          <template #no-data>
            <div class="text-center pa-4">
              <VIcon
                icon="mdi-robot-off"
                size="48"
                class="mb-4 text-medium-emphasis"
              />
              <div class="text-h6 text-medium-emphasis">
                暂无提供商数据
              </div>
              <div class="text-caption text-medium-emphasis mt-2">
                点击右上角"新建模型"按钮添加第一个模型
              </div>
            </div>
          </template>
        </VDataTable>
      </VCardText>
    </VCard>

    <!-- 创建/编辑对话框 -->
    <VDialog
      v-model="showCreateDialog"
      max-width="800px"
    >
      <VCard>
        <VCardTitle>
          <span>{{ editingModel ? '编辑模型' : '新建模型' }}</span>
        </VCardTitle>
        <VCardText>
          <VForm
            ref="modelForm"
            @submit.prevent="handleSubmit"
          >
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="modelFormData.name"
                  label="模型名称"
                  :rules="[v => !!v || '请输入模型名称']"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="modelFormData.platform"
                  :items="platforms"
                  label="平台"
                  :rules="[v => !!v || '请选择平台']"
                  required
                  @update:model-value="handlePlatformChange"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="modelFormData.modelType"
                  :items="modelTypeOptions"
                  label="模型类型"
                  :rules="[v => !!v || '请选择模型类型']"
                  required
                  :disabled="!modelFormData.platform"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="modelFormData.modelId"
                  label="模型ID"
                  :rules="[v => !!v || '请输入模型ID']"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="modelFormData.apiKey"
                  label="API密钥"
                  :type="showApiKey ? 'text' : 'password'"
                  :append-inner-icon="showApiKey ? 'mdi-eye-off' : 'mdi-eye'"
                  :rules="[v => !!v || '请输入API密钥']"
                  required
                  @click:append-inner="showApiKey = !showApiKey"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="modelFormData.apiEndpoint"
                  label="API地址"
                  :rules="[v => !!v || '请输入API地址']"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="modelFormData.maxTokens"
                  label="最大Token数"
                  type="number"
                  :rules="[v => !!v || '请输入最大Token数', v => v > 0 || '必须大于0']"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="modelFormData.temperature"
                  label="温度参数"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  :rules="[v => v !== '' || '请输入温度参数', v => v >= 0 && v <= 2 || '必须在0-2之间']"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="modelFormData.status"
                  :items="statusOptions"
                  label="状态"
                  :rules="[v => !!v || '请选择状态']"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="modelFormData.priority"
                  label="优先级"
                  type="number"
                  :rules="[v => !!v || '请输入优先级', v => v >= 0 || '必须大于等于0']"
                  required
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="modelFormData.description"
                  label="描述"
                  rows="3"
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="modelFormData.systemPrompt"
                  label="系统提示词"
                  rows="3"
                  placeholder="可选：设置默认的系统提示词"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            color="grey"
            variant="text"
            @click="closeDialog"
          >
            取消
          </VBtn>
          <VBtn
            color="primary"
            :loading="saving"
            @click="handleSubmit"
          >
            保存
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 密钥列表对话框 -->
    <VDialog
      v-model="showKeysDialog"
      max-width="900px"
    >
      <VCard>
        <VCardTitle>模型密钥</VCardTitle>
        <VCardText>
          <VRow class="mb-4">
            <VCol
              cols="12"
              md="6"
            >
              <VBtn
                color="primary"
                prepend-icon="mdi-plus"
                @click="openCreateKeyDialog"
              >
                新建密钥
              </VBtn>
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <VSelect
                v-model="selectedCompanyId"
                :items="companyOptions"
                item-title="name"
                item-value="id"
                label="公司筛选"
                clearable
                @update:model-value="filterKeysByCompany"
              />
            </VCol>
          </VRow>
          <VDataTable
            :headers="keyHeaders"
            :items="aiModelStore.modelKeys"
            :items-per-page="5"
          >
            <template #item.api_key="{ item }">
              <div>{{ maskKey(item.api_key) }}</div>
            </template>
            <template #item.limits="{ item }">
              <div>RPM: {{ item.limits?.rpm || 0 }} / RPD: {{ item.limits?.rpd || 0 }}</div>
            </template>
            <template #item.actions="{ item }">
              <div class="d-flex gap-2">
                <VBtn
                  icon
                  size="small"
                  color="primary"
                  variant="text"
                  @click="editKey(item)"
                >
                  <VIcon icon="mdi-pencil" />
                </VBtn>
                <VBtn
                  icon
                  size="small"
                  color="error"
                  variant="text"
                  @click="deleteKey(item)"
                >
                  <VIcon icon="mdi-delete" />
                </VBtn>
              </div>
            </template>
            <template #no-data>
              <div class="text-center pa-4 text-medium-emphasis">
                暂无密钥
              </div>
            </template>
          </VDataTable>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            color="grey"
            variant="text"
            @click="showKeysDialog = false"
          >
            关闭
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 新建/编辑密钥对话框 -->
    <VDialog
      v-model="showKeyFormDialog"
      max-width="700px"
    >
      <VCard>
        <VCardTitle>
          <span>{{ editingKey ? '编辑密钥' : '新建密钥' }}</span>
        </VCardTitle>
        <VCardText>
          <VForm
            ref="keyForm"
            @submit.prevent="saveKey"
          >
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="keyFormData.provider"
                  :items="providerOptions"
                  label="提供商"
                  disabled
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="keyFormData.company_id"
                  label="公司ID"
                />
              </VCol>
              <VCol cols="12">
                <VTextField
                  v-model="keyFormData.api_key"
                  label="API密钥"
                  :type="showKey ? 'text' : 'password'"
                  :append-inner-icon="showKey ? 'mdi-eye-off' : 'mdi-eye'"
                  @click:append-inner="showKey = !showKey"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model.number="keyFormData.rpm"
                  label="RPM限速"
                  type="number"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model.number="keyFormData.rpd"
                  label="RPD限速"
                  type="number"
                />
              </VCol>
              <VCol cols="12">
                <VTextField
                  v-model="keyFormData.scope"
                  label="作用域"
                  placeholder="例如：chat, embed"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            color="grey"
            variant="text"
            @click="closeKeyForm"
          >
            取消
          </VBtn>
          <VBtn
            color="primary"
            :loading="savingKey"
            @click="saveKey"
          >
            保存
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 测试对话框 -->
    <VDialog
      v-model="showTestDialog"
      max-width="700px"
    >
      <VCard>
        <VCardTitle>测试模型密钥</VCardTitle>
        <VCardText>
          <VForm
            ref="testForm"
            @submit.prevent="handleTest"
          >
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VAutocomplete
                  v-model="selectedKeyId"
                  :items="aiModelStore.modelKeys"
                  item-title="provider"
                  item-value="id"
                  label="选择密钥"
                  chips
                  clearable
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="testType"
                  :items="testTypeOptions"
                  label="测试类型"
                  :rules="[v => !!v || '请选择测试类型']"
                  required
                  @update:model-value="handleTestTypeChange"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="testTimeout"
                  label="超时时间 (秒)"
                  type="number"
                  :rules="[v => !!v || '请输入超时时间', v => v > 0 || '必须大于0']"
                  required
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="testPrompt"
                  label="测试提示词"
                  rows="4"
                  :rules="[v => !!v || '请输入测试提示词']"
                  required
                  :hint="testTypeHint"
                />
              </VCol>
            </VRow>
          </VForm>
          
          <div
            v-if="testResult"
            class="mt-4"
          >
            <VAlert
              :type="testResult.success ? 'success' : 'error'"
              :title="testResult.success ? '测试成功' : '测试失败'"
            >
              <div v-if="testResult.success">
                <div class="text-subtitle-2 mb-2">
                  模型响应：
                </div>
                <div class="text-body-2 mb-3">
                  {{ testResult.response }}
                </div>
                
                <VRow>
                  <VCol
                    cols="12"
                    md="4"
                  >
                    <div class="text-caption">
                      <strong>响应时间：</strong>{{ testResult.duration }}ms
                    </div>
                  </VCol>
                  <VCol
                    cols="12"
                    md="4"
                  >
                    <div class="text-caption">
                      <strong>Token数：</strong>{{ testResult.tokens }}
                    </div>
                  </VCol>
                  <VCol
                    cols="12"
                    md="4"
                  >
                    <div class="text-caption">
                      <strong>效率：</strong>
                      <VChip
                        :color="getEfficiencyColor(testResult.performance?.efficiency)"
                        size="x-small"
                      >
                        {{ getEfficiencyText(testResult.performance?.efficiency) }}
                      </VChip>
                    </div>
                  </VCol>
                </VRow>
                
                <div
                  v-if="testResult.performance"
                  class="mt-2"
                >
                  <div class="text-caption">
                    <strong>处理速度：</strong>{{ testResult.performance.tokensPerSecond }} tokens/秒
                  </div>
                </div>
                
                <div class="text-caption mt-2">
                  <strong>测试时间：</strong>{{ formatDate(testResult.timestamp) }}
                </div>
              </div>
              <div v-else>
                <div class="text-body-2">
                  {{ testResult.error }}
                </div>
                <div class="text-caption mt-2">
                  <strong>测试时间：</strong>{{ formatDate(testResult.timestamp) }}
                </div>
              </div>
            </VAlert>
          </div>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            color="grey"
            variant="text"
            @click="closeTestDialog"
          >
            关闭
          </VBtn>
          <VBtn
            color="primary"
            :loading="testing"
            @click="handleTest"
          >
            测试
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 批量测试对话框 -->
    <VDialog
      v-model="showBatchTestDialog"
      max-width="900px"
    >
      <VCard>
        <VCardTitle>批量测试AI模型</VCardTitle>
        <VCardText>
          <VRow>
            <VCol
              cols="12"
              md="6"
            >
              <VSelect
                v-model="batchTestType"
                :items="testTypeOptions"
                label="测试类型"
                :rules="[v => !!v || '请选择测试类型']"
                required
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <VTextField
                v-model="batchTestTimeout"
                label="超时时间 (秒)"
                type="number"
                :rules="[v => !!v || '请输入超时时间', v => v > 0 || '必须大于0']"
                required
              />
            </VCol>
            <VCol cols="12">
              <VAutocomplete
                v-model="selectedModelsForBatchTest"
                :items="aiModelStore.modelKeys"
                item-title="provider"
                item-value="id"
                label="选择要测试的模型"
                multiple
                chips
                closable-chips
                :rules="[v => v.length > 0 || '请至少选择一个模型']"
                required
              />
            </VCol>
          </VRow>
          
          <div
            v-if="batchTestResults"
            class="mt-4"
          >
            <VCard variant="outlined">
              <VCardText>
                <h3 class="text-h6 mb-3">
                  测试结果
                </h3>
                
                <!-- 测试总结 -->
                <VRow class="mb-4">
                  <VCol
                    cols="12"
                    md="3"
                  >
                    <VCard
                      color="primary"
                      variant="tonal"
                    >
                      <VCardText class="text-center">
                        <div class="text-h4">
                          {{ batchTestResults.summary.total }}
                        </div>
                        <div class="text-caption">
                          总测试数
                        </div>
                      </VCardText>
                    </VCard>
                  </VCol>
                  <VCol
                    cols="12"
                    md="3"
                  >
                    <VCard
                      color="success"
                      variant="tonal"
                    >
                      <VCardText class="text-center">
                        <div class="text-h4">
                          {{ batchTestResults.summary.successful }}
                        </div>
                        <div class="text-caption">
                          成功数
                        </div>
                      </VCardText>
                    </VCard>
                  </VCol>
                  <VCol
                    cols="12"
                    md="3"
                  >
                    <VCard
                      color="error"
                      variant="tonal"
                    >
                      <VCardText class="text-center">
                        <div class="text-h4">
                          {{ batchTestResults.summary.failed }}
                        </div>
                        <div class="text-caption">
                          失败数
                        </div>
                      </VCardText>
                    </VCard>
                  </VCol>
                  <VCol
                    cols="12"
                    md="3"
                  >
                    <VCard
                      color="info"
                      variant="tonal"
                    >
                      <VCardText class="text-center">
                        <div class="text-h4">
                          {{ Math.round(batchTestResults.summary.averageResponseTime) }}ms
                        </div>
                        <div class="text-caption">
                          平均响应
                        </div>
                      </VCardText>
                    </VCard>
                  </VCol>
                </VRow>
                
                <!-- 详细结果 -->
                <VDataTable
                  :headers="batchTestHeaders"
                  :items="batchTestResults.results"
                  :items-per-page="5"
                >
                  <template #item.success="{ item }">
                    <VChip
                      :color="item.success ? 'success' : 'error'"
                      size="small"
                    >
                      {{ item.success ? '成功' : '失败' }}
                    </VChip>
                  </template>
                  
                  <template #item.duration="{ item }">
                    <div v-if="item.success">
                      {{ item.duration }}ms
                      <VChip
                        :color="getEfficiencyColor(item.efficiency)"
                        size="x-small"
                        class="ms-1"
                      >
                        {{ getEfficiencyText(item.efficiency) }}
                      </VChip>
                    </div>
                    <div v-else>
                      -
                    </div>
                  </template>
                  
                  <template #item.tokens="{ item }">
                    <div v-if="item.success">
                      {{ item.tokens }}
                    </div>
                    <div v-else>
                      -
                    </div>
                  </template>
                  
                  <template #item.error="{ item }">
                    <div
                      v-if="!item.success"
                      class="text-error text-caption"
                    >
                      {{ item.error }}
                    </div>
                    <div v-else>
                      -
                    </div>
                  </template>
                </VDataTable>
                
                <!-- 平台统计 -->
                <div
                  v-if="Object.keys(batchTestResults.summary.platformStats).length > 0"
                  class="mt-4"
                >
                  <h4 class="text-subtitle-1 mb-2">
                    平台性能统计
                  </h4>
                  <VRow>
                    <VCol
                      v-for="(stats, platform) in batchTestResults.summary.platformStats"
                      :key="platform"
                      cols="12"
                      md="6"
                      lg="3"
                    >
                      <VCard variant="outlined">
                        <VCardText>
                          <div class="text-subtitle-2 mb-2">
                            {{ getPlatformText(platform) }}
                          </div>
                          <div class="text-caption">
                            测试数: {{ stats.count }}<br>
                            平均响应: {{ Math.round(stats.averageDuration) }}ms<br>
                            平均Token: {{ Math.round(stats.averageTokens) }}
                          </div>
                        </VCardText>
                      </VCard>
                    </VCol>
                  </VRow>
                </div>
              </VCardText>
            </VCard>
          </div>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            color="grey"
            variant="text"
            @click="closeBatchTestDialog"
          >
            关闭
          </VBtn>
          <VBtn 
            color="primary" 
            :loading="batchTesting" 
            :disabled="selectedModelsForBatchTest.length === 0"
            @click="handleBatchTest"
          >
            开始批量测试
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 删除确认对话框 -->
    <VDialog
      v-model="showDeleteDialog"
      max-width="400px"
    >
      <VCard>
        <VCardTitle>确认删除</VCardTitle>
        <VCardText>
          确定要删除模型 "{{ deletingModel?.name }}" 吗？此操作不可恢复。
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            color="grey"
            variant="text"
            @click="showDeleteDialog = false"
          >
            取消
          </VBtn>
          <VBtn
            color="error"
            :loading="deleting"
            @click="handleDelete"
          >
            删除
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </StandardPage>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import StandardPage from '@/components/StandardPage.vue'
import { useAIModelStore } from '@/stores/aiModel'
import { useCompanyStore } from '@/stores/company'

const router = useRouter()
const aiModelStore = useAIModelStore()
// 删除旧页面自带的导航控制，统一走全局布局

// 搜索和筛选
const searchQuery = ref('')
const providerFilter = ref('')
const enabledFilter = ref('')

// 对话框状态
const showCreateDialog = ref(false)
const showTestDialog = ref(false)
const showBatchTestDialog = ref(false)
const showKeysDialog = ref(false)
const showKeyFormDialog = ref(false)
const showDeleteDialog = ref(false)
const showApiKey = ref(false)
const saving = ref(false)
const testing = ref(false)
const batchTesting = ref(false)
const deleting = ref(false)
const savingKey = ref(false)

// 表单数据
const modelForm = ref()
const editingProvider = ref(null)
const deletingModel = ref(null)
const testingModel = ref(null)
const selectedKeyId = ref(null)
const editingKey = ref(null)
const keyForm = ref()
const keyFormData = reactive({ provider:'', company_id:'', api_key:'', rpm:0, rpd:0, scope:'' })
const selectedCompanyId = ref('')

const modelFormData = reactive({ provider:'', enabled:true, adapter_config:'' })

const testPrompt = ref('')
const testResult = ref(null)
const testType = ref('basic')
const testTimeout = ref(10)

// 批量测试数据
const batchTestType = ref('basic')
const batchTestTimeout = ref(30)
const selectedModelsForBatchTest = ref([])
const batchTestResults = ref(null)

// 表格配置
const headers = [
  { title: 'ID', key: 'id', width: '80px' },
  { title: '提供商', key: 'provider', width: '120px' },
  { title: '启用', key: 'enabled', width: '100px' },
  { title: '创建时间', key: 'created_at', width: '180px' },
  { title: '操作', key: 'actions', width: '200px', sortable: false },
]

const keyHeaders = [
  { title:'公司ID', key:'company_id', width:'120px' },
  { title:'提供商', key:'provider', width:'120px' },
  { title:'API密钥', key:'api_key' },
  { title:'限速', key:'limits', width:'200px' },
  { title:'创建时间', key:'created_at', width:'180px' },
  { title:'操作', key:'actions', width:'150px', sortable:false },
]

const enabledOptions = [ { title:'全部', value:'' }, { title:'启用', value:'true' }, { title:'禁用', value:'false' } ]

const modelTypeOptions = [
  { title: '全部', value: '' },
  { title: '语言模型', value: 'language' },
  { title: '图像模型', value: 'image' },
  { title: '语音模型', value: 'audio' },
  { title: '视频模型', value: 'video' },
]

const testTypeOptions = [
  { title: '基础测试', value: 'basic' },
  { title: '性能测试', value: 'performance' },
  { title: '创意测试', value: 'creativity' },
]

const batchTestHeaders = [
  { title: '模型', key: 'modelName' },
  { title: '平台', key: 'platform', width: '120px' },
  { title: '状态', key: 'success', width: '80px' },
  { title: '响应时间', key: 'duration', width: '120px' },
  { title: 'Token数', key: 'tokens', width: '100px' },
  { title: '错误信息', key: 'error', width: '200px' },
]

// 计算属性
const enabledProviders = computed(() => aiModelStore.providers.filter(p => p.enabled).length)
const disabledProviders = computed(() => aiModelStore.providers.filter(p => !p.enabled).length)
const errorModels = computed(() => 0)

const currentPage = computed({ get: () => aiModelStore.filters.page, set: (val) => aiModelStore.filters.page = val })

const providerOptions = computed(() => [{ title:'魔搭', value:'modelscope' },{ title:'硅基流动', value:'siliconflow' },{ title:'千问', value:'qianwen' },{ title:'质谱GLM', value:'glm' }])
const companyStore = useCompanyStore()
const companyOptions = computed(() => companyStore.companies)

const testTypeHint = computed(() => {
  const hints = {
    basic: '基础测试：使用简单的问候语测试模型基本响应能力',
    performance: '性能测试：使用复杂的技术问题测试模型处理能力',
    creativity: '创意测试：使用创作类问题测试模型创造力'
  }
  return hints[testType.value] || ''
})

// 方法
const getPlatformColor = (platform) => {
  const colors = {
    'qianwen': 'primary',
    'zhipu': 'success',
    'modelscope': 'warning',
    'siliconflow': 'info',
  }
  return colors[platform] || 'grey'
}

const getPlatformIcon = (platform) => {
  const icons = {
    'qianwen': 'mdi-alpha-q-circle',
    'zhipu': 'mdi-alpha-z-circle',
    'modelscope': 'mdi-alpha-m-circle',
    'siliconflow': 'mdi-alpha-s-circle',
  }
  return icons[platform] || 'mdi-help-circle'
}

const getPlatformText = (platform) => {
  const texts = {
    'qianwen': '千问',
    'zhipu': '智谱',
    'modelscope': '魔搭',
    'siliconflow': '硅基流动',
  }
  return texts[platform] || platform
}

const getStatusColor = (status) => {
  const colors = {
    active: 'success',
    inactive: 'warning',
    error: 'error',
  }
  return colors[status] || 'grey'
}

const getStatusText = (status) => {
  const texts = {
    active: '活跃',
    inactive: '暂停',
    error: '异常',
  }
  return texts[status] || status
}

const getModelTypeColor = (modelType) => {
  const colors = {
    language: 'primary',
    image: 'success',
    audio: 'warning',
    video: 'info',
  }
  return colors[modelType] || 'grey'
}

const getModelTypeText = (modelType) => {
  const texts = {
    language: '语言模型',
    image: '图像模型',
    audio: '语音模型',
    video: '视频模型',
  }
  return texts[modelType] || modelType
}

const handleSearch = () => { aiModelStore.filters.provider = searchQuery.value; aiModelStore.fetchProviders() }

const handleFilter = () => { aiModelStore.filters.provider = providerFilter.value; aiModelStore.filters.enabled = enabledFilter.value; aiModelStore.fetchProviders() }

const handleRefresh = () => { aiModelStore.fetchProviders() }

const handlePageChange = (page) => { aiModelStore.fetchProviders({ page }) }

const handleItemsPerPageChange = (itemsPerPage) => { aiModelStore.filters.itemsPerPage = itemsPerPage; aiModelStore.fetchProviders() }

const handlePlatformChange = async () => {}

const openTestDialog = async (provider) => { testingModel.value = provider.id; selectedKeyId.value = null; testType.value='basic'; testTimeout.value=10; testPrompt.value='请用一句话介绍你自己'; testResult.value=null; showTestDialog.value=true; await aiModelStore.fetchModelKeys({ provider: provider.provider }) }

const openKeysDialog = async (provider) => { editingProvider.value = provider; await aiModelStore.fetchModelKeys({ provider: provider.provider }); showKeysDialog.value = true }

const openCreateKeyDialog = () => { editingKey.value = null; Object.assign(keyFormData, { provider: editingProvider.value?.provider || '', company_id:'', api_key:'', rpm:0, rpd:0, scope:'' }); showKeyFormDialog.value = true }

const editKey = (key) => { editingKey.value = key; Object.assign(keyFormData, { provider: key.provider, company_id: key.company_id, api_key: key.api_key, rpm: key.limits?.rpm || 0, rpd: key.limits?.rpd || 0, scope: key.scope || '' }); showKeyFormDialog.value = true }

const closeKeyForm = () => { showKeyFormDialog.value = false; editingKey.value = null; Object.assign(keyFormData, { provider:'', company_id:'', api_key:'', rpm:0, rpd:0, scope:'' }) }

const saveKey = async () => {
  savingKey.value = true
  try {
    const payload = { provider: keyFormData.provider, company_id: keyFormData.company_id || null, api_key: keyFormData.api_key, limits: { rpm: Number(keyFormData.rpm)||0, rpd: Number(keyFormData.rpd)||0 }, scope: keyFormData.scope }
    if (editingKey.value) { await aiModelStore.updateKey(editingKey.value.id, payload) } else { await aiModelStore.createKey(payload) }
    showKeyFormDialog.value = false
    await aiModelStore.fetchModelKeys({ provider: editingProvider.value?.provider })
  } catch (e) {
    console.error(e)
  } finally {
    savingKey.value = false
  }
}

const deleteKey = async (key) => { try { await aiModelStore.deleteKey(key.id); await aiModelStore.fetchModelKeys({ provider: editingProvider.value?.provider }) } catch(e){ console.error(e) } }

const maskKey = (k) => { if (!k) return ''; return k.length <= 8 ? '****' : `${k.slice(0,4)}****${k.slice(-4)}` }

const handleTestTypeChange = () => {
  const prompts = {
    basic: '请用一句话介绍你自己',
    performance: '请详细解释什么是人工智能，包括其发展历程、主要技术和应用领域',
    creativity: '请创作一首关于春天的现代诗'
  }
  testPrompt.value = prompts[testType.value] || '请用一句话介绍你自己'
}

const getEfficiencyColor = (efficiency) => {
  const colors = {
    excellent: 'success',
    good: 'warning',
    slow: 'error'
  }
  return colors[efficiency] || 'grey'
}

const getEfficiencyText = (efficiency) => {
  const texts = {
    excellent: '优秀',
    good: '良好',
    slow: '较慢'
  }
  return texts[efficiency] || '未知'
}

const toggleProvider = async (provider) => { try { await aiModelStore.updateProvider(provider.id, { enabled: !provider.enabled }) } catch (e){ console.error(e) } }

const editProvider = (provider) => { editingProvider.value = provider; Object.assign(modelFormData, { provider: provider.provider, enabled: provider.enabled, adapter_config: JSON.stringify(provider.adapter_config || {}, null, 2) }); showCreateDialog.value = true }

const confirmDelete = (model) => {
  deletingModel.value = model
  showDeleteDialog.value = true
}

const closeDialog = () => { showCreateDialog.value=false; editingProvider.value=null; Object.assign(modelFormData, { provider:'', enabled:true, adapter_config:'' }) }

const closeTestDialog = () => {
  showTestDialog.value = false
  testingModel.value = null
  testPrompt.value = ''
  testResult.value = null
  testType.value = 'basic'
  testTimeout.value = 10
}

const closeBatchTestDialog = () => {
  showBatchTestDialog.value = false
  batchTestType.value = 'basic'
  batchTestTimeout.value = 30
  selectedModelsForBatchTest.value = []
  batchTestResults.value = null
}

const handleBatchTest = async () => {
  if (selectedModelsForBatchTest.value.length === 0) {
    return
  }

  batchTesting.value = true
  try {
    const result = await aiModelStore.batchTestModelKeys(selectedModelsForBatchTest.value, {
      testType: batchTestType.value
    })
    batchTestResults.value = result
  } catch (error) {
    console.error('Batch test failed:', error)
    // 可以添加错误提示
  } finally {
    batchTesting.value = false
  }
}

const handleSubmit = async () => {
  const { valid } = await modelForm.value.validate()
  if (!valid) return

  saving.value = true
  try {
    const payload = { provider: modelFormData.provider, enabled: modelFormData.enabled, adapter_config: (()=>{ try{ return JSON.parse(modelFormData.adapter_config||'{}') }catch(e){ return {} } })() }
    if (editingProvider.value) { await aiModelStore.updateProvider(editingProvider.value.id, payload) } else { await aiModelStore.createProvider(payload) }
    closeDialog()
  } catch (error) {
    console.error('Failed to save model:', error)
  } finally {
    saving.value = false
  }
}

const handleTest = async () => {
  const { valid } = await testForm.value?.validate()
  if (!valid) return

  testing.value = true
  try {
    const result = await aiModelStore.testModelKey(selectedKeyId.value, { prompt: testPrompt.value, testType: testType.value })
    testResult.value = result
  } catch (error) {
    testResult.value = {
      success: false,
      error: error.response?.data?.message || '测试失败',
      timestamp: new Date().toISOString()
    }
  } finally {
    testing.value = false
  }
}

const handleDelete = async () => {
  if (!deletingModel.value) return
  
  deleting.value = true
  try {
    await aiModelStore.deleteProvider(deletingModel.value.id)
    showDeleteDialog.value = false
    deletingModel.value = null
  } catch (error) {
    console.error('Failed to delete model:', error)
  } finally {
    deleting.value = false
  }
}

// 初始化
// 移除旧的退出逻辑（已由全局处理）

onMounted(async () => { await aiModelStore.fetchProviders(); await companyStore.fetchCompanies({ itemsPerPage: 100 }) })

// 工具函数
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
</script>
const filterKeysByCompany = async () => { await aiModelStore.fetchModelKeys({ provider: editingProvider.value?.provider, company_id: selectedCompanyId.value || '' }) }
