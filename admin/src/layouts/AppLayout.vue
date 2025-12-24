<template>
  <VApp class="app-layout">
    <SidebarMenu v-model:drawer="drawer" v-model:rail="rail" :permanent="!isMobile" @logout="handleLogout" />

    <VAppBar height="64" class="px-4 border-b" flat color="surface">
      <VBtn icon variant="text" @click="toggleMenu" class="me-4" color="on-surface" v-if="isMobile">
        <VIcon icon="mdi-menu" />
      </VBtn>
      
      <div class="text-h6 font-weight-bold text-truncate text-on-surface">{{ pageTitle }}</div>
      
      <VSpacer />
      
      <div class="d-flex align-center gap-2">
        <VBtn icon variant="text" size="small" color="on-surface">
          <VIcon icon="mdi-bell-outline" />
        </VBtn>
        <VBtn icon variant="text" size="small" color="on-surface">
          <VIcon icon="mdi-help-circle-outline" />
        </VBtn>
        <VDivider vertical inset class="mx-2" />
        <VAvatar color="primary" size="32" class="cursor-pointer">
          <span class="text-caption text-white font-weight-bold">A</span>
        </VAvatar>
      </div>
    </VAppBar>

    <VMain class="bg-background">
      <VContainer fluid class="pa-6 fill-height align-start app-container">
        <RouterView v-slot="{ Component }">
          <VFadeTransition mode="out-in">
            <component :is="Component" />
          </VFadeTransition>
        </RouterView>
      </VContainer>
    </VMain>
  </VApp>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import SidebarMenu from '@/components/SidebarMenu.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const drawer = ref(true)
const rail = ref(false)
const isMobile = ref(false)

const pageTitle = computed(() => route.meta.title || '后台管理')

const handleLogout = async () => {
  try {
    await userStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024
  if (isMobile.value) {
    rail.value = false
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  
  const savedDrawer = localStorage.getItem('admin:menuDrawer')
  
  if (isMobile.value) {
    drawer.value = false
  } else {
    drawer.value = true // Force drawer open on desktop
    rail.value = false // Force expanded on desktop
  }
})

const toggleMenu = () => {
  if (isMobile.value) {
    drawer.value = !drawer.value
  }
}

watch(drawer, (v) => { try { localStorage.setItem('admin:menuDrawer', String(v)) } catch (_) {} })
// Removed rail watcher to prevent saving/loading rail state
</script>

<style scoped>
.app-layout {
  background-color: rgb(var(--v-theme-background));
}

.app-container {
  width: 100% !important;
  max-width: 100% !important;
  padding-left: clamp(12px, 2.5vw, 24px) !important;
  padding-right: clamp(12px, 2.5vw, 24px) !important;
}

:deep(.v-data-table .v-table__wrapper thead) {
  position: sticky;
  top: 0;
  z-index: 1;
}
:deep(.v-data-table .v-data-table__th) {
  background-color: #f5f7fa !important;
  border-bottom: 1px solid #e5e7eb !important;
  color: #334155 !important;
  font-weight: 600 !important;
  padding: 12px 16px !important;
}
:deep(.v-data-table .v-table__wrapper thead th:first-child) { border-top-left-radius: 12px }
:deep(.v-data-table .v-table__wrapper thead th:last-child) { border-top-right-radius: 12px }

.gap-2 {
  gap: 8px;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
