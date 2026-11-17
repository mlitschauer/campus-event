<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

import type { CampusEvent } from '../../types/event'

import type {
    EventFormInput,
    EventFormCategory,
} from '../../types/eventManagement'

const props = defineProps<{
    mode: 'create' | 'edit'
    event: CampusEvent | null
    categories: EventFormCategory[]
    submitting: boolean
    serverError: string
    serverFieldErrors: Record<string, string>
}>()

const emit = defineEmits<{
    (e: 'submit', input: EventFormInput): void
}>()

type FormField = keyof EventFormInput

type FormErrors = Partial<
    Record<FormField, string>
>

// Formularwerte als editierbare Strings
const form = reactive({
    title: '',
    description: '',
    location: '',
    startsAt: '',
    endsAt: '',
    capacity: '50',
    categoryId: '',
})

const errors = ref<FormErrors>({})

// ISO-Datum aus PostgreSQL für datetime-local formatieren.
// Wichtig: Keine direkte Verwendung von toISOString().slice()!
function toLocalDateTime(iso: string): string {
    const date = new Date(iso)

    if (Number.isNaN(date.getTime())) {
        return ''
    }

    const pad = (value: number) =>
        String(value).padStart(2, '0')

    return [
        date.getFullYear(),
        '-',
        pad(date.getMonth() + 1),
        '-',
        pad(date.getDate()),
        'T',
        pad(date.getHours()),
        ':',
        pad(date.getMinutes()),
    ].join('')
}

// Vorhandenes Event in das Formular übernehmen
watch(
    () => props.event,
    (event) => {
        if (event) {
            form.title = event.title
            form.description = event.description
            form.location = event.location
            form.startsAt = toLocalDateTime(event.startsAt)
            form.endsAt = toLocalDateTime(event.endsAt)
            form.capacity = String(event.capacity)
            form.categoryId = event.category.id
        } else {
            form.title = ''
            form.description = ''
            form.location = ''
            form.startsAt = ''
            form.endsAt = ''
            form.capacity = '50'
            form.categoryId = ''
        }

        errors.value = {}
    },
    { immediate: true },
)

// Erste Kategorie beim Erstellen vorauswählen
watch(
    () => props.categories,
    (categories) => {
        if (
            props.mode === 'create' &&
            !form.categoryId &&
            categories.length > 0
        ) {
            form.categoryId = categories[0].id
        }
    },
    { immediate: true },
)

// Lokale und serverseitige Feldfehler kombinieren
function fieldError(field: FormField): string {
    return (
        errors.value[field] ??
        props.serverFieldErrors[field] ??
        ''
    )
}

function validateAndSubmit(): void {
    const nextErrors: FormErrors = {}

    const title = form.title.trim()
    const description = form.description.trim()
    const location = form.location.trim()

    // Titel prüfen
    if (title.length < 3 || title.length > 120) {
        nextErrors.title =
            'Der Titel muss zwischen 3 und 120 Zeichen enthalten.'
    }

    // Beschreibung prüfen
    if (
        description.length < 10 ||
        description.length > 5000
    ) {
        nextErrors.description =
            'Die Beschreibung muss zwischen 10 und 5000 Zeichen enthalten.'
    }

    // Ort prüfen
    if (
        location.length < 3 ||
        location.length > 200
    ) {
        nextErrors.location =
            'Der Ort muss zwischen 3 und 200 Zeichen enthalten.'
    }

    // Kategorie prüfen
    if (
        !props.categories.some(
            (category) => category.id === form.categoryId,
        )
    ) {
        nextErrors.categoryId =
            'Bitte wähle eine gültige Kategorie.'
    }

    // Kapazität prüfen
    const capacity = Number(form.capacity)

    if (
        String(form.capacity).trim() === '' ||
        !Number.isInteger(capacity) ||
        capacity < 1 ||
        capacity > 10000
    ) {
        nextErrors.capacity =
            'Die Kapazität muss eine ganze Zahl zwischen 1 und 10000 sein.'
    }

    // Datum und Uhrzeit prüfen
    const startsAt = new Date(form.startsAt)
    const endsAt = new Date(form.endsAt)

    const validStart =
        form.startsAt !== '' &&
        !Number.isNaN(startsAt.getTime()) &&
        toLocalDateTime(startsAt.toISOString()) ===
        form.startsAt.slice(0, 16)

    const validEnd =
        form.endsAt !== '' &&
        !Number.isNaN(endsAt.getTime()) &&
        toLocalDateTime(endsAt.toISOString()) ===
        form.endsAt.slice(0, 16)

    if (!validStart) {
        nextErrors.startsAt =
            'Bitte gib einen gültigen Veranstaltungsbeginn ein.'
    }

    if (!validEnd) {
        nextErrors.endsAt =
            'Bitte gib ein gültiges Veranstaltungsende ein.'
    }

    if (
        validStart &&
        validEnd &&
        endsAt.getTime() <= startsAt.getTime()
    ) {
        nextErrors.endsAt =
            'Das Veranstaltungsende muss nach dem Beginn liegen.'
    }

    errors.value = nextErrors

    if (Object.keys(nextErrors).length > 0) {
        return
    }

    // Browserlokale Uhrzeit in einen eindeutigen
    // ISO-Zeitpunkt mit UTC-Zeitzone umwandeln
    emit('submit', {
        title,
        description,
        location,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        capacity,
        categoryId: form.categoryId,
    })
}
</script>

<template>
    <form class="event-form" novalidate @submit.prevent="validateAndSubmit">
        <p v-if="serverError" class="event-form__error" role="alert">
            {{ serverError }}
        </p>

        <p v-if="Object.keys(errors).length > 0" class="event-form__error" role="alert">
            Bitte überprüfe die markierten Eingabefelder.
        </p>

        <fieldset class="event-form__fields" :disabled="submitting">
            <!-- Titel -->
            <div class="event-form__field">
                <label for="event-title">
                    Veranstaltungstitel *
                </label>

                <input id="event-title" v-model="form.title" type="text" name="title" maxlength="120"
                    placeholder="z. B. Campus Sommerfest" :aria-invalid="Boolean(fieldError('title'))" />

                <p v-if="fieldError('title')" class="field-error">
                    {{ fieldError('title') }}
                </p>
            </div>

            <!-- Beschreibung -->
            <div class="event-form__field">
                <label for="event-description">
                    Beschreibung *
                </label>

                <textarea id="event-description" v-model="form.description" name="description" rows="6" maxlength="5000"
                    placeholder="Beschreibe die Veranstaltung ..."
                    :aria-invalid="Boolean(fieldError('description'))"></textarea>

                <div class="event-form__hint-row">
                    <span v-if="fieldError('description')" class="field-error">
                        {{ fieldError('description') }}
                    </span>
                    <span>
                        {{ form.description.length }} / 5000
                    </span>
                </div>
            </div>

            <!-- Ort -->
            <div class="event-form__field">
                <label for="event-location">
                    Veranstaltungsort *
                </label>

                <input id="event-location" v-model="form.location" type="text" name="location" maxlength="200"
                    placeholder="z. B. DHBW Mosbach" :aria-invalid="Boolean(fieldError('location'))" />

                <p v-if="fieldError('location')" class="field-error">
                    {{ fieldError('location') }}
                </p>
            </div>

            <!-- Kategorie und Kapazität -->
            <div class="event-form__grid">

                <div class="event-form__field">
                    <label for="event-category">
                        Kategorie *
                    </label>

                    <select id="event-category" v-model="form.categoryId" name="categoryId"
                        :aria-invalid="Boolean(fieldError('categoryId'))">
                        <option value="" disabled>
                            Kategorie auswählen
                        </option>

                        <option v-for="category in categories" :key="category.id" :value="category.id">
                            {{ category.name }}
                        </option>
                    </select>

                    <p v-if="fieldError('categoryId')" class="field-error">
                        {{ fieldError('categoryId') }}
                    </p>
                </div>

                <div class="event-form__field">
                    <label for="event-capacity">
                        Maximale Teilnehmerzahl *
                    </label>

                    <input id="event-capacity" v-model="form.capacity" type="number" name="capacity" min="1" max="10000"
                        step="1" :aria-invalid="Boolean(fieldError('capacity'))" />

                    <p v-if="fieldError('capacity')" class="field-error">
                        {{ fieldError('capacity') }}
                    </p>
                </div>

            </div>

            <!-- Start und Ende -->
            <div class="event-form__grid">

                <div class="event-form__field">
                    <label for="event-start">
                        Veranstaltungsbeginn *
                    </label>

                    <input id="event-start" v-model="form.startsAt" type="datetime-local" name="startsAt" step="60"
                        :aria-invalid="Boolean(fieldError('startsAt'))" />

                    <p v-if="fieldError('startsAt')" class="field-error">
                        {{ fieldError('startsAt') }}
                    </p>
                </div>

                <div class="event-form__field">
                    <label for="event-end">
                        Veranstaltungsende *
                    </label>

                    <input id="event-end" v-model="form.endsAt" type="datetime-local" name="endsAt" step="60"
                        :aria-invalid="Boolean(fieldError('endsAt'))" />

                    <p v-if="fieldError('endsAt')" class="field-error">
                        {{ fieldError('endsAt') }}
                    </p>
                </div>

            </div>

            <p class="event-form__hint">
                Datum und Uhrzeit beziehen sich auf die lokale
                Zeitzone deines Geräts. Zum Veröffentlichen muss
                der Veranstaltungsbeginn in der Zukunft liegen.
            </p>

        </fieldset>

        <!-- Aktionen -->
        <div class="event-form__actions">

            <RouterLink :to="{ name: 'organizer-dashboard' }" class="button button-secondary">
                Abbrechen
            </RouterLink>

            <button type="submit" class="button button-primary" :disabled="submitting">
                <template v-if="submitting">
                    Wird gespeichert ...
                </template>

                <template v-else-if="mode === 'create'">
                    Entwurf erstellen
                </template>

                <template v-else>
                    Änderungen speichern
                </template>
            </button>

        </div>
    </form>
</template>

<style scoped>
.event-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.event-form__fields {
    display: flex;
    flex-direction: column;
    gap: 24px;
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
}

.event-form__field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
}

.event-form__field label {
    color: #334155;
    font-size: 14px;
    font-weight: 700;
}

.event-form__field input,
.event-form__field textarea,
.event-form__field select {
    width: 100%;
    min-width: 0;
    padding: 12px 14px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    background: #ffffff;
    color: #17233b;
    font: inherit;
    font-size: 14px;
}

.event-form__field input,
.event-form__field select {
    min-height: 48px;
}

.event-form__field textarea {
    resize: vertical;
    line-height: 1.6;
}

.event-form__field input:focus,
.event-form__field textarea:focus,
.event-form__field select:focus {
    outline: 2px solid #c7d2fe;
    outline-offset: 1px;
    border-color: #4f46e5;
}

.event-form__field [aria-invalid="true"] {
    border-color: #dc2626;
}

.event-form__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
}

.event-form__hint-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: #64748b;
    font-size: 12px;
}

.event-form__hint,
.field-error {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
}

.event-form__hint {
    color: #64748b;
}

.field-error {
    color: #b91c1c;
}

.event-form__error {
    margin: 0;
    padding: 14px 16px;
    border: 1px solid #fecaca;
    border-radius: 10px;
    background: #fef2f2;
    color: #b91c1c;
    font-size: 14px;
    line-height: 1.6;
}

.event-form__actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 12px;
    padding-top: 24px;
    border-top: 1px solid #e2e8f0;
}

.event-form__actions button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

@media (max-width: 620px) {
    .event-form__grid {
        grid-template-columns: 1fr;
    }

    .event-form__actions {
        flex-direction: column-reverse;
    }

    .event-form__actions .button {
        width: 100%;
        justify-content: center;
        text-align: center;
    }
}
</style>