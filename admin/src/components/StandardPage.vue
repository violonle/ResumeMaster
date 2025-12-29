<!--
 * 标准页面模板
 * 
 * 使用说明：
 * 1. 只包含页面内容，不包含任何布局元素
 * 2. 页面标题通过 props 传入
 * 3. 操作按钮通过插槽定义
 * 4. 内容区域通过默认插槽定义
 * 
 * 示例：
 * &lt;StandardPage title="客户管理"&gt;
 *   &lt;template #actions&gt;
 *     &lt;VBtn color="primary" @click="handleCreate"&gt;新建&lt;/VBtn&gt;
 *   &lt;/template&gt;
 *   
 *   &lt;VRow&gt;
 *     &lt;VCol cols="12"&gt;
 *       &lt;!-- 页面内容 --&gt;
 *     &lt;/VCol&gt;
 *   &lt;/VRow&gt;
 * &lt;/StandardPage&gt;
-->

<template>
  <div class="standard-page">
    <!-- 页面头部区域 -->
    <VRow class="page-head">
      <VCol cols="12" md="6" class="d-flex align-center">
        <VBtn
          v-if="showBack"
          icon="mdi-arrow-left"
          variant="text"
          class="me-2"
          @click="$emit('back')"
        />
        <div>
          <h1 class="page-title">{{ title }}</h1>
          <p v-if="subtitle" class="page-sub">
            {{ subtitle }}
          </p>
        </div>
      </VCol>
      <VCol cols="12" md="6" class="text-md-right">
        <!-- 操作按钮插槽 -->
        <slot name="actions" />
      </VCol>
    </VRow>

    <!-- 内容区域 -->
    <div class="page-body"><slot /></div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  showBack: {
    type: Boolean,
    default: false
  }
})

defineEmits(['back'])
</script>

<style scoped>
.standard-page { width: 100% }
.standard-page .page-head { margin-bottom: 24px; align-items: flex-end }
.standard-page .page-title { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin: 0; line-height: 1.2; color: rgb(var(--v-theme-on-background)); }
.standard-page .page-sub { font-size: 14px; color: #000000; margin-top: 8px; line-height: 1.5; }
.standard-page .page-body { width: 100% }

:deep(.clean-table .v-table__wrapper thead) {
  position: sticky;
  top: 0;
  z-index: 2;
}
:deep(.clean-table .v-data-table__th) {
  background-color: #f5f7fa !important;
  border-bottom: 1px solid #e5e7eb !important;
  color: #334155 !important;
  font-weight: 600 !important;
  padding: 12px 16px !important;
}
:deep(.clean-table .v-table__wrapper thead th:first-child) { border-top-left-radius: 12px }
:deep(.clean-table .v-table__wrapper thead th:last-child) { border-top-right-radius: 12px }
:deep(.clean-table .v-data-table__td) { padding: 10px 16px }
:deep(.clean-table) { width: 100% }
</style>
