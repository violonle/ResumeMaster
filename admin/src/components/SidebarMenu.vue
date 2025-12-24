<template>
  <VNavigationDrawer
    v-model="localDrawer"
    :rail="localRail"
    :permanent="permanent"
    app
    class="sidebar-menu border-e"
    :width="260"
    :rail-width="72"
  >
    <!-- Logo Area -->
    <div class="pa-4 d-flex flex-column align-center justify-center">
      <div class="mb-2" :style="{ width: localRail ? '48px' : '160px', height: localRail ? '48px' : 'auto' }">
        <VImg src="/uploads/avatars/user_6_1765374552691.png" alt="Logo" contain />
      </div>
      <div v-if="!localRail" class="text-h6 font-weight-bold mt-1 text-truncate w-100 text-center">争湃·简历大师</div>
      <div v-if="!localRail" class="text-caption text-medium-emphasis">后台管理系统</div>
    </div>

    <VDivider class="mx-4 mb-2" />

    <!-- Navigation List -->
    <VList nav density="comfortable" class="px-2">
      <VListItem
        prepend-icon="mdi-view-dashboard-outline"
        title="仪表板"
        :to="{ name: 'dashboard' }"
        color="primary"
        rounded="lg"
        class="mb-1"
      />

      <VListSubheader v-if="!localRail" class="text-caption font-weight-bold mt-2 mb-1">用户管理</VListSubheader>
      <VDivider v-else class="my-2 mx-2" />

      <VListItem
        v-if="can('customers.view')"
        prepend-icon="mdi-account-group-outline"
        title="账号管理"
        :to="{ name: 'accounts' }"
        color="primary"
        rounded="lg"
        class="mb-1"
      />
      <VListItem
        v-if="can('companies.view')"
        prepend-icon="mdi-office-building-outline"
        title="企业管理"
        :to="{ name: 'companies' }"
        color="primary"
        rounded="lg"
        class="mb-1"
      />
      <VListItem
        v-if="can('subscriptions.view')"
        prepend-icon="mdi-credit-card-outline"
        title="订阅管理"
        :to="{ name: 'subscriptions' }"
        color="primary"
        rounded="lg"
        class="mb-1"
      />

      <VListSubheader v-if="!localRail" class="text-caption font-weight-bold mt-2 mb-1">财务管理</VListSubheader>
      <VDivider v-else class="my-2 mx-2" />

      <VListItem
        v-if="can('finance.view')"
        prepend-icon="mdi-currency-usd"
        title="财务概览"
        :to="{ name: 'finance' }"
        color="primary"
        rounded="lg"
        class="mb-1"
      />
      <VListItem
        v-if="can('invoices.view')"
        prepend-icon="mdi-receipt-text-outline"
        title="发票管理"
        :to="{ name: 'invoices' }"
        color="primary"
        rounded="lg"
        class="mb-1"
      />

      <VListSubheader v-if="!localRail" class="text-caption font-weight-bold mt-2 mb-1">系统管理</VListSubheader>
      <VDivider v-else class="my-2 mx-2" />

      <VListItem
        v-if="can('ai_models.view')"
        prepend-icon="mdi-robot-outline"
        title="大模型管理"
        :to="{ name: 'ai-models' }"
        color="primary"
        rounded="lg"
        class="mb-1"
      />
      <VListItem
        v-if="can('subscriptions.view')"
        prepend-icon="mdi-format-list-bulleted"
        title="订阅计划"
        :to="{ name: 'subscription-plans' }"
        color="primary"
        rounded="lg"
        class="mb-1"
      />
      <VListItem
        v-if="can('system.settings')"
        prepend-icon="mdi-cog-outline"
        title="系统设置"
        :to="{ name: 'system-settings' }"
        color="primary"
        rounded="lg"
        class="mb-1"
      />
      <VListItem
        v-if="can('system.logs')"
        prepend-icon="mdi-file-document-outline"
        title="系统日志"
        :to="{ name: 'system-logs' }"
        color="primary"
        rounded="lg"
        class="mb-1"
      />

      <VListSubheader v-if="!localRail" class="text-caption font-weight-bold mt-2 mb-1">个人中心</VListSubheader>
      <VDivider v-else class="my-2 mx-2" />

      <VListItem
        prepend-icon="mdi-account-cog-outline"
        title="账号设置"
        :to="{ name: 'account-settings' }"
        color="primary"
        rounded="lg"
        class="mb-1"
      />
    </VList>

    <template #append>
      <div class="pa-4">
        <VBtn
          block
          color="error"
          variant="tonal"
          @click="$emit('logout')"
          class="text-capitalize"
        >
          <VIcon :icon="localRail ? 'mdi-logout' : 'mdi-logout-variant'" :class="{ 'me-2': !localRail }" />
          <span v-if="!localRail">退出登录</span>
        </VBtn>
      </div>
    </template>
  </VNavigationDrawer>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { useRouter } from 'vue-router'

const props = defineProps({
  drawer: { type: Boolean, default: true },
  rail: { type: Boolean, default: false },
  permanent: { type: Boolean, default: true },
})
const emit = defineEmits(['update:drawer','update:rail','logout'])

const localDrawer = ref(props.drawer)
const localRail = ref(props.rail)
const router = useRouter()
const userStore = useUserStore()

const can = (p) => userStore.hasPermission(p)

// Sync props to local state
watch(() => props.drawer, v => { localDrawer.value = v })
watch(() => props.rail, v => { localRail.value = v })

// Sync local state to parent
watch(localDrawer, v => emit('update:drawer', v))
watch(localRail, v => emit('update:rail', v))
</script>

<style scoped>
.sidebar-menu {
  border-right-color: rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
