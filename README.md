# CampusEvent

CampusEvent ist eine Eventplattform für Hochschulen. Studierende finden Campusveranstaltungen und verwalten ihre Teilnahmen. Veranstalter pflegen und veröffentlichen ihre eigenen Veranstaltungen.

| Zugriff | Funktionen |
| --- | --- |
| Öffentlich | Veranstaltungen suchen und nach Kategorie filtern, Details und Belegung ansehen, ein Studierendenkonto erstellen, einloggen |
| Studierende | Sich für veröffentlichte, noch nicht begonnene Events mit freien Plätzen anmelden, eigene Anmeldungen einsehen und bis zum Eventbeginn zurückziehen |
| Veranstalter | Eigene Events im Dashboard verwalten, Entwürfe erstellen, bearbeiten, löschen oder veröffentlichen und veröffentlichte Events absagen |
| Beide Rollen | Kontoseite, Session-Wiederherstellung und Logout |

Das Frontend nutzt Vue 3 mit Composition API, Vue Router und TypeScript. Typisierte Services rufen die REST-API mit Fetch auf und verarbeiten JSON. Vite leitet lokale `/api`-Anfragen an Deno/Hono weiter. Das Backend prüft Anfragen mit Middleware und Zod und greift über SQL-Repositories auf PostgreSQL 18 zu. Docker Compose betreibt die Datenbank mit einem persistenten Volume.

## Lokaler Start

Voraussetzungen sind Git, Docker mit Compose, Node.js mit npm und Deno mit Argon2id-Unterstützung in WebCrypto. Geprüft wurde mit Node.js 24 und Deno 2.9.

### Konfiguration

Im Repository-Stamm bei der ersten Einrichtung die lokalen Konfigurationsdateien aus den Vorlagen anlegen.

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
```

| Variable | Einstellung |
| --- | --- |
| `POSTGRES_PASSWORD` | In der Stammdatei `.env` ein lokales Datenbankpasswort setzen. |
| `DATABASE_URL` | In `backend/.env` den Passwortplatzhalter durch dasselbe Passwort ersetzen. Sonderzeichen im Passwort für die URL kodieren. |
| `APP_ENV` | Optional im Backend. `production` aktiviert Secure-Cookies und verlangt eine konfigurierte HTTPS-Frontend-Origin. |
| `FRONTEND_ORIGIN` | Optional im Backend. Legt die erlaubte Browser-Origin für Schreibzugriffe fest. Der lokale Standard ist `http://localhost:5173`. Für Login und Schreibzugriffe die Anwendung mit derselben Origin öffnen. |
| `VITE_API_URL` | Optional im Frontend. Leer lassen, um relative `/api`-URLs und den lokalen Proxy zu verwenden. Der Fetch-Client sendet Cookies bei Anfragen an dieselbe Origin. |

### PostgreSQL

Im Repository-Stamm den Datenbankdienst starten. Er ist lokal unter `127.0.0.1:5433` erreichbar.

```powershell
docker compose up -d postgres
docker compose ps
```

Sobald der Dienst den Status `healthy` hat, das Schema einmalig für eine **neue, leere Datenbank** einrichten. Die Migration wird manuell ausgeführt.

```powershell
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U campus_event -d campus_event -f /migrations/001_init.sql
```

Bei Bedarf anschließend Beispielkategorien, Konten und Events einspielen. Die Eventtermine werden relativ zum Einspieldatum berechnet. Bereits vorhandene Events mit denselben IDs behalten ihre Termine.

```powershell
docker compose cp backend/db/seeds/001_demo.sql postgres:/tmp/campus-event-demo.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U campus_event -d campus_event -f /tmp/campus-event-demo.sql
```

### Backend und Frontend

Aus dem Repository-Stamm das Backend starten. `db:check` prüft die Verbindung und die erwarteten Tabellen.

```powershell
cd backend
deno task db:check
deno task dev
```

In einem zweiten Terminal im Repository-Stamm die Frontend-Abhängigkeiten aus der Lockdatei installieren und den Entwicklungsserver starten.

```powershell
cd frontend
npm ci
npm run dev -- --host localhost --port 5173 --strictPort
```

Die Anwendung läuft unter [http://localhost:5173](http://localhost:5173). Das Backend ist direkt unter `http://localhost:8000` erreichbar.

## REST-API

Die 20 Routen sind in [`backend/src/app.ts`](backend/src/app.ts) und [`backend/src/routes/`](backend/src/routes/) definiert.

### Allgemeiner Vertrag

- Geschützte Routen erwarten ein Session-Cookie. Eine fehlende, ungültige oder abgelaufene Session ergibt `401 UNAUTHORIZED`. Eine unzulässige Rolle ergibt `403 FORBIDDEN`. Benutzer- und Eigentümer-IDs stammen bei geschützten Aktionen aus der Session.
- Schreibzugriffe mit fehlender oder abweichender Origin ergeben `403 FORBIDDEN_ORIGIN`. Bei geschützten Schreibzugriffen werden Session und Rolle zuerst geprüft.
- `UUID` bezeichnet in den Tabellen die mit Zod validierte Event-ID im Pfad. Ein ungültiges Format ergibt `400 VALIDATION_ERROR`. Routen mit JSON-Eingabe verlangen `application/json` und liefern bei falschem oder fehlendem Medientyp `415 UNSUPPORTED_MEDIA_TYPE`. Fehlerhaftes JSON und ungültige Eingabefelder ergeben `400 VALIDATION_ERROR`.
- Fehlerantworten folgen dem Format `{ error: { code, message, details? } }`. Bei entsprechenden Validierungsfehlern enthält `details` Einträge mit `field` und `message`. Unbekannte Routen ergeben `404 ROUTE_NOT_FOUND`, unerwartete Handlerfehler `500 INTERNAL_SERVER_ERROR`.
- `204` enthält keinen Antwort-Body. „Kein Body“ in der Spalte Eingabe bedeutet, dass der Handler keine Felder aus dem Request-Body liest.

### Öffentliche Abfragen

| Methode | Pfad | Eingabe | Erfolg | Weitere typische Fehler |
| --- | --- | --- | --- | --- |
| GET | [`/api/health`](http://localhost:8000/api/health) | Keine | `200 {status, message}` mit `status: "ok"` für die HTTP-Erreichbarkeit | – |
| GET | `/api/categories` | Keine | `200` mit Kategorien-Array | – |
| GET | `/api/events` | Optional `category` als kleingeschriebener Slug und `search` als Suchtext, jeweils 1–100 Zeichen nach Trim. Weitere Query-Parameter sind unzulässig. | `200` mit veröffentlichten Events nach Startzeit aufsteigend. Ohne Treffer ist das Array leer. | `400` bei ungültigen Filtern |
| GET | `/api/events/:id` | UUID | `200` mit veröffentlichtem Event | `404 EVENT_NOT_FOUND` bei fehlendem, abgesagtem oder unveröffentlichtem Event |
| GET | `/api/events/:id/availability` | UUID | `200 {availability}` für ein veröffentlichtes Event | `404 EVENT_NOT_FOUND` |

Die Suche berücksichtigt Titel, Beschreibung und Ort ohne Beachtung der Groß- und Kleinschreibung. Ein gültiger, unbekannter Kategorie-Slug liefert ein leeres Array.

### Konto und Session

| Methode | Pfad | Zweck und Zugriff | Eingabe | Erfolg | Weitere typische Fehler |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | Studierendenkonto anlegen, öffentlich | JSON mit `name`, `email`, `password` | `201 {user}` ohne Anmeldung | `409 EMAIL_ALREADY_EXISTS` |
| POST | `/api/auth/login` | Session anlegen, öffentlich | JSON mit `email` und `password` | `200 {user}` mit `Set-Cookie` | `401 INVALID_CREDENTIALS`, `429 TOO_MANY_ATTEMPTS` mit `Retry-After` |
| GET | `/api/auth/me` | Aktuellen Benutzer abrufen, beide Rollen | Session-Cookie | `200 {user}` | – |
| POST | `/api/auth/logout` | Cookie entfernen und vorhandene Session widerrufen | Origin und gegebenenfalls Cookie, kein Body | `200 {message}` | – |

Die JSON-Objekte erlauben nur die angegebenen Felder. Namen müssen nach Trim 2–80 Zeichen haben. E-Mail-Adressen werden getrimmt, kleingeschrieben und auf gültiges Format und höchstens 254 Zeichen geprüft. Für die Registrierung sind 15–128 Passwortzeichen zulässig, beim Login 1–128. `user` enthält `id`, `name`, `email` und `role`. Der Session-Token wird ausschließlich als Cookie übertragen.

### Eventverwaltung

Diese Routen verlangen die Rolle `organizer`. Bei einzelnen Events prüft der Server zusätzlich den Eigentümer. Fremde und fehlende Events ergeben beide `404 EVENT_NOT_FOUND`.

| Methode | Pfad | Zweck | Eingabe | Erfolg | Weitere typische Fehler |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/organizer/events` | Eigene Events aller Status auflisten | Keine | `200 {events}` | – |
| GET | `/api/organizer/events/:id` | Eigenes Event abrufen | UUID | `200 {event}` | – |
| POST | `/api/events` | Entwurf anlegen | Vollständiges Event-JSON | `201 {event}` mit Status `draft` | `400 CATEGORY_NOT_FOUND`, `409 EVENT_CREATION_FAILED` |
| PATCH | `/api/events/:id` | Entwurf bearbeiten | UUID und partielles Event-JSON mit mindestens einem Feld | `200 {event}` | `400` bei ungültiger Kategorie oder Zeitreihenfolge, `409 EVENT_NOT_EDITABLE` |
| DELETE | `/api/events/:id` | Entwurf löschen | UUID, kein Body | `204` | `409 EVENT_NOT_DELETABLE` |
| POST | `/api/events/:id/publish` | Entwurf veröffentlichen | UUID, kein Body | `200 {event}` mit Status `published` | `409 INVALID_EVENT_STATUS`, `EVENT_START_PASSED` oder `EVENT_STATUS_CONFLICT` |
| POST | `/api/events/:id/cancel` | Veröffentlichtes Event absagen | UUID, kein Body | `200 {event}` mit Status `cancelled` | `409 INVALID_EVENT_STATUS` oder `EVENT_STATUS_CONFLICT` |

Das [Event-Schema](backend/src/schemas/eventManagementSchema.ts) definiert `title` (3–120 Zeichen), `description` (10–5000), `location` (3–200), `startsAt`, `endsAt`, `capacity` (Ganzzahl von 1 bis 10.000) und `categoryId` (UUID). Zeiten sind ISO-Datumszeiten mit Offset oder UTC. Beim PATCH prüft der Service die zusammengeführten Zeitwerte. Beim Veröffentlichen muss der Start in der Zukunft liegen.

### Teilnahme

Diese Routen verlangen die Rolle `student`.

| Methode | Pfad | Zweck | Eingabe | Erfolg | Weitere typische Fehler |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/me/registrations` | Eigene Anmeldungen auflisten | Keine | `200 {registrations}` | – |
| GET | `/api/events/:id/registration-status` | Persönlichen Status für ein veröffentlichtes Event abrufen | UUID | `200 {registrationStatus}` | `404 EVENT_NOT_FOUND` |
| POST | `/api/events/:id/registrations` | Platz buchen | UUID, kein Body | `201 {registration}` | `404 EVENT_NOT_FOUND`, `409 EVENT_NOT_OPEN`, `EVENT_ALREADY_STARTED`, `ALREADY_REGISTERED` oder `EVENT_FULL` |
| DELETE | `/api/events/:id/registrations/me` | Eigene Anmeldung zurückziehen | UUID, kein Body | `204` | `404 EVENT_NOT_FOUND` oder `REGISTRATION_NOT_FOUND`, `409 EVENT_ALREADY_STARTED` |

### Antwortobjekte

| Objekt | Felder |
| --- | --- |
| Kategorie | `id`, `name`, `slug` |
| Event | `id`, `title`, `description`, `location`, `startsAt`, `endsAt`, `capacity`, `status`, `organizer: {id, name}`, `category: {id, name, slug}` |
| `availability` | `eventId`, `capacity`, `registeredCount`, `availableSeats`, `isRegistrationOpen` |
| `registrationStatus` | Felder aus `availability` plus `isRegistered`, `canRegister`, `canUnregister` |
| `registration` | `id`, `eventId`, `userId`, `createdAt` |
| Eintrag in `registrations` | `id`, `registeredAt`, `event` |

## Tests und Build

| Ordner | Befehle |
| --- | --- |
| `frontend/` | `npm run test`, `npm run test:watch`, `npm run build`, `npm run preview` für die statische Build-Vorschau |
| `backend/` | `deno task check` für die Typprüfung und `deno task db:repositories` für einen lesenden Repository-Check mit Demodaten |

Backend-Integrationstests mit `deno task <Name>` im Ordner `backend/` ausführen. Verfügbare Tasks sind `test:api`, `test:auth`, `test:auth:routes`, `test:authorization`, `test:events:write`, `test:events:status`, `test:organizer`, `test:events:detail`, `test:registrations` und `test:registrations:read`. Dafür eine separate Testdatenbank mit Schema und benötigten Testdaten verwenden. Mehrere Tests legen eigene Datensätze an und räumen sie anschließend wieder auf.

## Projektstruktur

| Pfad | Inhalt |
| --- | --- |
| `frontend/src/` | Views, Komponenten, Router, Auth-Composable, API-Services und Typen |
| `frontend/tests/` | Vitest und Vue Test Utils mit simulierten API-Aufrufen |
| `backend/main.ts`, `backend/src/` | HTTP-Start, Routen, Middleware, Schemas, Services, Repositories und DB-Client |
| `backend/db/` | Datenbankmigration und Demodaten |
| `backend/tests/` | Deno-Tests mit Hono und PostgreSQL |


## KI-Nutzung
Künstliche Intelligenz (KI) wurde unterstützend bei der Arbeitsplanung, der Überarbeitung des CSS-Designs sowie bei der Optimierung, Verbesserung und Bereinigung des bestehenden Codes eingesetzt.