# Company Rules MCP

Fuente de verdad centralizada para las reglas de ingeniería de la compañía (seguridad, buenas prácticas, arquitectura y trazabilidad).

El servidor expone dos superficies distintas:

| Superficie | Quién la usa | Autenticación | Permisos |
| --- | --- | --- | --- |
| UI web + REST (`/`, `/api/*`) | Personas | Cookie de sesión | Lectura y escritura |
| MCP (`/mcp`) | Agentes / MCP clients | `Authorization: Bearer <token>` | **Solo lectura** |

La idea central: las personas mantienen las reglas desde el panel, y los agentes las consultan bajo demanda desde cualquier proyecto. Un agente **nunca** puede crear, modificar ni borrar reglas, usuarios o tokens.

---

## Índice

1. [Cómo funciona](#cómo-funciona)
2. [Requisitos](#requisitos)
3. [Puesta en marcha](#puesta-en-marcha)
4. [Uso humano (UI y API REST)](#uso-humano-ui-y-api-rest)
5. [Uso desde agentes (MCP)](#uso-desde-agentes-mcp)
6. [Configurar un MCP client](#configurar-un-mcp-client)
7. [Cómo debería razonar un agente](#cómo-debería-razonar-un-agente)
8. [Datos y persistencia](#datos-y-persistencia)
9. [Scripts](#scripts)
10. [Solución de problemas](#solución-de-problemas)
11. [Seguridad](#seguridad)

---

## Cómo funciona

```text
                       ┌──────────────────────────────┐
   Personas            │  Fastify (Node.js + TS)      │        Agentes
┌──────────────┐       │                              │      ┌──────────────┐
│ UI web (/)   │──────▶│  /api/auth    sesión cookie  │      │ MCP client   │
│ REST /api/*  │       │  /api/rules   CRUD reglas    │◀─────│ /mcp         │
└──────────────┘       │  /api/users   CRUD usuarios  │Bearer│ (solo read)  │
                       │  /api/tokens  API keys       │      └──────────────┘
                       │                              │
                       │  /mcp  tools + resources     │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │  data/ (filesystem local)    │
                       │  users.json                  │
                       │  mcp-tokens.json             │
                       │  rules/<ID>/meta.json        │
                       │  rules/<ID>/content.md       │
                       └──────────────────────────────┘
```

- **Persistencia:** archivos JSON y Markdown en `data/`. No hay base de datos externa.
- **Escrituras atómicas:** se escribe a `.tmp` y luego `rename()`, para no dejar archivos corruptos.
- **Sesiones humanas:** cookie firmada `session`, `HttpOnly`, `SameSite=Strict`, 8 horas de duración.
- **Tokens MCP:** se guardan solo como hash SHA-256. El token en claro se muestra **una única vez** al crearlo.
- **Aislamiento:** una cookie de sesión no sirve para `/mcp`, y un token MCP no sirve para `/api/*`.

### Roles

| Rol | Reglas | Usuarios | Tokens MCP | Borrado físico |
| --- | --- | --- | --- | --- |
| `admin` | Crear, editar, desactivar | Sí | Sí | Sí |
| `editor` | Crear, editar, desactivar | No | No | No |

El borrado por defecto es lógico (`active: false`). El borrado físico (`DELETE /api/rules/:id?hard=true`) es solo para `admin`.

---

## Requisitos

- **Node.js >= 22.12**
- npm
- No hace falta base de datos, Docker ni servicios externos.

---

## Puesta en marcha

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear el archivo de entorno

```bash
cp .env.example .env
```

Editá `.env`:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3000

DATA_DIR=./data

INITIAL_ADMIN_EMAIL=admin@company.com
INITIAL_ADMIN_PASSWORD=change-me-please
INITIAL_ADMIN_GITHUB_USERNAME=admin

SESSION_SECRET=replace-with-a-long-random-string-of-at-least-32-chars
```

Notas:

- `SESSION_SECRET` debe tener **al menos 32 caracteres**. Podés generarlo con:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
- `INITIAL_ADMIN_PASSWORD` debe tener **al menos 8 caracteres**.
- `DATA_DIR` se resuelve relativo al directorio desde donde ejecutás el proceso.

### 3. Arrancar en desarrollo

```bash
npm run dev
```

Al iniciar:

1. Carga `.env` (si existe).
2. Valida toda la configuración con Zod; si algo falta, el proceso no arranca y muestra qué variable está mal.
3. Crea `data/` si no existe.
4. Si `data/users.json` **no existe**, crea el primer usuario `admin` con las credenciales `INITIAL_ADMIN_*`.
5. Levanta el servidor en `http://127.0.0.1:3000`.

Abrí `http://127.0.0.1:3000` e iniciá sesión con el admin inicial.

> El seed es una sola vez: si `data/users.json` ya existe, cambiar `INITIAL_ADMIN_*` no hace nada. Para reiniciar desde cero, borrá `data/` (perdés reglas, usuarios y tokens).

### 4. Compilar y ejecutar en producción

```bash
npm run build
npm start
```

Para producción:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
```

Con `NODE_ENV=production` la cookie de sesión se marca `Secure`, por lo que **el sitio debe servirse por HTTPS**. Si lo probás por HTTP en producción, el login va a responder 200 pero el navegador no guardará la cookie y vas a quedar en un loop de login.

---

## Uso humano (UI y API REST)

### UI

En `http://127.0.0.1:3000`:

- **Login** con email y contraseña.
- **Pestaña Reglas:** listar, filtrar, crear y editar reglas con editor Markdown y vista previa.
- **Pestaña Usuarios y Tokens** (solo `admin`): alta/desactivación de usuarios y generación/revocación de tokens MCP.

### API REST

Todas las respuestas de error tienen esta forma:

```json
{ "error": { "code": "NOT_FOUND", "message": "Rule SEC-404 not found" } }
```

Códigos posibles: `VALIDATION`, `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_CREDENTIALS`, `NOT_FOUND`, `CONFLICT`, `INTERNAL`.

#### Auth

| Método | Ruta | Body | Respuesta |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | `{ email, password }` | `200 { id, email, githubUsername, role }` + cookie |
| `POST` | `/api/auth/logout` | — | `204` |
| `GET` | `/api/auth/me` | — | `200 { id, email, githubUsername, role }` |

#### Reglas (requiere sesión; `admin` y `editor`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/rules` | Lista metadatos. Filtros: `?category=...&tag=...&active=true\|false` |
| `GET` | `/api/rules/:id` | Devuelve `{ meta, content }` |
| `POST` | `/api/rules` | Crea una regla. `409` si el `id` ya existe |
| `PUT` | `/api/rules/:id` | Actualiza campos y/o `content`; incrementa `version` |
| `DELETE` | `/api/rules/:id` | Borrado lógico (`active: false`) |
| `DELETE` | `/api/rules/:id?hard=true` | Borrado físico (solo `admin`) |

Crear una regla:

```bash
curl -s -b cookies.txt http://127.0.0.1:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "id": "SEC-001",
    "title": "Validación de entrada y sanitización",
    "category": "security",
    "tags": ["api", "validation", "zod"],
    "severity": "mandatory",
    "content": "# Validación\n\nValidá toda entrada con Zod y rechazá campos desconocidos."
  }'
```

Reglas de formato:

- `id`: nombre seguro de directorio, hasta 64 caracteres, regex `^[A-Za-z0-9][A-Za-z0-9._-]*$`. **No se puede cambiar después de crear la regla.**
- `severity`: `mandatory` | `recommended` | `optional` (default `mandatory`).
- `tags`: array de strings (default `[]`).
- `version` arranca en `1` y se incrementa en cada `PUT`.

#### Usuarios (solo `admin`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/users` | Lista usuarios (sin `passwordHash`) |
| `POST` | `/api/users` | Crea `{ email, githubUsername?, role, password }` |
| `PATCH` | `/api/users/:id` | Actualiza `role`, `githubUsername`, `active` y/o `password` |

#### Tokens MCP (solo `admin`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/tokens` | Lista tokens (sin hash ni secreto) |
| `POST` | `/api/tokens` | Crea `{ name }` y devuelve `{ token, id, name, active, createdAt, lastUsedAt }` |
| `DELETE` | `/api/tokens/:id` | Revoca el token (`active: false`) |

El campo `token` de la respuesta de creación es el **único momento** en que se ve el secreto. Guardalo en el gestor de secretos del proyecto/agente.

Crear un token por REST (útil para CI o provisión automatizada):

```bash
# 1. Login y guardar cookie
curl -s -c cookies.txt http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"change-me-please"}'

# 2. Crear token
curl -s -b cookies.txt http://127.0.0.1:3000/api/tokens \
  -H "Content-Type: application/json" \
  -d '{"name":"proyecto-pagos-agent"}'
```

---

## Uso desde agentes (MCP)

### Endpoint

```text
http://<host>:<port>/mcp
```

- Protocolo: **MCP sobre HTTP (Streamable HTTP)**, mensajes JSON-RPC 2.0.
- Métodos HTTP: `GET`, `POST`, `DELETE`.
- Requiere siempre `Authorization: Bearer <token>`.
- Acepta `Content-Type: application/json` y `Accept: application/json, text/event-stream` (el SDK puede responder JSON o SSE).

Sin token válido:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="company-rules"

{ "error": { "code": "UNAUTHORIZED", "message": "Missing or invalid MCP bearer token" } }
```

### Tools disponibles

Solo hay tres tools, todas de lectura y todas operan únicamente sobre reglas con `active: true`.

#### `list_rules`

Lista compacta de reglas, **sin** el Markdown (para ahorrar contexto).

```json
{ "category": "security", "tag": "api" }
```

Ambos filtros son opcionales y se combinan con AND. La comparación de `category`/`tag` es exacta.

Respuesta:

```json
{
  "rules": [
    {
      "id": "SEC-001",
      "title": "Validación de entrada y sanitización",
      "category": "security",
      "tags": ["api", "validation", "zod"],
      "severity": "mandatory",
      "version": 3
    }
  ]
}
```

#### `get_rule`

Devuelve metadatos completos + Markdown completo de una regla activa.

```json
{ "id": "SEC-001" }
```

Respuesta:

```json
{
  "meta": {
    "id": "SEC-001",
    "title": "Validación de entrada y sanitización",
    "category": "security",
    "tags": ["api", "validation", "zod"],
    "severity": "mandatory",
    "version": 3,
    "active": true,
    "createdAt": "2026-11-25T15:00:00.000Z",
    "updatedAt": "2026-11-25T18:00:00.000Z",
    "updatedBy": "admin@company.com"
  },
  "content": "# Validación\n\n..."
}
```

Si la regla no existe o está desactivada, devuelve un **tool error** (`isError: true`) con un mensaje, no un error de protocolo.

#### `search_rules`

Búsqueda case-insensitive por substring en `id`, `title`, `tags` y `content`.

```json
{ "query": "secretos" }
```

Respuesta:

```json
{
  "query": "secretos",
  "matches": [
    {
      "id": "SEC-002",
      "title": "Gestión de secretos",
      "category": "security",
      "tags": ["secrets"],
      "severity": "recommended",
      "version": 1,
      "snippet": "…Nunca commitees secretos…"
    }
  ]
}
```

Regla de tamaño:

- Si el contenido tiene **≤ 1200 caracteres**, se devuelve completo en `content`.
- Si es más largo, se devuelve un `snippet` con ~120 caracteres de contexto alrededor de la primera coincidencia.

### Resources disponibles

Para clients que soportan resources:

| URI | Contenido |
| --- | --- |
| `rule://<ID>` | Markdown de la regla activa |

- `resources/list` lista solo reglas activas.
- `resources/read` con `rule://SEC-001` devuelve `text/markdown`.
- Una regla inexistente o inactiva devuelve un error JSON-RPC de resource no encontrado.

### Ejemplo con curl

```bash
export MCP_TOKEN="mcp_..."

# Listar tools
curl -s http://127.0.0.1:3000/mcp \
  -H "Authorization: Bearer $MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Buscar reglas sobre secretos
curl -s http://127.0.0.1:3000/mcp \
  -H "Authorization: Bearer $MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_rules","arguments":{"query":"secretos"}}}'
```

> Si la respuesta llega como `text/event-stream`, el payload JSON-RPC está en las líneas que empiezan con `data:`. Un MCP client lo maneja solo; con curl tenés que mirar esas líneas.

---

## Configurar un MCP client

Todos los clients necesitan lo mismo: la URL del endpoint y el header `Authorization: Bearer <token>`.

### Claude Code

```bash
claude mcp add --transport http company-rules http://localhost:3000/mcp \
  --header "Authorization: Bearer mcp_..."
```

### Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "company-rules": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer mcp_..."
      }
    }
  }
}
```

### VS Code (MCP)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "company-rules": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer ${input:company-rules-token}"
      }
    }
  },
  "inputs": [
    {
      "id": "company-rules-token",
      "type": "promptString",
      "description": "Token MCP de company-rules",
      "password": true
    }
  ]
}
```

### Cualquier otro client

- Transporte: HTTP / Streamable HTTP.
- URL: `http://<host>:<port>/mcp`.
- Header obligatorio: `Authorization: Bearer mcp_...`.
- No uses cookies: el endpoint MCP las ignora a propósito.

---

## Cómo debería razonar un agente

Flujo recomendado para mantener el contexto chico y las respuestas precisas:

1. **Descubrir el catálogo** con `list_rules` (opcionalmente filtrando por `category` o `tag`).
2. **Buscar el tema puntual** con `search_rules` antes de pedir contenido completo.
3. **Traer el texto completo** con `get_rule` solo para las reglas que realmente va a aplicar.
4. **Citar el `id`** de la regla en la explicación o en el PR (ej. "según `SEC-001`").
5. **No intentar escribir.** No hay tools de escritura; si falta una regla, el agente debe pedirle a una persona que la cree.
6. **Ante `isError: true`**, leer el mensaje y seguir. Un `get_rule` fallido por ID inexistente no debe romper la tarea.
7. **Ante `401`**, no reintentar en loop: el token falta, es inválido o fue revocado. Hay que generar uno nuevo desde el panel.

Ejemplo de instrucciones para el `AGENTS.md` del proyecto que consume el MCP:

```markdown
## Reglas de la compañía

Antes de implementar cambios de arquitectura, seguridad o manejo de datos:

1. Consultá el MCP `company-rules`.
2. Usá `search_rules` para encontrar reglas relevantes y `get_rule` solo para las que vas a aplicar.
3. Aplicá las reglas y citá sus IDs en la respuesta o en el PR.
4. Las reglas son de solo lectura: si falta una regla, no la inventes; pedí que la agreguen.
```

### Cuándo usar cada tool

| Necesidad | Tool |
| --- | --- |
| Ver qué reglas existen | `list_rules` |
| Filtrar por área o etiqueta | `list_rules` con `category` / `tag` |
| Encontrar algo por texto | `search_rules` |
| Leer una regla completa | `get_rule` |
| Client con soporte de resources | `rule://<ID>` |

---

## Datos y persistencia

```text
data/
├── users.json                 # usuarios internos
├── mcp-tokens.json            # tokens MCP (solo hashes)
└── rules/
    └── SEC-001/
        ├── meta.json          # metadatos
        └── content.md         # Markdown de la regla
```

- `data/` está en `.gitignore`. **No se versiona.**
- El contenido de una regla vive en `content.md`; el resto en `meta.json`.
- Los tokens se guardan como SHA-256, nunca en claro.
- Las contraseñas se guardan con `scrypt` en formato `salt:derivedKey`.
- `lastUsedAt` de un token se actualiza en cada request MCP autenticado.

### Estructura del proyecto

```text
src/
├── index.ts                  # bootstrap: env, seed, listen
├── app.ts                    # composición de Fastify, rutas, MCP y estáticos
├── config.ts                 # validación de variables de entorno (Zod)
├── auth/
│   ├── crypto.ts             # scrypt, SHA-256, generación de tokens
│   ├── session.guard.ts      # cookie de sesión + roles
│   └── mcp-auth.guard.ts     # Bearer token para /mcp
├── routes/
│   ├── auth.routes.ts
│   ├── rules.routes.ts
│   ├── users.routes.ts
│   └── tokens.routes.ts
├── storage/
│   ├── fs-utils.ts           # escrituras atómicas
│   ├── rules.repo.ts
│   ├── users.repo.ts
│   ├── tokens.repo.ts
│   └── seed.ts
└── mcp/
    └── mcp.server.ts         # tools y resources de solo lectura
public/                       # UI estática (HTML + CSS + Vanilla JS)
test/                         # tests con node:test
```

Documentación de diseño: [`SPEC.md`](./SPEC.md) y [`AGENT.md`](./AGENT.md).

---

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Desarrollo con recarga (`tsx watch`) |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Ejecuta `dist/index.js` |
| `npm run typecheck` | Chequeo de tipos sin emitir |
| `npm test` | Tests con `node:test` |

Antes de abrir un PR:

```bash
npm run typecheck
npm test
```

---

## Solución de problemas

**El servidor no arranca y muestra `Invalid environment configuration`**
Falta alguna variable o tiene formato inválido. Revisá `.env` contra `.env.example`. `SESSION_SECRET` necesita 32+ caracteres y `INITIAL_ADMIN_PASSWORD` 8+.

**No se creó el admin inicial**
Solo se crea si `data/users.json` no existe. Si ya existe (aunque tenga otros usuarios), el seed no corre. Borrá `data/users.json` o creá el usuario desde otro admin.

**Login responde 200 pero vuelvo al login**
En `NODE_ENV=production` la cookie es `Secure` y requiere HTTPS. Para desarrollo usá `NODE_ENV=development`.

**`/api/*` devuelve 401**
La sesión dura 8 horas, el usuario puede estar desactivado o la cookie fue borrada. Volvé a loguearte.

**`/mcp` devuelve 401**
Verificá que estés mandando `Authorization: Bearer <token>` con un token **MCP** (empieza con `mcp_`), no una cookie de sesión. Si fue revocado, generá uno nuevo.

**`/mcp` devuelve 406 o el client no conecta**
El client debe aceptar `application/json` y `text/event-stream`. Actualizá el client o configurá el transporte HTTP correctamente.

**`POST /api/rules` devuelve 409**
Ya existe una regla con ese `id`. Los IDs son inmutables: usá `PUT /api/rules/:id` o elegí otro ID.

**`400 VALIDATION`**
El mensaje indica el campo inválido, por ejemplo `severity: Invalid option`. Revisá los valores permitidos.

**Quiero empezar de cero**
Detené el servidor y borrá `data/`. En el próximo arranque se vuelve a crear el admin inicial. Esto elimina reglas, usuarios y tokens.

---

## Seguridad

- **Nunca** commitees `.env`, `data/` ni tokens. Ya están en `.gitignore`.
- Usá HTTPS en producción. Las cookies `Secure` y los bearer tokens viajan en cada request.
- El token MCP se muestra una sola vez. Guardalo en un secret manager, no en el repo.
- Revocá tokens que ya no se usen (`DELETE /api/tokens/:id`); el cambio es inmediato.
- Rotar `SESSION_SECRET` invalida todas las sesiones humanas activas.
- El MCP es de solo lectura **por diseño**: no existen tools, resources ni prompts de escritura.
- El servidor no implementa CORS. La UI es same-origin; si necesitás consumir la API desde otro dominio, agregá CORS explícito y restringido.
- Los usuarios desactivados pierden acceso de inmediato, incluso con una cookie vigente.
