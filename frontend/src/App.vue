<script setup lang="ts">
import AppHeader from './components/layout/AppHeader.vue'
import AppFooter from './components/layout/AppFooter.vue'
</script>

<template>
  <div class="app-shell">

    <AppHeader />

    <main class="main-content">
      <RouterView />
    </main>

    <AppFooter />

  </div>
</template>