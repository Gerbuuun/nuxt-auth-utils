<script setup lang="ts">
const { fetch } = useUserSession()
const loginModal = ref(false)
const logging = ref(false)
const password = ref('')
const toast = useToast()

async function login() {
  if (logging.value || !password.value) return
  logging.value = true
  await $fetch('/api/login', {
    method: 'POST',
    body: {
      password: password.value,
    },
  })
    .then(() => {
      fetch()
      loginModal.value = false
    })
    .catch((err) => {
      console.log(err)
      toast.add({
        color: 'red',
        title: err.data?.message || err.message,
      })
    })
  logging.value = false
}
</script>

<template>
  <div>
    <UButton
      size="xs"
      color="gray"
      @click="loginModal = true"
    >
      Password Login
    </UButton>
    <UDashboardModal
      v-model="loginModal"
      title="Login with password"
      description="Use the password: 123456"
    >
      <form @submit.prevent="login">
        <UFormGroup label="Password">
          <UInput
            v-model="password"
            name="password"
            type="password"
          />
        </UFormGroup>
        <UButton
          type="submit"
          :disabled="!password"
          color="black"
          class="mt-2"
        >
          Login
        </UButton>
      </form>
    </UDashboardModal>
  </div>
</template>
