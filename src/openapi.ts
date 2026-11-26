import type { OpenAPIV3 } from 'openapi-types'

type Schema = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject

const ref = (name: string): OpenAPIV3.ReferenceObject => ({
  $ref: `#/components/schemas/${name}`,
})

const responseRef = (name: string): OpenAPIV3.ReferenceObject => ({
  $ref: `#/components/responses/${name}`,
})

const jsonContent = (schema: Schema, example?: unknown): OpenAPIV3.MediaTypeObject => ({
  schema,
  ...(example !== undefined ? { example } : {}),
})

function jsonResponse(
  description: string,
  schema: Schema,
  example?: unknown,
): OpenAPIV3.ResponseObject {
  return {
    description,
    content: { 'application/json': jsonContent(schema, example) },
  }
}

function errorResponse(description: string, code: string, message: string): OpenAPIV3.ResponseObject {
  return jsonResponse(description, ref('Error'), { error: { code, message } })
}

const ruleIdPath: OpenAPIV3.ParameterObject = {
  name: 'id',
  in: 'path',
  required: true,
  description:
    'Identificador de la regla. Nombre seguro de directorio: hasta 64 caracteres, ' +
    'empieza con letra o número y solo admite letras, números, puntos, guiones y guiones bajos. ' +
    'Es inmutable una vez creada la regla.',
  schema: {
    type: 'string',
    maxLength: 64,
    pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$',
    example: 'SEC-001',
  },
}

const userIdPath: OpenAPIV3.ParameterObject = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'Identificador interno del usuario (por ejemplo `usr_ab12cd34ef56`).',
  schema: { type: 'string', example: 'usr_ab12cd34ef56' },
}

const tokenIdPath: OpenAPIV3.ParameterObject = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'Identificador interno del token MCP (por ejemplo `tok_ab12cd34ef56`).',
  schema: { type: 'string', example: 'tok_ab12cd34ef56' },
}

const categoryQuery: OpenAPIV3.ParameterObject = {
  name: 'category',
  in: 'query',
  required: false,
  description: 'Filtra por categoría exacta (por ejemplo `security` o `architecture`).',
  schema: { type: 'string', example: 'security' },
}

const tagQuery: OpenAPIV3.ParameterObject = {
  name: 'tag',
  in: 'query',
  required: false,
  description: 'Filtra por tag exacto.',
  schema: { type: 'string', example: 'validation' },
}

const activeQuery: OpenAPIV3.ParameterObject = {
  name: 'active',
  in: 'query',
  required: false,
  description:
    'Filtra por estado. Sin este parámetro se devuelven reglas activas e inactivas. ' +
    'El endpoint MCP solo expone reglas activas.',
  schema: { type: 'string', enum: ['true', 'false'], example: 'true' },
}

const hardDeleteQuery: OpenAPIV3.ParameterObject = {
  name: 'hard',
  in: 'query',
  required: false,
  description:
    'Si es `true`, borra físicamente la regla y su contenido. Solo disponible para `admin`. ' +
    'Por defecto el borrado es lógico (`active: false`).',
  schema: { type: 'string', enum: ['true', 'false'], default: 'false', example: 'false' },
}

const sessionSecurity: OpenAPIV3.SecurityRequirementObject[] = [{ sessionCookie: [] }]
const mcpSecurity: OpenAPIV3.SecurityRequirementObject[] = [{ mcpBearer: [] }]

export const openApiDocument: OpenAPIV3.Document = {
  openapi: '3.0.3',

  info: {
    title: 'Company Rules API',
    version: '1.0.0',
    description: [
      'API del servidor interno de reglas de ingeniería compartidas.',
      '',
      'Tiene dos superficies con autenticación independiente:',
      '',
      '- **API REST** (`/api/*`): para personas. Requiere la cookie de sesión creada por ' +
        '`POST /api/auth/login`. Los roles son `admin` y `editor`.',
      '- **MCP** (`/mcp`): para agentes. Requiere `Authorization: Bearer <token>` y es ' +
        'estrictamente de solo lectura.',
      '',
      'En Swagger UI podés iniciar sesión con `POST /api/auth/login` y el navegador enviará ' +
        'la cookie automáticamente en las siguientes llamadas al estar en la misma origin. ' +
        'Para `/mcp`, usá el botón **Authorize** con el token generado en `POST /api/tokens`.',
    ].join('\n'),
  },

  servers: [
    {
      url: '/',
      description: 'Mismo origen desde el que se sirve esta documentación.',
    },
  ],

  tags: [
    {
      name: 'Auth',
      description: 'Login, logout y usuario autenticado actual.',
    },
    {
      name: 'Rules',
      description: 'CRUD de reglas. Requiere sesión humana (`admin` o `editor`).',
    },
    {
      name: 'Users',
      description: 'Gestión de usuarios internos. Solo `admin`.',
    },
    {
      name: 'Tokens',
      description:
        'Emisión y revocación de tokens MCP. Solo `admin`. El token en claro se devuelve una única vez.',
    },
    {
      name: 'MCP',
      description:
        'Endpoint MCP sobre HTTP (Streamable HTTP). Solo lectura. ' +
        'Tools: `list_rules`, `get_rule`, `search_rules`. Resource: `rule://{id}`.',
    },
  ],

  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'session',
        description:
          'Cookie firmada, HttpOnly y SameSite=Strict emitida por `POST /api/auth/login`. ' +
          'Dura 8 horas. El navegador la envía automáticamente en requests same-origin.',
      },
      mcpBearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'MCP token (mcp_...)',
        description:
          'Token MCP creado por un administrador en `POST /api/tokens`. Se guarda hasheado y ' +
          'puede revocarse en cualquier momento. No confundir con la cookie de sesión: ' +
          '`/mcp` ignora cookies.',
      },
    },

    responses: {
      BadRequest: errorResponse(
        'Payload o parámetros inválidos (validación Zod).',
        'VALIDATION',
        'severity: Invalid option',
      ),
      Unauthorized: errorResponse(
        'Sesión ausente, inválida o vencida.',
        'UNAUTHORIZED',
        'Authentication required',
      ),
      Forbidden: errorResponse(
        'El usuario autenticado no tiene permisos suficientes.',
        'FORBIDDEN',
        'Insufficient permissions',
      ),
      NotFound: errorResponse('El recurso solicitado no existe.', 'NOT_FOUND', 'Rule SEC-404 not found'),
      Conflict: errorResponse('El recurso ya existe.', 'CONFLICT', 'Rule SEC-001 already exists'),
      InvalidCredentials: errorResponse(
        'Email o contraseña incorrectos, o usuario desactivado.',
        'INVALID_CREDENTIALS',
        'Invalid email or password',
      ),
      McpUnauthorized: errorResponse(
        'Token MCP ausente, inválido o revocado.',
        'UNAUTHORIZED',
        'Missing or invalid MCP bearer token',
      ),
    },

    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                enum: [
                  'VALIDATION',
                  'UNAUTHORIZED',
                  'FORBIDDEN',
                  'INVALID_CREDENTIALS',
                  'NOT_FOUND',
                  'CONFLICT',
                  'INTERNAL',
                ],
              },
              message: { type: 'string' },
            },
          },
        },
      },

      SessionUser: {
        type: 'object',
        required: ['id', 'email', 'githubUsername', 'role'],
        properties: {
          id: { type: 'string', example: 'usr_ab12cd34ef56' },
          email: { type: 'string', format: 'email', example: 'admin@company.com' },
          githubUsername: { type: 'string', example: 'octocat' },
          role: { type: 'string', enum: ['admin', 'editor'], example: 'admin' },
        },
      },

      PublicUser: {
        allOf: [
          ref('SessionUser'),
          {
            type: 'object',
            required: ['active', 'createdAt'],
            properties: {
              active: { type: 'boolean', example: true },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },

      RuleMeta: {
        type: 'object',
        required: [
          'id',
          'title',
          'category',
          'tags',
          'severity',
          'version',
          'active',
          'createdAt',
          'updatedAt',
          'updatedBy',
        ],
        properties: {
          id: {
            type: 'string',
            maxLength: 64,
            pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$',
            example: 'SEC-001',
          },
          title: { type: 'string', example: 'Validación de entrada y sanitización' },
          category: { type: 'string', example: 'security' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['api', 'validation', 'zod'],
          },
          severity: {
            type: 'string',
            enum: ['mandatory', 'recommended', 'optional'],
            example: 'mandatory',
          },
          version: { type: 'integer', minimum: 1, example: 3 },
          active: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          updatedBy: { type: 'string', format: 'email', example: 'admin@company.com' },
        },
      },

      Rule: {
        type: 'object',
        required: ['meta', 'content'],
        properties: {
          meta: ref('RuleMeta'),
          content: {
            type: 'string',
            description: 'Contenido Markdown libre de la regla.',
            example: '# Validación\n\nValidá toda entrada con Zod y rechazá campos desconocidos.',
          },
        },
      },

      RuleSummary: {
        type: 'object',
        description:
          'Proyección compacta usada por las tools MCP. Nunca incluye el Markdown de la regla.',
        required: ['id', 'title', 'category', 'tags', 'severity', 'version'],
        properties: {
          id: { type: 'string', example: 'SEC-001' },
          title: { type: 'string', example: 'Validación de entrada y sanitización' },
          category: { type: 'string', example: 'security' },
          tags: { type: 'array', items: { type: 'string' } },
          severity: { type: 'string', enum: ['mandatory', 'recommended', 'optional'] },
          version: { type: 'integer', minimum: 1 },
        },
      },

      SearchMatch: {
        allOf: [
          ref('RuleSummary'),
          {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description:
                  'Markdown completo. Presente solo cuando la regla tiene 1200 caracteres o menos.',
              },
              snippet: {
                type: 'string',
                description:
                  'Extracto de ~120 caracteres alrededor de la coincidencia. Presente cuando el ' +
                  'contenido es demasiado largo para incluirlo entero.',
              },
            },
          },
        ],
      },

      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@company.com' },
          password: { type: 'string', format: 'password', example: 'change-me-please' },
        },
      },

      CreateRuleRequest: {
        type: 'object',
        required: ['id', 'title', 'category', 'content'],
        properties: {
          id: {
            type: 'string',
            maxLength: 64,
            pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$',
            example: 'SEC-001',
          },
          title: { type: 'string', minLength: 1, example: 'Validación de entrada y sanitización' },
          category: { type: 'string', minLength: 1, example: 'security' },
          tags: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            default: [],
            example: ['api', 'validation'],
          },
          severity: {
            type: 'string',
            enum: ['mandatory', 'recommended', 'optional'],
            default: 'mandatory',
            example: 'mandatory',
          },
          content: {
            type: 'string',
            example: '# Validación\n\nValidá toda entrada con Zod.',
          },
        },
      },

      UpdateRuleRequest: {
        type: 'object',
        minProperties: 1,
        description:
          'Al menos un campo es obligatorio. Cada actualización incrementa `version` y registra ' +
          '`updatedBy` y `updatedAt`. El `id` no se puede cambiar.',
        properties: {
          title: { type: 'string', minLength: 1 },
          category: { type: 'string', minLength: 1 },
          tags: { type: 'array', items: { type: 'string', minLength: 1 } },
          severity: { type: 'string', enum: ['mandatory', 'recommended', 'optional'] },
          active: { type: 'boolean' },
          content: { type: 'string' },
        },
      },

      CreateUserRequest: {
        type: 'object',
        required: ['email', 'role', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'editor@company.com' },
          githubUsername: { type: 'string', example: 'octocat' },
          role: { type: 'string', enum: ['admin', 'editor'], example: 'editor' },
          password: { type: 'string', format: 'password', minLength: 8 },
        },
      },

      UpdateUserRequest: {
        type: 'object',
        minProperties: 1,
        description: 'Al menos un campo es obligatorio. El email no se puede modificar.',
        properties: {
          githubUsername: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'editor'] },
          active: { type: 'boolean' },
          password: { type: 'string', format: 'password', minLength: 8 },
        },
      },

      CreateTokenRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            description: 'Nombre identificable del consumidor, por ejemplo el proyecto o agente.',
            example: 'proyecto-pagos-agent',
          },
        },
      },

      Token: {
        type: 'object',
        required: ['id', 'name', 'active', 'createdAt', 'lastUsedAt'],
        properties: {
          id: { type: 'string', example: 'tok_ab12cd34ef56' },
          name: { type: 'string', example: 'proyecto-pagos-agent' },
          active: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          lastUsedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Se actualiza en cada request MCP autenticado con este token.',
          },
        },
      },

      TokenCreated: {
        allOf: [
          ref('Token'),
          {
            type: 'object',
            required: ['token'],
            properties: {
              token: {
                type: 'string',
                description:
                  'Secreto en claro. Solo se devuelve en esta respuesta; guardalo en un ' +
                  'gestor de secretos.',
                example: 'mcp_...',
              },
            },
          },
        ],
      },

      JsonRpcRequest: {
        type: 'object',
        required: ['jsonrpc', 'method'],
        properties: {
          jsonrpc: { type: 'string', enum: ['2.0'] },
          id: {
            description: 'ID de la request JSON-RPC. Se omite en notificaciones.',
            oneOf: [{ type: 'string' }, { type: 'integer' }],
            example: 1,
          },
          method: {
            type: 'string',
            example: 'tools/call',
            description:
              'Método MCP. Ejemplos: `initialize`, `tools/list`, `tools/call`, `resources/list`, ' +
              '`resources/read`.',
          },
          params: {
            type: 'object',
            additionalProperties: true,
            example: { name: 'search_rules', arguments: { query: 'secretos' } },
          },
        },
        example: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'list_rules', arguments: { category: 'security' } },
        },
      },

      JsonRpcResponse: {
        type: 'object',
        additionalProperties: true,
        description:
          'Respuesta JSON-RPC 2.0. Puede llegar como `application/json` o como un frame SSE ' +
          '(`text/event-stream`, líneas `data:`).',
      },
    },
  },

  paths: {
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesión',
        description:
          'Valida email y contraseña y establece la cookie de sesión firmada (8 horas). ' +
          'No requiere autenticación previa.',
        operationId: 'login',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': jsonContent(ref('LoginRequest')) },
        },
        responses: {
          '200': {
            description: 'Sesión creada. La cookie viaja en `Set-Cookie`.',
            headers: {
              'Set-Cookie': {
                description:
                  'Cookie `session` firmada, HttpOnly, SameSite=Strict y Secure en producción.',
                schema: { type: 'string' },
                example:
                  'session=usr_ab12cd34ef56.1764180000.abc123; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800',
              },
            },
            content: {
              'application/json': jsonContent(ref('SessionUser'), {
                id: 'usr_ab12cd34ef56',
                email: 'admin@company.com',
                githubUsername: 'octocat',
                role: 'admin',
              }),
            },
          },
          '400': responseRef('BadRequest'),
          '401': responseRef('InvalidCredentials'),
        },
      },
    },

    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Cerrar sesión',
        description: 'Limpia la cookie de sesión. Es idempotente y no falla si no había sesión.',
        operationId: 'logout',
        security: [],
        responses: {
          '204': { description: 'Cookie de sesión eliminada.' },
        },
      },
    },

    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Usuario autenticado actual',
        operationId: 'getCurrentUser',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Usuario de la sesión actual.',
            content: { 'application/json': jsonContent(ref('SessionUser')) },
          },
          '401': responseRef('Unauthorized'),
        },
      },
    },

    '/api/rules': {
      get: {
        tags: ['Rules'],
        summary: 'Listar reglas',
        description:
          'Devuelve metadatos de reglas, sin el Markdown. Sin filtro `active` devuelve activas e ' +
          'inactivas. Los filtros se combinan con AND y comparan de forma exacta.',
        operationId: 'listRules',
        security: sessionSecurity,
        parameters: [categoryQuery, tagQuery, activeQuery],
        responses: {
          '200': {
            description: 'Lista de metadatos ordenada por `id`.',
            content: {
              'application/json': jsonContent({ type: 'array', items: ref('RuleMeta') }),
            },
          },
          '400': responseRef('BadRequest'),
          '401': responseRef('Unauthorized'),
        },
      },
      post: {
        tags: ['Rules'],
        summary: 'Crear regla',
        description:
          'Crea una regla activa con `version: 1`. Falla con 409 si el `id` ya existe. ' +
          'Disponible para `admin` y `editor`.',
        operationId: 'createRule',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: { 'application/json': jsonContent(ref('CreateRuleRequest')) },
        },
        responses: {
          '201': {
            description: 'Regla creada.',
            content: { 'application/json': jsonContent(ref('Rule')) },
          },
          '400': responseRef('BadRequest'),
          '401': responseRef('Unauthorized'),
          '409': responseRef('Conflict'),
        },
      },
    },

    '/api/rules/{id}': {
      parameters: [ruleIdPath],
      get: {
        tags: ['Rules'],
        summary: 'Obtener una regla',
        description: 'Devuelve metadatos completos y contenido Markdown de una regla.',
        operationId: 'getRule',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Regla encontrada.',
            content: { 'application/json': jsonContent(ref('Rule')) },
          },
          '401': responseRef('Unauthorized'),
          '404': responseRef('NotFound'),
        },
      },
      put: {
        tags: ['Rules'],
        summary: 'Actualizar una regla',
        description:
          'Actualiza metadatos y/o `content`. Incrementa `version`, actualiza `updatedAt` y ' +
          'registra el email del usuario en `updatedBy`. El `id` no se puede cambiar.',
        operationId: 'updateRule',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: { 'application/json': jsonContent(ref('UpdateRuleRequest')) },
        },
        responses: {
          '200': {
            description: 'Regla actualizada.',
            content: { 'application/json': jsonContent(ref('Rule')) },
          },
          '400': responseRef('BadRequest'),
          '401': responseRef('Unauthorized'),
          '404': responseRef('NotFound'),
        },
      },
      delete: {
        tags: ['Rules'],
        summary: 'Eliminar una regla',
        description:
          'Por defecto aplica borrado lógico (`active: false`). Con `hard=true` borra el ' +
          'directorio y el contenido, y requiere rol `admin`.',
        operationId: 'deleteRule',
        security: sessionSecurity,
        parameters: [hardDeleteQuery],
        responses: {
          '204': { description: 'Regla eliminada o desactivada.' },
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '404': responseRef('NotFound'),
        },
      },
    },

    '/api/users': {
      get: {
        tags: ['Users'],
        summary: 'Listar usuarios',
        description: 'Solo `admin`. Nunca expone `passwordHash`.',
        operationId: 'listUsers',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Usuarios internos.',
            content: {
              'application/json': jsonContent({ type: 'array', items: ref('PublicUser') }),
            },
          },
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Crear usuario',
        description: 'Solo `admin`. El usuario se crea activo y con la contraseña hasheada.',
        operationId: 'createUser',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: { 'application/json': jsonContent(ref('CreateUserRequest')) },
        },
        responses: {
          '201': {
            description: 'Usuario creado.',
            content: { 'application/json': jsonContent(ref('PublicUser')) },
          },
          '400': responseRef('BadRequest'),
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '409': responseRef('Conflict'),
        },
      },
    },

    '/api/users/{id}': {
      parameters: [userIdPath],
      patch: {
        tags: ['Users'],
        summary: 'Actualizar usuario',
        description:
          'Solo `admin`. Permite cambiar rol, `githubUsername`, `active` y/o contraseña. ' +
          'Desactivar un usuario invalida su acceso de inmediato. El email no se puede cambiar.',
        operationId: 'updateUser',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: { 'application/json': jsonContent(ref('UpdateUserRequest')) },
        },
        responses: {
          '200': {
            description: 'Usuario actualizado.',
            content: { 'application/json': jsonContent(ref('PublicUser')) },
          },
          '400': responseRef('BadRequest'),
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '404': responseRef('NotFound'),
        },
      },
    },

    '/api/tokens': {
      get: {
        tags: ['Tokens'],
        summary: 'Listar tokens MCP',
        description: 'Solo `admin`. Devuelve metadatos; nunca el token en claro ni su hash.',
        operationId: 'listTokens',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Tokens emitidos.',
            content: {
              'application/json': jsonContent({ type: 'array', items: ref('Token') }),
            },
          },
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
        },
      },
      post: {
        tags: ['Tokens'],
        summary: 'Crear token MCP',
        description:
          'Solo `admin`. Genera un token de solo lectura y devuelve el secreto en claro **una ' +
          'única vez**. El servidor almacena solo su hash SHA-256.',
        operationId: 'createToken',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: { 'application/json': jsonContent(ref('CreateTokenRequest')) },
        },
        responses: {
          '201': {
            description: 'Token creado. Guardá el campo `token` ahora.',
            content: { 'application/json': jsonContent(ref('TokenCreated')) },
          },
          '400': responseRef('BadRequest'),
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
        },
      },
    },

    '/api/tokens/{id}': {
      parameters: [tokenIdPath],
      delete: {
        tags: ['Tokens'],
        summary: 'Revocar token MCP',
        description:
          'Solo `admin`. Marca el token como inactivo; la revocación es efectiva de inmediato.',
        operationId: 'revokeToken',
        security: sessionSecurity,
        responses: {
          '204': { description: 'Token revocado.' },
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '404': responseRef('NotFound'),
        },
      },
    },

    '/mcp': {
      post: {
        tags: ['MCP'],
        summary: 'Endpoint MCP (JSON-RPC 2.0, solo lectura)',
        description: [
          'Transporte MCP Streamable HTTP. Requiere `Authorization: Bearer <token>`; las cookies ' +
            'de sesión se ignoran a propósito.',
          '',
          'Tools disponibles:',
          '',
          '- `list_rules`: metadatos compactos. Argumentos opcionales `category` y `tag`.',
          '- `get_rule`: metadatos + Markdown completo. Argumento `id`.',
          '- `search_rules`: búsqueda case-insensitive en `id`, `title`, `tags` y `content`. ' +
            'Argumento `query`. Devuelve `content` (reglas ≤1200 caracteres) o `snippet`.',
          '',
          'Resource: `rule://{id}` vía `resources/list` y `resources/read`.',
          '',
          'Enviá `Accept: application/json, text/event-stream`; la respuesta puede ser JSON o SSE.',
        ].join('\n'),
        operationId: 'mcp',
        security: mcpSecurity,
        requestBody: {
          required: true,
          content: { 'application/json': jsonContent(ref('JsonRpcRequest')) },
        },
        responses: {
          '200': {
            description: 'Respuesta JSON-RPC 2.0 (JSON o evento SSE).',
            content: {
              'application/json': jsonContent(ref('JsonRpcResponse')),
              'text/event-stream': jsonContent(ref('JsonRpcResponse')),
            },
          },
          '401': responseRef('McpUnauthorized'),
        },
      },
    },
  },
}
