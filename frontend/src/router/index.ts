import {
  createRouter,
  createWebHashHistory,
  type RouteRecordRaw,
} from 'vue-router'

import { useAuth } from '../composables/useAuth'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: 'Startseite' },
  },
  {
    path: '/events',
    name: 'events',
    component: () => import('../views/EventsView.vue'),
    meta: { title: 'Veranstaltungen' },
  },
  {
    path: '/events/:id',
    name: 'event-detail',
    component: () => import('../views/EventDetailView.vue'),
    props: true,
    meta: { title: 'Eventdetails' },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { title: 'Anmelden' },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/RegisterView.vue'),
    meta: { title: 'Registrieren' },
  },
  {
    path: '/account',
    name: 'account',
    component: () => import('../views/AccountView.vue'),
    meta: {
      title: 'Mein Konto',
      requiresAuth: true,
    },
  },
  {
    path: '/organizer',
    name: 'organizer-dashboard',

    component: () =>
      import('../views/OrganizerDashboardView.vue'),

    meta: {
      title: 'Veranstalter-Dashboard',
      requiresAuth: true,
      requiresRole: 'organizer',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue'),
    meta: { title: 'Seite nicht gefunden' },
  },

  {
    path: '/organizer/events/new',
    name: 'organizer-event-new',

    component: () =>
      import('../views/OrganizerEventFormView.vue'),

    meta: {
      title: 'Neue Veranstaltung',
      requiresAuth: true,
      requiresRole: 'organizer',
    },
  },
  {
    path: '/organizer/events/:id/edit',
    name: 'organizer-event-edit',

    component: () =>
      import('../views/OrganizerEventFormView.vue'),

    meta: {
      title: 'Veranstaltung bearbeiten',
      requiresAuth: true,
      requiresRole: 'organizer',
    },
  },

  {
    path: '/my-registrations',
    name: 'my-registrations',

    component: () =>
      import('../views/MyRegistrationsView.vue'),

    meta: {
      title: 'Meine Anmeldungen',
      requiresAuth: true,
      requiresRole: 'student',
    },
  },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,

  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

// Geschützte Routen überprüfen
router.beforeEach(async (to) => {
  // Öffentliche Routen benötigen keine Authentifizierung
  if (!to.meta.requiresAuth) {
    return true
  }

  const auth = useAuth()

  // Session prüfen bzw. wiederherstellen
  await auth.initializeAuth()

  // Gast -> Login
  if (!auth.isAuthenticated.value) {
    return {
      name: 'login',
      query: {
        redirect: to.fullPath,
      },
    }
  }

  const requiredRole = to.meta.requiresRole

  if (
    typeof requiredRole === 'string' &&
    auth.user.value?.role !== requiredRole
  ) {
    return {
      name: 'account',
    }
  }

  return true
})

// Browser-Titel aktualisieren
router.afterEach((to) => {
  const title = String(to.meta.title ?? 'CampusEvent')
  document.title = `${title} | CampusEvent`
})

export default router