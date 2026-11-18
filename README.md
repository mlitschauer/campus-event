# CampusEvent

CampusEvent ist ein lokales Hochschulprojekt für die DHBW Mosbach. Studierende finden Campusveranstaltungen und verwalten ihre Teilnahmen. Veranstalter pflegen und veröffentlichen ihre eigenen Veranstaltungen.

| Zugriff | Implementierter Umfang |
| --- | --- |
| Öffentlich | Veranstaltungsübersicht mit Textsuche und Kategoriefilter, öffentliche Details und Belegung, Kontoregistrierung als Student, Login |
| Student | Anmeldung zu veröffentlichten, noch nicht begonnenen Events mit freien Plätzen, persönlicher Status, „Meine Anmeldungen“, Rücknahme bis zum Beginn |
| Organizer | Dashboard für eigene Events, Entwurf erstellen, bearbeiten und löschen, veröffentlichen und veröffentlichte Events absagen |
| Beide Rollen | Kontoseite, Session-Wiederherstellung und Logout |

Vue 3 mit Composition API, Vue Router und TypeScript steuert die Oberfläche. Vite liefert das Frontend lokal aus und leitet `/api` an Deno/Hono weiter. Typisierte Frontend-Services verwenden Fetch und JSON. Das Backend prüft Anfragen mit Middleware und Zod und greift über SQL-Repositories auf PostgreSQL 18 zu. Docker Compose betreibt den Datenbankdienst mit einem persistenten Volume.

## Lokaler Start

Voraussetzungen sind Git, Docker mit Compose, Node.js mit npm und Deno mit Argon2id-WebCrypto-Unterstützung. Die lokale Prüfung verwendet Node 24 und Deno 2.9. Für Entwicklung und Tests empfiehlt sich die geprüfte Node-24-Version, da Vite und jsdom eigene Mindestversionen verlangen. Für ein frisches Frontend-Checkout mit vorhandener Lockdatei stellt `npm ci` im Ordner `frontend` die vorgesehenen Abhängigkeiten bereit.

### PostgreSQL

Im Repository-Stamm ausführen:

```powershell
docker compose up -d postgres
docker compose ps
```

Vorher die Stammdatei `.env` anhand von `.env.example` einrichten. Der Dienst bindet ausschließlich an `127.0.0.1:5433`. Compose bindet `/migrations` lesend ein. Die Migration wird dadurch nicht automatisch ausgeführt. Nur für eine **neue, leere lokale Datenbank** einmal das Schema einrichten:

```powershell
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U campus_event -d campus_event -f /migrations/001_init.sql
```

Für eine neue lokale Demo-Datenbank können anschließend Beispielkategorien, Konten und Events geladen werden:

```powershell
docker compose cp backend/db/seeds/001_demo.sql postgres:/tmp/campus-event-demo.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U campus_event -d campus_event -f /tmp/campus-event-demo.sql
```

Bei vorhandener Datenbank den Einrichtungsblock auslassen. Die Seed-Termine entstehen relativ zum Einspieldatum. Konflikte mit bestehenden IDs verschieben die Termine nicht.

### Backend und Frontend

`backend/.env` anhand von `backend/.env.example` anlegen. In einem Terminal aus dem Repository-Stamm:

```powershell
cd backend
deno task db:check
deno task dev
```

Das Backend antwortet auf [GET /api/health](http://localhost:8000/api/health) mit HTTP 200 und JSON mit `status: "ok"`. Dieser Endpunkt prüft die HTTP-Anwendung. `db:check` prüft separat die Verbindung und erwarteten Tabellen.

In einem zweiten Terminal aus dem Repository-Stamm:

```powershell
cd frontend
npm run dev -- --host localhost --port 5173 --strictPort
```

Die Anwendung ist unter [localhost:5173](http://localhost:5173) erreichbar. Für Login und Schreibaktionen dieselbe Host-Schreibweise wie bei der konfigurierten Origin verwenden.

| Variable | Ort und Wirkung |
| --- | --- |
| `POSTGRES_PASSWORD` | Stamm-`.env`. Lokales Passwort für Compose. |
| `DATABASE_URL` | `backend/.env`. PostgreSQL-Verbindungs-URL zur lokalen Datenbank, passend zu Compose. URL-Sonderzeichen in Komponenten kodieren. |
| `APP_ENV` | Backend, optional. Der Wert `production` aktiviert Secure-Cookies und verlangt eine konfigurierte HTTPS-Frontend-Origin. |
| `FRONTEND_ORIGIN` | Backend, optional im lokalen Betrieb. Standard `http://localhost:5173`, einzelne erlaubte Origin für Schreibzugriffe. |
| `VITE_API_URL` | Frontend, optional. Leer für relative `/api`-URLs und den lokalen Proxy. Der Fetch-Client verwendet Cookies nur bei gleicher Origin. |

## API und Prüfungen

Die 20 expliziten HTTP-Routen sind in der [REST-Referenz](docs/CE-38-rest-api.md) einzeln mit Rollen, Eingaben und Statuscodes dokumentiert.

| Bereich | Endpunkte |
| --- | --- |
| Öffentlich | GET `/api/health`, `/api/categories`, `/api/events`, `/api/events/:id`, `/api/events/:id/availability` |
| Konto | POST `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`. GET `/api/auth/me`. |
| Organizer | GET `/api/organizer/events` und `/api/organizer/events/:id`. POST `/api/events`, `/api/events/:id/publish` und `/api/events/:id/cancel`. PATCH und DELETE `/api/events/:id`. |
| Student | GET `/api/me/registrations` und `/api/events/:id/registration-status`. POST `/api/events/:id/registrations`. DELETE `/api/events/:id/registrations/me`. |

| Bereich | Befehle im jeweiligen Ordner |
| --- | --- |
| `frontend` | `npm run test`, `npm run test:watch`, `npm run build`, `npm run preview` zur statischen Build-Vorschau |
| `backend`, ohne DB-Schreibtests | `deno task check`, `deno task db:check`, `deno task db:repositories` für einen lesenden Repository-Check mit Demo-Daten |
| `backend`, Integration | `deno task test:api`, `test:auth`, `test:auth:routes`, `test:authorization`, `test:events:write`, `test:events:status`, `test:organizer`, `test:events:detail`, `test:registrations`, `test:registrations:read`, jeweils mit `deno task <Name>` |

Backend-Integrationstests nur mit separater Testdatenbank samt Schema und benötigten Fixtures ausführen. Mehrere Tests schreiben eigene Datensätze und räumen diese wieder auf. Ein Lint-Skript ist im Frontend nicht konfiguriert.

## Projektstruktur

| Pfad | Inhalt |
| --- | --- |
| `frontend/src/` | Views, Komponenten, Router, Auth-Composable, API-Services und Typen |
| `frontend/tests/` | Vitest, Vue Test Utils und simulierte API-Aufrufe |
| `backend/main.ts`, `backend/src/` | HTTP-Start, Hono-Routen, Middleware, Schemas, Services, Repositories und DB-Client |
| `backend/db/`, `compose.yaml` | Migration, Demo-Daten, PostgreSQL-Dienst und Volume |
| `backend/tests/` | Deno-Tests mit Hono und PostgreSQL |

## Bekannte Grenzen

Der dokumentierte Betrieb ist lokal. Für öffentliche Bereitstellung fehlen ein verifizierter HTTPS-Betrieb und eine separat minimal berechtigte Datenbankrolle. Es gibt keine Warteliste, keine Organizer-Teilnehmerliste und keine Selbstverwaltung der Organizer-Rolle. Öffentliche Listen haben keine Pagination. Bei abgesagten Veranstaltungen bleiben bestehende Anmeldungen in der persönlichen Liste nachvollziehbar.
