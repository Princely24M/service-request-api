# SkillBridge Service Request API (Week 5)

A small Express.js REST API for submitting and managing service requests, plus a frontend that uses it.
Data is stored in memory, so it resets when the server restarts. Persistent storage comes in a later week.

## Run it

```bash
npm install
cp .env.example .env     # optional, defaults work
npm start                # or: npm run dev  (restarts on file changes)
```

Open http://localhost:3000. The same server hosts the frontend (`/public`) and the API (`/api`).
Run the automated tests with `npm test`.

If you open `public/index.html` from a local development server (for example VS Code Live Server on port 5500), the frontend automatically uses the API at `http://localhost:3000/api`. Localhost origins are allowed in development when `CORS_ORIGIN` is unset. For other origins or production, set `CORS_ORIGIN` and configure `<meta name="api-base">` in `index.html` with the API URL.

## Project structure

```
server.js                    starts the server and seeds sample data
src/app.js                   builds the Express app and wires middleware
src/config.js                reads environment variables (.env)
src/routes/requests.js       maps URLs and HTTP methods to controller functions
src/controllers/             request handling logic
src/middleware/              logger, JSON check, 404 and error handlers
src/utils/validate.js        field rules shared by POST, PUT and PATCH
src/data/store.js            in-memory data (swap for a database later)
public/                      frontend (HTML, CSS, vanilla JS)
test/api.test.js             automated endpoint tests
docs/                        Postman collection
```

## Endpoints

| Method | URL | Purpose | Success |
| --- | --- | --- | --- |
| GET | `/api/health` | Check the server is up | 200 |
| GET | `/api/requests` | List requests. Optional `?status=`, `?category=`, `?q=` | 200 |
| GET | `/api/requests/:id` | One request | 200 |
| POST | `/api/requests` | Create a request | 201 + `Location` header |
| PUT | `/api/requests/:id` | Replace all editable fields | 200 |
| PATCH | `/api/requests/:id` | Change only the fields you send | 200 |
| DELETE | `/api/requests/:id` | Delete a request | 204 (no body) |

### Request fields

| Field | Rules |
| --- | --- |
| `name` | required, 2–80 characters |
| `email` | required, valid email |
| `category` | required: `opportunity`, `application`, `portal`, `other` |
| `subject` | required, 3–120 characters |
| `description` | required, 10–2000 characters |
| `status` | `open` (default), `in_progress`, `resolved`, `closed` |

`id`, `createdAt` and `updatedAt` are set by the server. Any value a client sends for them is ignored.
PUT and POST need every required field. PATCH accepts any subset, but at least one field.

### Example

```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{"name":"Zinhle Dlamini","email":"zinhle@example.com","category":"opportunity","subject":"Bursary question","description":"Is the closing date still correct?"}'
```

### Status codes used

| Code | When |
| --- | --- |
| 200 | Read or update succeeded |
| 201 | Request created |
| 204 | Deleted, nothing to return |
| 400 | Validation failed, malformed id, invalid JSON, bad filter value |
| 404 | Request id or route does not exist |
| 413 | Body larger than 10 KB |
| 415 | Body is not sent as `application/json` |
| 500 | Unexpected server error (details are hidden in production) |

### Error shape

Every error uses the same JSON structure, so the frontend only needs one error handler:

```json
{
  "error": {
    "status": 400,
    "message": "Some fields need attention.",
    "details": [{ "field": "email", "message": "Enter a valid email address, like name@example.com." }]
  }
}
```

## Testing with Postman

1. Import `docs/skillbridge.postman_collection.json`.
2. Start the server, then run the collection (Runner → Run). The first POST saves the new id in the `requestId` variable, and the rest of the requests use it.
3. Each request has a test that checks the expected status code, including the error cases (400, 404).

## Environment variables

| Name | Default | Purpose |
| --- | --- | --- |
| `PORT` | 3000 | Port to listen on |
| `NODE_ENV` | development | Set to `production` to hide error debug info |
| `CORS_ORIGIN` | empty | Comma-separated origins allowed to call the API from another address |

## Frontend notes

- Form validation runs in the browser first, then the server validates again. Server errors are mapped back to the matching field.
- Status dropdown uses PATCH, the Edit dialog uses PUT, Delete asks for a second click, new requests use POST.
- Two panels share the screen: New request (yellow) and View requests (blue). Choosing one widens it and folds the other into a tab. On phones they stack. Motion is CSS only and is turned off under `prefers-reduced-motion`.
- There is no login yet, so every visitor sees every request. Authentication is planned for a later week.
