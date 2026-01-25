<template>
  <YtLayout>
    <div class="login-page">
      <div class="login-card">
      <!-- 返回按鈕 -->
      <router-link to="/yt" class="back-to-home">
        <font-awesome-icon :icon="['fas', 'arrow-left']" />
        <span>返回首頁</span>
      </router-link>
      <!-- 標題 -->
      <div class="login-header">
        <h1 class="login-title">{{ $t('User.Login') }}</h1>
        <p class="login-subtitle">歡迎回到 MeeTube</p>
      </div>

      <!-- 登入表單 -->
      <form
        class="login-form"
        @submit.prevent="handleLogin"
      >
        <!-- 用戶名 -->
        <div class="form-group">
          <label for="username">{{ $t('User.Username') }}</label>
          <div class="input-wrapper">
            <font-awesome-icon
              :icon="['fas', 'user']"
              class="input-icon"
            />
            <input
              id="username"
              v-model="username"
              type="text"
              class="form-input"
              :placeholder="$t('User.Enter username')"
              autocomplete="username"
              required
            >
          </div>
        </div>

        <!-- 密碼 -->
        <div class="form-group">
          <label for="password">{{ $t('User.Password') }}</label>
          <div class="input-wrapper">
            <font-awesome-icon
              :icon="['fas', 'lock']"
              class="input-icon"
            />
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="form-input"
              :placeholder="$t('User.Enter password')"
              autocomplete="current-password"
              required
            >
            <button
              type="button"
              class="toggle-password"
              @click="showPassword = !showPassword"
            >
              <font-awesome-icon :icon="['fas', showPassword ? 'eye-slash' : 'eye']" />
            </button>
          </div>
        </div>

        <!-- 錯誤訊息 -->
        <div
          v-if="errorMessage"
          class="error-message"
        >
          <font-awesome-icon :icon="['fas', 'exclamation-circle']" />
          {{ errorMessage }}
        </div>

        <!-- 登入按鈕 -->
        <button
          type="submit"
          class="login-btn"
          :disabled="isLoading"
        >
          <span v-if="isLoading" class="spinner" />
          <span v-else>{{ $t('User.Login') }}</span>
        </button>
      </form>

      <!-- 分隔線 -->
      <div class="divider">
        <span>{{ $t('User.Or') }}</span>
      </div>

      <!-- 訪客模式 -->
      <button
        class="guest-btn"
        @click="continueAsGuest"
      >
        <font-awesome-icon :icon="['fas', 'user-secret']" />
        {{ $t('User.Continue as Guest') }}
      </button>

      <!-- 註冊連結 -->
      <p class="register-link">
        {{ $t('User.No account yet') }}
        <router-link to="/register">{{ $t('User.Create Account') }}</router-link>
      </p>

      <!-- 現有帳戶列表 -->
      <div
        v-if="localUsers.length > 0"
        class="existing-accounts"
      >
        <p class="accounts-title">{{ $t('User.Or login with existing account') }}</p>
        <div class="accounts-list">
          <button
            v-for="user in localUsers"
            :key="user._id"
            class="account-item"
            @click="selectUser(user)"
          >
            <ft-user-avatar
              :src="user.avatar"
              :alt="user.displayName || user.username"
              size="small"
            />
            <span class="account-name">{{ user.displayName || user.username }}</span>
          </button>
        </div>
      </div>
      </div>
    </div>
  </YtLayout>
</template>

<script setup>
/**
 * Login.vue - 登入頁面
 *
 * 功能：
 * - 用戶名密碼登入
 * - 顯示密碼切換
 * - 訪客模式
 * - 現有帳戶快速選擇
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import FtUserAvatar from '../../components/ft-user-avatar/ft-user-avatar.vue'
import { YtLayout } from '../../components/yt-theme'

const router = useRouter()
const store = useStore()

// 表單狀態
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const errorMessage = ref('')

// 載入狀態
const isLoading = computed(() => store.getters['user/isLoading'] || false)

// 本地用戶列表
const localUsers = computed(() => store.getters['user/localUsers'] || [])

// 處理登入
async function handleLogin() {
  errorMessage.value = ''

  if (!username.value.trim()) {
    errorMessage.value = '請輸入用戶名'
    return
  }

  if (!password.value) {
    errorMessage.value = '請輸入密碼'
    return
  }

  try {
    const result = await store.dispatch('user/login', {
      username: username.value.trim(),
      password: password.value
    })

    if (result.success) {
      // 登入成功，導向個人檔案
      router.push('/profile')
    } else {
      errorMessage.value = result.error || '登入失敗'
    }
  } catch (error) {
    errorMessage.value = error.message || '登入時發生錯誤'
  }
}

// 繼續使用訪客模式
function continueAsGuest() {
  router.push('/')
}

// 選擇現有帳戶
function selectUser(user) {
  username.value = user.username
  password.value = ''
  // 聚焦到密碼輸入框
  document.getElementById('password')?.focus()
}

// 初始化
onMounted(async () => {
  // 載入本地用戶列表
  await store.dispatch('user/loadLocalUsers')

  // 如果已經登入，導向個人檔案
  if (store.getters['user/isLoggedIn']) {
    router.push('/profile')
  }
})
</script>

<style scoped>
/* 頁面容器 - MeeTube 風格 */
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 120px);
  padding: 40px 20px;
}

/* 返回按鈕 - 更明顯 */
.back-to-home {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  background-color: #3f3f3f;
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
  padding: 12px 20px;
  border-radius: 8px;
  margin-bottom: 24px;
  transition: background-color 0.2s ease;
}

.back-to-home:hover {
  background-color: #555;
}

.back-to-home:active {
  background-color: #666;
}

/* 登入卡片 */
.login-card {
  width: 100%;
  max-width: 420px;
  padding: 32px;
  background-color: #212121;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

/* 標題區域 */
.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-title {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 8px 0;
}

.login-subtitle {
  font-size: 14px;
  color: #aaa;
  margin: 0;
}

/* 表單 */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  color: #888;
  font-size: 16px;
  pointer-events: none;
}

.form-input {
  width: 100%;
  padding: 14px 14px 14px 44px;
  border: 1px solid #3f3f3f;
  border-radius: 10px;
  background-color: #181818;
  color: #fff;
  font-size: 15px;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #3ea6ff;
}

.form-input::placeholder {
  color: #717171;
}

.toggle-password {
  position: absolute;
  right: 12px;
  padding: 8px;
  border: none;
  background: transparent;
  color: #888;
  cursor: pointer;
  font-size: 16px;
}

.toggle-password:hover {
  color: #fff;
}

/* 錯誤訊息 */
.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: rgba(244, 67, 54, 0.1);
  border-radius: 8px;
  color: #f44336;
  font-size: 14px;
}

/* 登入按鈕 */
.login-btn {
  padding: 14px;
  border: none;
  border-radius: 10px;
  background-color: #3ea6ff;
  color: #0f0f0f;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.2s ease, transform 0.15s ease;
}

.login-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 分隔線 */
.divider {
  display: flex;
  align-items: center;
  margin: 24px 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background-color: #3f3f3f;
}

.divider span {
  padding: 0 16px;
  font-size: 13px;
  color: #888;
}

/* 訪客按鈕 */
.guest-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 12px;
  border: 1px solid #3f3f3f;
  border-radius: 10px;
  background: transparent;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.guest-btn:hover {
  border-color: #3ea6ff;
  color: #3ea6ff;
}

/* 註冊連結 */
.register-link {
  text-align: center;
  margin-top: 24px;
  font-size: 14px;
  color: #888;
}

.register-link a {
  color: #3ea6ff;
  text-decoration: none;
  font-weight: 500;
}

.register-link a:hover {
  text-decoration: underline;
}

/* 現有帳戶 */
.existing-accounts {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #3f3f3f;
}

.accounts-title {
  font-size: 13px;
  color: #888;
  text-align: center;
  margin-bottom: 12px;
}

.accounts-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.account-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid #3f3f3f;
  border-radius: 24px;
  background: transparent;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.account-item:hover {
  border-color: #3ea6ff;
  background-color: rgba(62, 166, 255, 0.1);
}

.account-name {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
