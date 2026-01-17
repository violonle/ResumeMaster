<template>
  <div style="display: flex; height: 100vh;">
    <!-- 简单侧边栏 -->
    <div style="width: 260px; background: #f5f5f5; padding: 20px;">
      <h3>测试导航</h3>
      <div style="margin-top: 20px;">
        <button 
          style="display: block; width: 100%; padding: 10px; margin: 5px 0; cursor: pointer;"
          @click="() => { console.log('Test dashboard click'); router.push('/dashboard'); }"
        >
          仪表板 (测试)
        </button>
        <button 
          style="display: block; width: 100%; padding: 10px; margin: 5px 0; cursor: pointer;"
          @click="() => { console.log('Test customers click'); router.push('/customers'); }"
        >
          客户管理 (测试)
        </button>
      </div>
    </div>
    
    <!-- 主内容区 -->
    <div style="flex: 1; padding: 20px;">
      <RouterView />
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

console.log('Test layout loaded')
</script>