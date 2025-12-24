<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
import { useUserStore } from '@/stores/user'
import { onMounted } from 'vue'

const userStore = useUserStore()

onMounted(() => {
  userStore.initializeAuth()
})
</script>

<style>
:root { --app-horizontal-padding: clamp(12px, 2.5vw, 24px) }
.v-application, html, body { overflow-x: hidden }
.v-application .v-container { width: 100% !important; max-width: 100% !important; padding-left: var(--app-horizontal-padding) !important; padding-right: var(--app-horizontal-padding) !important }
.v-main { width: 100% !important }
</style>
