<template>
  <VApp>
    <!-- 调试信息 -->
    
    
    <SidebarMenu
      v-model:drawer="drawer"
      v-model:rail="rail"
      @logout="handleLogout"
    />

    

    <VMain>
      <div class="page-header">
        <VBtn
          icon
          variant="text"
          @click="toggleMenu"
        >
          <VIcon :icon="rail ? 'mdi-menu-open' : 'mdi-menu'" />
        </VBtn>
        <div class="page-title">
          {{ $route.meta.title || '后台管理' }}
        </div>
        <div class="page-actions">
          <VBtn
            icon="mdi-bell-outline"
            variant="text"
          />
          <VBtn
            icon="mdi-help-circle-outline"
            variant="text"
          />
        </div>
      </div>
      <div class="page-content">
        <RouterView />
      </div>

      <VFooter class="justify-center py-4 text-grey-darken-1 text-caption border-t">
        <div>
          云璞网科 © 2018-2025  <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            class="text-grey-darken-1 text-decoration-none hover-blue"
          >鲁ICP备2023016452号</a>
        </div>
      </VFooter>
    </VMain>
  </VApp>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import SidebarMenu from '@/components/SidebarMenu.vue'

const router = useRouter()
const userStore = useUserStore()

const drawer = ref(true)
const rail = ref(false)
const debugMode = ref(false)
const isMobile = ref(false)

const testNavigation = (path) => {
  console.log('Test navigation to:', path)
  router.push(path)
}

// 调试信息
onMounted(() => {
  console.log('Default layout mounted')
  console.log('User store state:', {
    user: userStore.user,
    isLoggedIn: userStore.isLoggedIn,
    token: userStore.token
  })
  
  // 设备断点
  const checkMobile = () => { isMobile.value = window.innerWidth < 1024 }
  checkMobile()
  window.addEventListener('resize', checkMobile)

  // 初始化菜单状态
  if (isMobile.value) { drawer.value = false; rail.value = false } else { drawer.value = true }

  // 添加点击事件监听调议
  setTimeout(() => {
    const listItems = document.querySelectorAll('.v-list-item')
    console.log('Found list items:', listItems.length)
    listItems.forEach((item, index) => {
      console.log(`List item ${index}:`, item)
      console.log(`Item ${index} innerHTML:`, item.innerHTML)
      console.log(`Item ${index} href:`, item.href)
      console.log(`Item ${index} tagName:`, item.tagName)
      
      // 添加测试点击事件
      item.addEventListener('click', (e) => {
        console.log(`List item ${index} clicked!`, e)
        console.log('Target:', e.target)
        console.log('Current target:', e.currentTarget)
      })
    })
  }, 1000)
})

const toggleMenu = () => {
  if (isMobile.value) {
    drawer.value = !drawer.value
  } else {
    rail.value = !rail.value
  }
}

const handleLogout = async () => {
  try {
    await userStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}
</script>

<style>
.hover-blue:hover {
  color: #2196F3 !important;
}
.page-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid rgba(0,0,0,.06); }
.page-title { font-size: 18px; font-weight: 600; }
.page-actions { display: flex; align-items: center; gap: 8px; }
.page-content { padding: 16px; }
</style>

<style lang="scss" scoped>
.layout-wrapper {
  background-color: rgb(var(--v-theme-background));
}
</style>
