# campo-api-app

API REST para la app móvil de técnicos de campo — SaaS Campo · Secretaría de Agricultura Hidalgo.

## Stack

- **Runtime**: Bun
- **Framework**: Hono
- **Base de datos**: PostgreSQL 16 (mismo proyecto Railway que api-web)
- **Caché**: Redis (mismo proyecto Railway)
- **Archivos**: Cloudflare R2

## Estructura

```
src/
├── config/
│   ├── env.ts                    # Variables de entorno validadas con Zod
│   └── db.ts                     # Clientes PostgreSQL + Redis
├── types/
│   └── index.ts                  # JWTPayloadApp, GPS, BitacoraApp
├── lib/
│   ├── errors.ts                 # AppError, NotFoundError, handleError
│   └── jwt.ts                    # signToken (30d), verifyToken
├── middleware/
│   └── auth.ts                   # requireAuth — Bearer token
├── modules/
│   ├── auth/                     # Código 5d · valida Redis TTL · JWT 30d
│   ├── beneficiarios/            # Beneficiarios asignados al técnico
│   ├── actividades-tecnico/      # Actividades asignadas al técnico
│   ├── bitacoras/                # CRUD + cierre + GPS
│   ├── catalogos/                # Cadenas y actividades con caché 24h Redis
│   └── sync/                    # Cola offline FIFO + delta sync
└── index.ts                      # Entry point · registro de rutas
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/login` | Código 5 dígitos → JWT 30 días |
| GET | `/auth/me` | Datos del técnico autenticado |
| GET | `/mis-beneficiarios` | Beneficiarios del técnico (búsqueda fonética) |
| GET | `/mis-beneficiarios/:id` | Detalle de un beneficiario |
| GET | `/mis-actividades` | Actividades asignadas al técnico |
| GET | `/cadenas-productivas` | Catálogo completo (caché Redis 24h) |
| GET | `/actividades` | Catálogo completo (caché Redis 24h) |
| GET | `/bitacoras` | Bitácoras del técnico con filtros |
| GET | `/bitacoras/:id` | Detalle + versiones PDF |
| POST | `/bitacoras` | Nueva bitácora Tipo A o B + GPS inicio |
| PATCH | `/bitacoras/:id` | Actualizar notas (solo borrador) |
| POST | `/bitacoras/:id/cerrar` | GPS fin + cierre + encola PDF |
| POST | `/sync` | Procesa cola offline (hasta 200 ops, FIFO, idempotente) |
| GET | `/sync/delta?desde=` | Cambios desde timestamp para sincronización |

## Autenticación

La app usa **JWT en header**, no en cookie:

```
Authorization: Bearer <token>
```

El token dura **30 días**. Si el Admin regenera o revoca el código del técnico en Redis, el técnico queda bloqueado en su próximo login — los tokens existentes siguen válidos hasta expirar (comportamiento esperado para zonas sin señal).

## Sync offline

La app guarda operaciones localmente en WatermelonDB (SQLite). Al recuperar señal, envía la cola a `POST /sync`:

```json
{
  "operaciones": [
    {
      "clientId": "uuid-local",
      "tabla": "bitacoras",
      "operacion": "create",
      "payload": { "tipo": "A", "beneficiarioId": "...", ... },
      "timestamp": "2026-03-14T10:00:00Z"
    }
  ]
}
```

Cada operación es **idempotente** — si se envía dos veces por reconexión, el servidor detecta el `clientId` duplicado y no crea registros extra.

## Desarrollo local

```bash
bun install
cp .env.example .env
# Rellenar DATABASE_URL, REDIS_URL, JWT_SECRET
bun run dev

curl http://localhost:3002/health
```

## Despliegue en Railway

1. Repo independiente en GitHub
2. Railway → **New Project → Deploy from GitHub repo**
3. Variables de entorno del `.env.example`
4. `railway.toml` se detecta automáticamente
5. Verificar: `https://<nombre>.railway.app/health`
