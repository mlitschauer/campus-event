<script setup lang="ts">
import ApiDataCheck from '../components/ApiDataCheck.vue'

const showApiDebug = import.meta.env.DEV
</script>

<template>
  <div class="page-content">

    <section class="page-heading">
      <p class="eyebrow">ENTDECKEN</p>

      <h1>Veranstaltungen</h1>

      <p class="lead">
        Entdecke, was auf deinem Campus los ist.
        Von Partys über Workshops bis zu Sportevents.
      </p>
    </section>

    <section class="info-panel">
      <h2>Eventübersicht</h2>

      <p>
        In CE-13 stellen wir hier unsere Veranstaltungen
        als Eventkarten dar.
      </p>
    </section>

    <!-- API-Diagnose nur in der Entwicklung -->
    <ApiDataCheck v-if="showApiDebug" />

  </div>
</template>