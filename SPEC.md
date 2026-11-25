# SPEC.md — Company Rules MCP Server

## 1. Objetivo

Proveer una fuente de verdad centralizada para estándares internos de ingeniería (seguridad, buenas prácticas, trazabilidad y arquitectura) con:

1. Un panel web estático en HTML/JS/CSS para que personas autorizadas creen y actualicen reglas y gestionen usuarios internos.
2. Un servidor MCP HTTP de **solo lectura** para que los agentes de desarrollo en distintos proyectos consulten reglas bajo demanda.

---

## 2. Arquitectura y estructura de carpetas

```text
company-rules-mcp/
├── AGENTS.md
├── SPEC.md
├── package.json
├── tsconfig.json
├── .env.example
├── public/                     # UI HTML estática (sin build step complejo)
│   ├── index.html              # Login + gestión de reglas + gestión de usuarios (admin)
│   ├── app.js                  # Lógica cliente Vanilla JS (fetch contra /api/*)
│   └── styles.css
├── data/                       # Ignorado en Git (creado automáticamente al iniciar)
│   ├── users.json              # Usuarios internos
│   ├── mcp-tokens.json         # API Keys de solo lectura para agentes/proyectos
│   └── rules/
│       └── <RULE-ID>/
│           ├── meta.json       # Metadatos de la regla
│           └── content.md      # Contenido en Markdown puro
└── src/
    ├── index.ts                # Bootstrap de Fastify, plugins, rutas y MCP
    ├── config.ts               # Carga y validación de variables de entorno con Zod
    ├── storage/
    │   ├── fs-utils.ts         # Escritura atómica (.tmp -> rename) y aseguramiento de directorios
    │   ├── rules.repo.ts       # CRUD en disco de reglas (meta.json + content.md)
    │   ├── users.repo.ts       # CRUD en disco de usuarios + seed de admin inicial
    │   └── tokens.repo.ts      # Gestión de tokens MCP de solo lectura
    ├── auth/
    │   ├── crypto.ts           # Hash de contraseñas (scrypt) y hashing de tokens
    │   ├── session.guard.ts    # Middleware Fastify para cookie de sesión humana + roles
    │   └── mcp-auth.guard.ts   # Middleware Fastify para Bearer token de solo lectura en /mcp
    ├── routes/
    │   ├── auth.routes.ts      # Login, logout, /api/me
    │   ├── rules.routes.ts     # REST CRUD de reglas (humanos)
    │   ├── users.routes.ts     # REST CRUD de usuarios (solo admin)
    │   └── tokens.routes.ts    # REST creación/revocación de tokens MCP (solo admin)
    └── mcp/
        └── mcp.server.ts       # Definición de servidor MCP (solo tools/resources de lectura)
```

## 3. MODELO DE DATOS (en `data/`)

### 3.1. Regla (data/rules/<id>/meta.json + content.md)

meta.json:
{
"id": "SEC-001",
"title": "Validación de entrada y sanitización",
"category": "security",
"tags": ["api", "validation", "zod"],
"severity": "mandatory",
"version": 1,
"active": true,
"createdAt": "2026-11-25T15:00:00.000Z",
"updatedAt": "2026-11-25T15:00:00.000Z",
"updatedBy": "admin@company.com"
}
content.md: Markdown libre con la explicación, ejemplos correctos/incorrectos y criterios de cumplimiento.

### 3.2. Usuario (data/users.json)

estructura:
[
{
"id": "usr_01",
"email": "admin@company.com",
"githubUsername": "octocat",
"role": "admin",
"passwordHash": "<salt>:<derivedKey>",
"active": true,
"createdAt": "2026-11-25T15:00:00.000Z"
}
]
Roles:

- admin: Gestiona reglas, usuarios internos y tokens MCP.
- editor: Crea y edita reglas. No gestiona usuarios ni tokens.

### 3.3. Tokens MCP (data/mcp-tokens.json)

estructura:
[
{
"id": "tok_01",
"name": "proyecto-pagos-agent",
"tokenHash": "<sha256>",
"active": true,
"createdAt": "2026-11-25T15:00:00.000Z",
"lastUsedAt": null
}
]

## 4. Autenticación y seguridad

Bootstrap inicial: Si data/users.json no existe al arrancar, crear automáticamente el primer usuario admin usando INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD desde .env.

Sesión humana (UI + /api/\*):

POST /api/auth/login valida email + password y establece una cookie firmada HttpOnly; SameSite=Strict; Path=/.

Todos los endpoints bajo /api/rules, /api/users y /api/tokens requieren sesión válida y usuario active: true.

Autenticación MCP (/mcp):

Requiere cabecera Authorization: Bearer <token>.

Valida el hash del token contra data/mcp-tokens.json (active: true).

Aislamiento: Un token MCP no autentica rutas /api/\*, y una cookie de sesión humana no reemplaza el control de solo lectura del protocolo MCP.

## 5. Contratos de API REST (Humanos)

- Auth
  POST /api/auth/login — { email, password } -> establece cookie y devuelve { id, email, githubUsername, role }.

POST /api/auth/logout — limpia cookie de sesión.

GET /api/auth/me — devuelve usuario autenticado actual.

- Reglas (admin y editor)
  GET /api/rules — Lista metadatos de todas las reglas (filtros opcionales: ?category=...&tag=...&active=true).

GET /api/rules/:id — Devuelve { meta, content }.

POST /api/rules — Crea nueva regla { id, title, category, tags, severity, content }. Falla con 409 si id ya existe.

PUT /api/rules/:id — Actualiza metadatos y/o content.md, incrementa version y registra updatedBy y updatedAt.

DELETE /api/rules/:id — Borrado lógico (active: false) o físico (solo admin).

- Usuarios y Tokens (solo admin)
  GET /api/users — Lista usuarios (sin exponer passwordHash).

POST /api/users — Crea usuario { email, githubUsername, role, password }.

PATCH /api/users/:id — Actualiza role, githubUsername, active o resetea password.

GET /api/tokens — Lista tokens MCP (sin el secreto en claro).

POST /api/tokens — Genera token nuevo { name } y devuelve el token en claro una única vez.

DELETE /api/tokens/:id — Revoca token (active: false).

## 6. Interfaz MCP (/mcp — Solo lectura)

El servidor MCP expone únicamente capacidades de lectura sobre reglas con active: true:

Tools:

- list_rules

Input (Zod): { category?: string, tag?: string }

Output: Lista compacta con id, title, category, tags, severity, version (sin enviar todo el Markdown para ahorrar contexto).

- get_rule

Input (Zod): { id: string }

Output: Metadatos completos + contenido completo de content.md.

- search_rules

Input (Zod): { query: string }

Output: Reglas activas cuyo id, title, tags o content.md coincidan con query (devuelve resumen + fragmento o contenido según tamaño).

Resources (opcional / complementario)

- rule://{id} — Expone directamente el Markdown de una regla específica.

## 7. Requisitos de la UI HTML (public/)

Pantalla única ligera en HTML + CSS + Vanilla JS (sin frameworks de frontend).

Vista 1: Formulario de login (email, password).

Vista 2 (autenticada):

Pestaña Reglas: Lista filtrable por categoría/texto, formulario para crear/editar regla con editor <textarea> para Markdown y vista previa básica.

Pestaña Usuarios y Tokens (visible si role === 'admin'): Alta/desactivación de usuarios internos y generación/revocación de API Keys MCP.

## 8. Plan de implementación sugerido (iteraciones)

Fase 1 (Core & Storage): config.ts, fs-utils.ts, repositorios (users, rules, tokens) y seed del admin inicial.

Fase 2 (Auth & REST): crypto.ts, guards de sesión y rutas /api/auth, /api/rules, /api/users, /api/tokens.

Fase 3 (MCP Server): mcp.server.ts montado en /mcp con mcp-auth.guard.ts y las 3 tools de solo lectura.

Fase 4 (UI Estática): public/index.html, app.js y styles.css conectados a la API REST.
