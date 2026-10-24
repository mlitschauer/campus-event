<script setup lang="ts">
import ApiStatus from './components/ApiStatus.vue'
</script>

<template>
  <main class="app">
    <h1>CampusEvent</h1>
    <p>Deine Plattform für Campus-Veranstaltungen.</p>

    <ApiStatus />
  </main>
</template>

<style scoped>
.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 24px;
}
</style>