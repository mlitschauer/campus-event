<script setup lang="ts">
import type { Category } from '../../types/category'

// Kategorien werden von der Elternkomponente übergeben
defineProps<{
  categories: Category[]
}>()

// Bidirektionale Bindung an EventsView
const search = defineModel<string>('search', {
  required: true,
})

const selectedCategory = defineModel<string>('category', {
  required: true,
})

// Ereignis zum Zurücksetzen aller Filter
const emit = defineEmits<{
  reset: []
}>()
</script>

<template>
  <section class="event-filters" aria-label="Veranstaltungen filtern">

    <div class="event-filters__controls">

      <!-- Suchfeld -->
      <div class="filter-field filter-field--search">
        <label for="event-search">
          Veranstaltung suchen
        </label>

        <input
          id="event-search"
          v-model="search"
          type="search"
          maxlength="100"
          autocomplete="off"
          placeholder="Titel, Ort oder Beschreibung ..."
        />
      </div>

      <!-- Kategorie -->
      <div class="filter-field filter-field--category">
        <label for="event-category">
          Kategorie
        </label>

        <select
          id="event-category"
          v-model="selectedCategory"
        >
          <option value="">
            Alle Kategorien
          </option>

          <option
            v-for="item in categories"
            :key="item.id"
            :value="item.slug"
          >
            {{ item.name }}
          </option>
        </select>
      </div>

      <!-- Filter zurücksetzen -->
      <button
        v-if="search || selectedCategory"
        type="button"
        class="filter-reset"
        @click="emit('reset')"
      >
        Zurücksetzen
      </button>

    </div>
  </section>
</template>

<style scoped>
.event-filters {
  margin-bottom: 32px;
  padding: 24px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
}

.event-filters__controls {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 16px;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-field--search {
  flex: 2;
  min-width: 200px;
}

.filter-field--category {
  flex: 1;
  min-width: 180px;
}

.filter-field label {
  color: #334155;
  font-size: 13px;
  font-weight: 700;
}

.filter-field input,
.filter-field select {
  width: 100%;
  min-height: 46px;
  padding: 12px 14px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  color: #17233b;
  font: inherit;
  font-size: 14px;
}

.filter-field input:focus,
.filter-field select:focus {
  border-color: #4f46e5;
  outline: 2px solid #c7d2fe;
  outline-offset: 1px;
}

.filter-reset {
  min-height: 46px;
  padding: 0 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  color: #4f46e5;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.filter-reset:hover {
  background: #eef2ff;
}

.filter-reset:focus-visible {
  outline: 3px solid #818cf8;
  outline-offset: 2px;
}

@media (max-width: 620px) {
  .event-filters {
    padding: 18px;
  }

  .event-filters__controls {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-field--search,
  .filter-field--category {
    flex: initial;
    min-width: 0;
    width: 100%;
  }
}
</style>