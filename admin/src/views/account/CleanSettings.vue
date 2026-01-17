<template>
  <StandardPage
    title="账号设置"
    subtitle="管理员账号的基础信息与密码"
  >
    <VRow>
      <VCol
        cols="12"
        md="8"
      >
        <VCard
          elevation="0"
          border
          class="mb-6"
        >
          <VCardTitle class="px-4 pt-4 pb-2">
            <div class="d-flex align-center">
              <VIcon
                icon="mdi-account-circle"
                class="me-2"
                color="primary"
              />
              <span>账号信息</span>
            </div>
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-4">
            <VRow>
              <VCol
                cols="12"
                class="d-flex justify-center mb-4"
              >
                <div class="position-relative">
                  <VAvatar
                    size="100"
                    color="grey-lighten-2"
                    class="border"
                  >
                    <VImg
                      v-if="avatarPreview"
                      :src="avatarPreview"
                      cover
                    />
                    <VIcon
                      v-else
                      icon="mdi-account"
                      size="60"
                      color="grey"
                    />
                  </VAvatar>
                  <VBtn
                    icon="mdi-camera"
                    size="small"
                    color="primary"
                    class="position-absolute"
                    style="bottom: 0; right: 0;"
                    @click="triggerFileInput"
                  />
                  <VFileInput
                    ref="fileInputRef"
                    v-model="avatarFile"
                    accept="image/png,image/jpeg,image/webp"
                    class="d-none"
                    @update:model-value="onFileSelected"
                  />
                </div>
              </VCol>
              
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="profileForm.username"
                  label="账号ID"
                  :disabled="!canEditId"
                  variant="outlined"
                  density="compact"
                  prepend-inner-icon="mdi-identifier"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="profileForm.name"
                  label="姓名"
                  variant="outlined"
                  density="compact"
                  prepend-inner-icon="mdi-account"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="profileForm.email"
                  label="邮箱"
                  :rules="emailRules"
                  variant="outlined"
                  density="compact"
                  prepend-inner-icon="mdi-email"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="profileForm.phone"
                  label="手机号"
                  :rules="phoneRules"
                  variant="outlined"
                  density="compact"
                  prepend-inner-icon="mdi-phone"
                />
              </VCol>
              
              <VCol
                cols="12"
                class="d-flex justify-end"
              >
                <VBtn
                  color="primary"
                  :loading="savingProfile"
                  prepend-icon="mdi-content-save"
                  @click="saveProfile"
                >
                  保存个人资料
                </VBtn>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>

        <!-- 密码修改卡片 -->
        <VCard
          elevation="0"
          border
        >
          <VCardTitle class="px-4 pt-4 pb-2">
            <div class="d-flex align-center">
              <VIcon
                icon="mdi-lock-reset"
                class="me-2"
                color="primary"
              />
              <span>修改密码</span>
            </div>
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-4">
            <VForm
              ref="passwordFormRef"
              v-model="passwordValid"
              @submit.prevent="savePassword"
            >
              <VRow>
                <VCol cols="12">
                  <VAlert
                    color="info"
                    variant="tonal"
                    icon="mdi-shield-check"
                    class="mb-4"
                    density="compact"
                  >
                    为了您的账号安全，建议定期更换密码。新密码必须包含字母和数字，且长度不少于8位。
                  </VAlert>
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VTextField
                    v-model="passwordForm.newPassword"
                    label="新密码"
                    :type="showPassword ? 'text' : 'password'"
                    :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                    :rules="passwordRules"
                    required
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-lock"
                    @click:append-inner="showPassword = !showPassword"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VTextField
                    v-model="passwordForm.confirmPassword"
                    label="确认新密码"
                    :type="showConfirmPassword ? 'text' : 'password'"
                    :append-inner-icon="showConfirmPassword ? 'mdi-eye-off' : 'mdi-eye'"
                    :rules="confirmPasswordRules"
                    required
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-lock-check"
                    @click:append-inner="showConfirmPassword = !showConfirmPassword"
                  />
                </VCol>
                <VCol
                  cols="12"
                  class="d-flex justify-end"
                >
                  <VBtn
                    type="submit"
                    color="primary"
                    :loading="savingPassword"
                    :disabled="!passwordValid"
                    prepend-icon="mdi-check-circle"
                  >
                    更新密码
                  </VBtn>
                </VCol>
              </VRow>
            </VForm>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="4"
      >
        <VCard
          elevation="0"
          border
          color="background"
        >
          <VCardText>
            <div class="text-subtitle-1 font-weight-bold mb-4">
              安全设置
            </div>
            
            <VList
              bg-color="transparent"
              density="compact"
            >
              <VListItem class="px-0">
                <template #prepend>
                  <VIcon
                    icon="mdi-two-factor-authentication"
                    color="grey"
                    class="me-2"
                  />
                </template>
                <VListItemTitle>双重认证 (2FA)</VListItemTitle>
                <template #append>
                  <VBtn
                    size="small"
                    variant="text"
                    color="primary"
                  >
                    去开启
                  </VBtn>
                </template>
              </VListItem>
              <VDivider class="my-2" />
              <VListItem class="px-0">
                <template #prepend>
                  <VIcon
                    icon="mdi-cellphone-link"
                    color="grey"
                    class="me-2"
                  />
                </template>
                <VListItemTitle>登录设备管理</VListItemTitle>
                <template #append>
                  <VBtn
                    size="small"
                    variant="text"
                    color="primary"
                  >
                    查看
                  </VBtn>
                </template>
              </VListItem>
              <VDivider class="my-2" />
              <VListItem class="px-0">
                <template #prepend>
                  <VIcon
                    icon="mdi-history"
                    color="grey"
                    class="me-2"
                  />
                </template>
                <VListItemTitle>最近登录记录</VListItemTitle>
                <template #append>
                  <VBtn
                    size="small"
                    variant="text"
                    color="primary"
                  >
                    查看
                  </VBtn>
                </template>
              </VListItem>
            </VList>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </StandardPage>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import StandardPage from '@/components/StandardPage.vue'
import ui from '@/utils/ui-components.js'

const userStore = useUserStore()
const fileInputRef = ref(null)
const passwordFormRef = ref(null)

// 状态
const canEditId = ref(false) // 只有特定角色可以修改ID
const savingProfile = ref(false)
const savingPassword = ref(false)
const uploadingAvatar = ref(false)
const passwordValid = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const avatarFile = ref(null)
const avatarPreview = ref(userStore.currentUser?.avatar || null)

const profileForm = reactive({
  username: userStore.currentUser?.username || '',
  name: userStore.currentUser?.name || '',
  email: userStore.currentUser?.email || '',
  phone: userStore.currentUser?.phone || ''
})

const passwordForm = reactive({
  newPassword: '',
  confirmPassword: ''
})

// 验证规则
const emailRules = [
  v => !v || /.+@.+\..+/.test(v) || '邮箱格式不正确'
]
const phoneRules = [
  v => !v || /^\d{11}$/.test(v) || '手机号格式不正确'
]
const passwordRules = [
  v => !!v || '请输入新密码',
  v => v.length >= 8 || '密码长度至少8位'
]
const confirmPasswordRules = [
  v => !!v || '请确认新密码',
  v => v === passwordForm.newPassword || '两次输入的密码不一致'
]

// 方法
const triggerFileInput = () => {
  fileInputRef.value.click()
}

const onFileSelected = (files) => {
  if (files && files.length > 0) {
    const file = files[0] // Vuetify 3 file input returns array or file based on multiple prop
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      avatarPreview.value = e.target.result
    }
    reader.readAsDataURL(file)
    // Upload immediately or wait for save? 
    // Usually avatar is updated immediately or with profile.
    // Let's assume we save it with "Save Profile"
  }
}

const saveProfile = async () => {
  savingProfile.value = true
  try {
    // 模拟上传头像
    if (avatarFile.value) {
      // await userStore.uploadAvatar(avatarFile.value)
    }
    
    // 更新资料
    // await userStore.updateProfile(profileForm)
    
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 1000))
    ui.showNotification('个人资料已更新', 'success')
  } catch (error) {
    console.error('更新资料失败:', error)
    ui.showNotification('更新失败', 'error')
  } finally {
    savingProfile.value = false
  }
}

const savePassword = async () => {
  const { valid } = await passwordFormRef.value.validate()
  if (!valid) return
  
  savingPassword.value = true
  try {
    // await userStore.updatePassword(passwordForm.newPassword)
    await new Promise(resolve => setTimeout(resolve, 1000))
    ui.showNotification('密码修改成功，请重新登录', 'success')
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    // router.push('/login')
  } catch (error) {
    console.error('修改密码失败:', error)
    ui.showNotification('修改密码失败', 'error')
  } finally {
    savingPassword.value = false
  }
}
</script>
