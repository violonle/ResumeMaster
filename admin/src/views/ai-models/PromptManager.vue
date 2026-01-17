<template>
  <div class="prompt-manager">
    <div class="d-flex justify-space-between align-center mb-4">
      <h3 class="text-h6">
        提示词模板管理
      </h3>
      <VBtn
        color="primary"
        :loading="loading"
        prepend-icon="mdi-refresh"
        @click="fetchPrompts"
      >
        刷新
      </VBtn>
    </div>

    <VCard>
      <VTable>
        <thead>
          <tr>
            <th class="text-left">
              名称
            </th>
            <th class="text-left">
              Key
            </th>
            <th class="text-left">
              分类
            </th>
            <th class="text-left">
              状态
            </th>
            <th class="text-left">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in prompts"
            :key="item.key"
          >
            <td>
              <div class="font-weight-medium">
                {{ item.name }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ item.description }}
              </div>
            </td>
            <td><code>{{ item.key }}</code></td>
            <td>
              <VChip
                size="small"
                color="info"
              >
                {{ item.category }}
              </VChip>
            </td>
            <td>
              <VChip
                size="small"
                :color="item.is_active ? 'success' : 'error'"
              >
                {{ item.is_active ? '启用' : '禁用' }}
              </VChip>
            </td>
            <td>
              <VBtn
                size="small"
                color="primary"
                variant="text"
                @click="editPrompt(item)"
              >
                编辑
              </VBtn>
            </td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- Edit Dialog -->
    <VDialog
      v-model="dialog"
      max-width="800px"
    >
      <VCard>
        <VCardTitle class="pa-4 bg-primary text-white">
          编辑提示词模板
        </VCardTitle>
        <VCardText class="pa-4">
          <VForm
            ref="form"
            v-model="valid"
          >
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="editedItem.name"
                  label="模板名称"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="editedItem.key"
                  label="Key (不可修改)"
                  disabled
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="editedItem.content"
                  label="模板内容"
                  rows="15"
                  hint="支持变量，如 {{variableName}}"
                  persistent-hint
                  class="font-monospace"
                />
              </VCol>
              <VCol cols="12">
                <div class="text-caption mb-2">
                  可用变量:
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <VChip
                    v-for="v in editedItem.variables"
                    :key="v"
                    size="small"
                    color="secondary"
                    @click="insertVariable(v)"
                  >
                    {{ v }}
                  </VChip>
                </div>
              </VCol>
              <VCol cols="12">
                <VSwitch
                  v-model="editedItem.is_active"
                  label="启用"
                  color="success"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn
            color="grey"
            variant="text"
            @click="dialog = false"
          >
            取消
          </VBtn>
          <VBtn
            color="primary"
            :loading="saving"
            @click="savePrompt"
          >
            保存
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { promptAPI } from '@/api';

const prompts = ref([]);
const loading = ref(false);
const dialog = ref(false);
const saving = ref(false);
const valid = ref(true);

const editedItem = reactive({
  id: null,
  key: '',
  name: '',
  content: '',
  variables: [],
  description: '',
  is_active: true
});

const fetchPrompts = async () => {
  loading.value = true;
  try {
    const res = await promptAPI.getList();
    if (res.data.success) {
      prompts.value = res.data.data;
    }
  } catch (error) {
    console.error('Failed to fetch prompts:', error);
    // Use snackbar if available
  } finally {
    loading.value = false;
  }
};

const editPrompt = (item) => {
  Object.assign(editedItem, JSON.parse(JSON.stringify(item)));
  dialog.value = true;
};

const insertVariable = (v) => {
  editedItem.content += ` {{${v}}}`;
};

const savePrompt = async () => {
  saving.value = true;
  try {
    const res = await promptAPI.update(editedItem.key, {
      name: editedItem.name,
      content: editedItem.content,
      is_active: editedItem.is_active,
      description: editedItem.description
    });
    
    if (res.data.success) {
      dialog.value = false;
      await fetchPrompts();
    }
  } catch (error) {
    console.error('Failed to update prompt:', error);
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  fetchPrompts();
});
</script>

<style scoped>
.font-monospace :deep(textarea) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
  font-size: 14px;
  line-height: 1.5;
}
</style>