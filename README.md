# CampusEvent

CampusEvent ist eine webbasierte Veranstaltungsplattform für Studierende und Hochschulen.

Die Anwendung ermöglicht es Studierenden, Campus-Veranstaltungen zu entdecken und sich dafür anzumelden. Veranstalter können eigene Veranstaltungen erstellen, bearbeiten und verwalten.

Das Projekt entsteht im Rahmen eines Studienprojekts und wird als entkoppelte Webanwendung entwickelt.

## 1. Technologien

### Frontend
- Vue 3 mit Composition API und Single File Components (SFC)
- TypeScript
- Vite
- Fetch API für die REST-Kommunikation

### Backend
- Deno
- Hono
- TypeScript
- REST-API mit JSON
- Validierung und Geschäftslogik

### Datenhaltung
- Persistente relationale Datenbank (Umsetzung in Phase 1)

### Versionsverwaltung
- Git und GitHub

## 2. Architektur

Die Anwendung besteht aus drei logisch getrennten Bereichen:

```text
Vue-Frontend
     |
     | HTTP / REST / JSON
     v
Deno + Hono Backend
     |
     | Datenbankzugriff
     v
Persistente Datenbank
```

Das Frontend ist für die Darstellung und Benutzerinteraktion verantwortlich.

Das Backend verarbeitet Anfragen, validiert Eingaben und führt die Geschäftslogik aus.

Die Datenbank speichert Benutzer, Veranstaltungen und Anmeldungen dauerhaft.

## 3. Projektstruktur

```text
campus-event/
├── frontend/       # Vue-Anwendung
├── backend/        # Deno/Hono REST-API
├── .vscode/        # Entwicklungsumgebung
├── .gitignore
└── README.md
```

## 4. Voraussetzungen

Für die lokale Entwicklung werden benötigt:

- Node.js und npm
- Deno
- Git
- Eine Entwicklungsumgebung, z. B. Visual Studio Code

## 5. Anwendung lokal starten

### Backend

Im Projektverzeichnis:

```bash
cd backend
deno task dev
```

Das Backend ist erreichbar unter:

`http://localhost:8000`

API-Test:

`GET http://localhost:8000/api/health`

Erwartete Antwort:

```json
{
  "status": "ok",
  "message": "CampusEvent API läuft"
}
```

### Frontend

Ein zweites Terminal öffnen:

```bash
cd frontend
npm install
npm run dev
```

Das Frontend ist standardmäßig erreichbar unter:

`http://localhost:5173`

Der Vite-Proxy leitet API-Anfragen mit dem Pfad `/api` an das lokale Backend weiter.

## 6. Entwicklungsprüfungen

Frontend:

```bash
cd frontend
npm run build
```

Backend:

```bash
cd backend
deno task check
```

## 7. Geplante Kernfunktionen

- Veranstaltungsübersicht mit Suche und Filtern
- Detailseiten für Veranstaltungen
- Benutzerregistrierung und Anmeldung
- Erstellung und Verwaltung von Veranstaltungen
- Anmeldung zu Veranstaltungen
- Begrenzung der Teilnehmerzahl
- Verwaltung eigener Event-Anmeldungen
- Rollen für Studierende und Veranstalter

## 8. Projektstatus

**Phase 0 – Technisches Setup**

- Git-Repository erstellt
- Vue 3 mit Vite und TypeScript eingerichtet
- Deno/Hono-Backend eingerichtet
- REST-Kommunikation über die Fetch API implementiert
- Projektstruktur und Dokumentation vorbereitet

**Nächster Schritt:** Phase 1 – Datenbankmodell und erste Veranstaltungs-API.

## 9. Deployment

Das Projekt soll später über GitHub-basierte Deployments öffentlich erreichbar sein.

Das Frontend und Backend werden dafür unabhängig voneinander bereitgestellt. Die passende Cloud-Datenbank wird im Zuge der Persistenzimplementierung eingerichtet.