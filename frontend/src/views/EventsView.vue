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
        Hier werden wir in CE-12 und CE-13
        die Veranstaltungen aus unserer REST-API
        als Eventkarten darstellen.
      </p>

      <RouterLink
        :to="{
          name: 'event-detail',
          params: {
            id: '00000000-0000-4000-8000-000000000101'
          }
        }"
        class="text-link"
      >
        Demo: Eventdetailseite testen →
      </RouterLink>
    </section>

  </div>
</template>