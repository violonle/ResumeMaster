<template>
  <VApp>
    <VLayout class="layout-wrapper layout-blank">
      <VMain>
        <div class="d-flex flex-column justify-center align-center h-100">
          <RouterView />
        </div>
      </VMain>
    </VLayout>
  </VApp>
</template>

<style lang="scss" scoped>
.layout-blank {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
</style>