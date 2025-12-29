<template>
  <VApp>
    <VMain class="login-main">
      <VContainer fluid class="fill-height pa-0">
        <VRow no-gutters class="fill-height">
          <!-- Left Brand Section -->
          <VCol cols="12" md="6" lg="7" class="d-none d-md-flex brand-col position-relative align-center justify-center">
            <div class="brand-bg"></div>
            <div class="brand-content d-flex flex-column align-center text-center pa-12 text-white w-100" style="z-index: 1">
              <div class="d-flex align-end justify-center mb-8 w-100 ga-4">
                  <div style="width: 72px;">
                    <VImg :src="`${baseUrl}logo.png`" alt="Logo" contain />
                  </div>
                  <h1 class="text-h3 font-weight-bold mb-0">争湃·简历大师</h1>
                </div>
              <p class="text-h6 font-weight-regular opacity-90 mb-12 mx-auto" style="max-width: 520px">
                专业的企业级简历解析与管理平台，<br class="d-md-none d-lg-block" />赋能人力资源数字化转型
              </p>
              
              <div class="d-flex ga-8 justify-center w-100">
                <div class="d-flex flex-column align-center">
                  <VIcon icon="mdi-shield-check" size="32" class="mb-2 opacity-90" />
                  <span class="text-subtitle-2 font-weight-medium">企业级安全</span>
                </div>
                <div class="d-flex flex-column align-center">
                  <VIcon icon="mdi-lightning-bolt" size="32" class="mb-2 opacity-90" />
                  <span class="text-subtitle-2 font-weight-medium">AI 智能解析</span>
                </div>
                <div class="d-flex flex-column align-center">
                  <VIcon icon="mdi-account-group" size="32" class="mb-2 opacity-90" />
                  <span class="text-subtitle-2 font-weight-medium">高效协作</span>
                </div>
              </div>
            </div>
          </VCol>

          <!-- Right Login Form Section -->
          <VCol cols="12" md="6" lg="5" class="d-flex align-center justify-center bg-surface">
            <div class="w-100 pa-8 pa-sm-12" style="max-width: 480px">
              <div class="mb-10">
                <div class="d-flex align-end mb-4">
                  <div style="width: 58px;" class="mr-4">
                    <VImg :src="`${baseUrl}logo.png`" alt="Logo" contain />
                  </div>
                  <h2 class="text-h4 font-weight-bold mb-0">欢迎回来</h2>
                </div>
                <p class="text-body-1 text-medium-emphasis">请输入您的管理员账号以继续</p>
              </div>

              <VForm @submit.prevent="handleLogin" ref="loginForm">
                <VTextField
                  v-model="credentials.username"
                  label="用户名"
                  placeholder="请输入用户名"
                  prepend-inner-icon="mdi-account-outline"
                  variant="outlined"
                  color="primary"
                  :rules="[v => !!v || '请输入用户名']"
                  class="mb-4"
                  required
                />

                <VTextField
                  v-model="credentials.password"
                  label="密码"
                  placeholder="请输入密码"
                  prepend-inner-icon="mdi-lock-outline"
                  :type="isPasswordVisible ? 'text' : 'password'"
                  :append-inner-icon="isPasswordVisible ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                  @click:append-inner="isPasswordVisible = !isPasswordVisible"
                  variant="outlined"
                  color="primary"
                  :rules="[v => !!v || '请输入密码']"
                  class="mb-2"
                  required
                />

                <div class="d-flex align-center justify-between mb-6">
                  <VCheckbox
                    v-model="rememberMe"
                    label="记住我"
                    color="primary"
                    hide-details
                    density="compact"
                  />
                  <VSpacer />
                  <a href="#" class="text-primary text-decoration-none text-body-2 font-weight-medium">忘记密码?</a>
                </div>

                <VBtn
                  type="submit"
                  color="primary"
                  size="large"
                  block
                  flat
                  :loading="loading"
                  height="48"
                  class="text-body-1 font-weight-bold"
                >
                  登录
                </VBtn>
              </VForm>

              <VAlert
                v-if="error"
                type="error"
                variant="tonal"
                class="mt-6"
                closable
                density="comfortable"
              >
                {{ error }}
              </VAlert>
              
              <div class="mt-8 text-center text-caption text-disabled">
                &copy; {{ new Date().getFullYear() }} Super Resume Master. All rights reserved.
              </div>
            </div>
          </VCol>
        </VRow>
      </VContainer>
    </VMain>
  </VApp>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const baseUrl = import.meta.env.BASE_URL
const loginForm = ref(null)
const loading = ref(false)
const error = ref('')
const isPasswordVisible = ref(false)
const rememberMe = ref(false)

const credentials = reactive({
  username: '',
  password: ''
})

const handleLogin = async () => {
  const { valid } = await loginForm.value.validate()
  if (!valid) return

  loading.value = true
  error.value = ''

  try {
    await userStore.login(credentials)
    router.push('/dashboard')
  } catch (err) {
    error.value = err.message || '登录失败，请检查用户名和密码'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-main {
  background-color: rgb(var(--v-theme-surface));
}

.brand-col {
  background-color: rgb(var(--v-theme-primary));
  overflow: hidden;
}

.brand-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.9) 0%, rgba(var(--v-theme-secondary), 0.9) 100%);
}

.brand-bg::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}

.opacity-90 {
  opacity: 0.9;
}
</style>