<script setup lang="ts">
const { fetch } = useUserSession()
const loginModal = ref(false)
const logging = ref(false)

const { isSupported, register: passkeyRegister, login: passkeyLogin } = usePasskey()

async function login() {
  if (logging.value) return
  logging.value = true
  await passkeyLogin('/api/passkey/login')
  logging.value = false
  await fetch()
  loginModal.value = false
}

const displayName = ref('johndoe')
const uniqueName = ref('John Doe')
async function register() {
  if (logging.value || !uniqueName.value) return
  logging.value = true
  await passkeyRegister('/api/passkey/register', uniqueName, displayName)
  logging.value = false
  await fetch()
  loginModal.value = false
}
</script>

<template>
  <UButton
    size="xs"
    color="gray"
    @click="loginModal = true"
  >
    Passkey Login
  </UButton>
  <UDashboardModal
    v-model="loginModal"
    title="Login with passkey"
  >
    <form @submit.prevent="login">
      <UButton
        type="submit"
        :disabled="!isSupported"
        color="black"
        block
      >
        Login
      </UButton>
    </form>
    <form
      class="space-y-2"
      @submit.prevent="register"
    >
      <UFormGroup
        label="Unique Name"
        name="uniqueName"
      >
        <UInput v-model="uniqueName" />
      </UFormGroup>
      <UFormGroup
        label="Display Name"
        name="displayName"
      >
        <UInput v-model="displayName" />
      </UFormGroup>
      <UButton
        type="submit"
        color="black"
        block
      >
        Register
      </UButton>
    </form>
  </UDashboardModal>
</template>
