# AGENTS.md

## Propósito del proyecto

Servidor interno en Node.js + TypeScript + Fastify que centraliza reglas de la compañía (seguridad, buenas prácticas, trazabilidad, arquitectura).

- **Humanos:** Gestionan reglas y usuarios mediante una UI HTML estática y API REST autenticada por sesión.
- **Agentes:** Consumen reglas **exclusivamente en modo solo lectura** a través de un endpoint MCP (`/mcp`) autenticado por API Key.

## Stack y convenciones

- **Runtime:** Node.js (ESM `"type": "module"`), TypeScript estricto.
- **Framework HTTP:** Fastify + `@fastify/static` + `@fastify/cookie`.
- **MCP:** `@modelcontextprotocol/server` + `@modelcontextprotocol/fastify` + `zod`.
- **Persistencia:** Sistema de archivos local (`node:fs/promises`) bajo `data/`. Prohibido añadir bases de datos externas salvo cambio explícito en `SPEC.md`.
- **Criptografía/Auth:** `node:crypto` nativo (`scryptSync`, `timingSafeEqual`, `randomBytes`). Sin dependencias OAuth de terceros.

## Reglas críticas de arquitectura

1. **Separación estricta lectura/escritura:** El servidor MCP **nunca** debe exponer _tools_, _resources_ o _prompts_ que creen, modifiquen o eliminen reglas, usuarios o tokens.
2. **Escrituras atómicas en disco:** Toda escritura en `data/` debe escribirse primero a un archivo temporal (`.tmp`) y luego moverse con `fs.rename()`.
3. **Validación en frontera:** Validar todos los payloads REST y parámetros de _tools_ MCP con esquemas `zod`.
4. **Sin secretos en repo:** `data/`, `.env` y cualquier clave/token deben permanecer en `.gitignore`.

## Comandos principales

- Desarrollo: `npm run dev`
- Typecheck: `npx tsc --noEmit`

## Referencia de diseño

Consulta `SPEC.md` antes de crear módulos nuevos, modificar contratos de API o alterar la estructura de `data/`.
