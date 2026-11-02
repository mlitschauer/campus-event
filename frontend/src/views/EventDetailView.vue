<script setup lang="ts">
defineProps<{
  id: string
}>()
</script>

<template>
  <div class="page-content">

    <RouterLink to="/events" class="text-link">
      ← Zurück zu den Veranstaltungen
    </RouterLink>

    <section class="page-heading">
      <p class="eyebrow">EVENTDETAILS</p>
      <h1>Veranstaltungsdetails</h1>

      <p class="lead">
        Hier werden später die Informationen
        zur ausgewählten Veranstaltung angezeigt.
      </p>
    </section>

    <div class="info-panel">
      <h2>Ausgewähltes Event</h2>

      <p>
        <strong>Event-ID:</strong>
        <code>{{ id }}</code>
      </p>

      <p>
        Die vollständigen Eventdaten laden wir
        in CE-15 über unsere REST-API.
      </p>
    </div>

  </div>
</template>