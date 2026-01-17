<template>
  <VApp>
    <VLayout class="layout-wrapper layout-blank flex-column">
      <VMain class="flex-grow-1">
        <div class="d-flex flex-column justify-center align-center h-100">
          <RouterView />
        </div>
      </VMain>
      <VFooter class="justify-center py-4 text-white text-caption bg-transparent">
        <div>
          云璞网科 © 2018-2025  <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            class="text-white text-decoration-none opacity-80"
          >鲁ICP备2023016452号</a>
        </div>
      </VFooter>
    </VLayout>
  </VApp>
</template>

<style lang="scss" scoped>
.layout-blank {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
</style>