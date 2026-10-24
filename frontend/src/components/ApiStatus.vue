<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getApiHealth } from '../services/healthService'

type ApiStatus = 'loading' | 'online' | 'error'

const status = ref<ApiStatus>('loading')
const message = ref('Verbindung wird geprüft ...')

async function checkConnection() {
  status.value = 'loading'
  message.value = 'Verbindung wird geprüft ...'

  try {
    const response = await getApiHealth()

    if (response.status !== 'ok') {
      throw new Error('Unerwartete API-Antwort')
    }

    status.value = 'online'
    message.value = response.message
  } catch (error) {
    status.value = 'error'
    message.value =
      error instanceof Error
        ? error.message
        : 'Unbekannter Fehler'
  }
}

onMounted(() => {
  void checkConnection()
})
</script>

<template>
  <section class="api-status">
    <h2>Backend-Verbindung</h2>

    <p>
      Status:
      <strong v-if="status === 'loading'">
        Wird geprüft ...
      </strong>
      <strong v-else-if="status === 'online'">
        Online
      </strong>
      <strong v-else>
        Offline / Fehler
      </strong>
    </p>

    <p role="status">{{ message }}</p>

    <button
      type="button"
      :disabled="status === 'loading'"
      @click="checkConnection"
    >
      Verbindung erneut prüfen
    </button>
  </section>
</template>

<style scoped>
.api-status {
  padding: 24px;
  border: 1px solid #ddd;
  border-radius: 12px;
}

button {
  margin-top: 12px;
  padding: 10px 16px;
  cursor: pointer;
}
</style>