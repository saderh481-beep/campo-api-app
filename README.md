# API App - Documentación de Endpoints

Esta API proporciona endpoints para la aplicación móvil de técnicos y servicios de backend para trabajo online/offline.

## Arquitectura

La API está organizada en una arquitectura **models/controllers/services**:

```
src/
├── app.ts                    # Configuración principal de Hono
├── index.ts                  # Punto de entrada
├── controllers/              # Controladores de rutas
│   ├── auth.controller.ts
│   ├── beneficiario.controller.ts
│   ├── bitacora.controller.ts
│   ├── notificacion.controller.ts
│   ├── sync.controller.ts
│   └── index.ts
├── services/                 # Lógica de negocio
│   ├── auth.service.ts
│   ├── beneficiario.service.ts
│   ├── bitacora.service.ts
│   ├── notificacion.service.ts
│   ├── sync.service.ts
│   └── index.ts
├── models/                   # Tipos TypeScript
│   ├── usuario.ts
│   ├── beneficiario.ts
│   ├── bitacora.ts
│   ├── asignacion.ts
│   ├── auth-log.ts
│   └── index.ts
├── lib/                      # Utilidades
│   ├── cloudinary.ts
│   ├── jwt.ts
│   ├── pdf.ts
│   └── redis.ts
├── middleware/               # Middlewares
│   ├── auth.ts
│   └── ratelimit.ts
└── db/                       # Conexión a BD
    └── index.ts
```

## Variables de entorno

Para desarrollo local puedes usar [`.env`](c:/App/campo-api-app1/.env). Para producción toma como base [`.env.production.example`](c:/App/campo-api-app1/.env.production.example).

Variables requeridas:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_PRESET_IMAGENES`
- `CLOUDINARY_PRESET_DOCS`
- `CORS_ORIGIN`

Notas:

- `JWT_SECRET` debe tener al menos 32 caracteres.
- En producción no dependas del `.env` local; configura las variables en Railway.
- `CORS_ORIGIN` acepta uno o varios dominios separados por comas.

## Docker

Desarrollo local:

```bash
docker compose up --build
```

El servicio `api-app` ahora expone un healthcheck contra `GET /health`, y Redis también tiene healthcheck configurado.

## Despliegue en Railway

Checklist mínima de producción:

1. Crear el servicio desde este repositorio usando el `Dockerfile`.
2. Definir estas variables en Railway usando [`.env.production.example`](c:/App/campo-api-app1/.env.production.example) como plantilla.
3. Confirmar que `JWT_SECRET` sea único, largo y no reutilizado entre ambientes.
4. Provisionar Postgres y Redis, y copiar sus URLs reales en `DATABASE_URL` y `REDIS_URL`.
5. Configurar `CORS_ORIGIN` con el dominio real del frontend.
6. Verificar que `GET /health` responda `200` después del deploy.
7. Probar al menos `POST /auth/tecnico`, `GET /mis-beneficiarios` y una ruta protegida con token.
8. Revisar logs del servicio si Railway reinicia el contenedor más de una vez.

Recomendaciones:

- No subas secretos al repositorio.
- Usa una base y un Redis distintos por ambiente.
- Si cambias variables críticas, fuerza un redeploy del servicio.

## Flujo funcional esperado

1. El técnico inicia sesión con código de acceso de 5 dígitos.
2. Descarga sus beneficiarios y actividades asignadas.
3. Crea y llena bitácoras con evidencias, en línea o fuera de línea.
4. Cierra bitácoras.
5. Si hay internet, sincroniza bitácoras y evidencias con los servicios correspondientes.
6. La sesión autenticada se guarda en Redis.

## Autenticación

Rutas públicas:

- GET /health
- POST /auth/tecnico

El resto de rutas requiere token en el header Authorization:

```txt
Authorization: Bearer <token>
```

Detalles de sesión:

- La sesión se guarda en Redis con clave session:{token}.
- Si la sesión no existe o expira, responde 401.
- Si el técnico está en periodo vencido o corte aplicado, responde 401 con error periodo_vencido.
- Los datos del técnico (autenticación y validación de sesión) se obtienen de la tabla usuarios.
- Se registran logs de autenticación en la tabla `auth_logs`.

## Endpoints

### Health

#### GET /health

Respuesta 200:

```json
{
  "status": "ok",
  "service": "api-app",
  "ts": "2026-03-23T00:00:00.000Z"
}
```

### Auth

#### POST /auth/tecnico

Validaciones:

- codigo debe ser numérico de 5 dígitos.
- El usuario debe existir en la tabla usuarios y estar activo.
- Si fecha_limite ya venció o estado_corte es distinto de en_servicio, responde 401 con error periodo_vencido.

Body:

```json
{
  "codigo": "12345"
}
```

Respuesta 200:

```json
{
  "token": "jwt_token",
  "tecnico": {
    "id": "uuid",
    "nombre": "string"
  }
}
```

Errores:

- 401: Código inválido o expirado
- 401: Técnico no encontrado o inactivo
- 401: periodo_vencido

#### POST /auth/logout

Cierra la sesión del técnico autenticado.

Respuesta 200:

```json
{
  "message": "Sesión cerrada"
}
```

### Datos

Nota: estas rutas están montadas en la raiz.

#### GET /mis-beneficiarios

Respuesta 200:

```json
[
  {
    "id": "uuid",
    "nombre": "string",
    "municipio": "string",
    "localidad": "string|null",
    "direccion": "string|null",
    "cp": "string|null",
    "telefono_principal": "string|null",
    "telefono_secundario": "string|null",
    "coord_parcela": "string|null",
    "activo": true,
    "cadenas": [
      {
        "id": "uuid",
        "nombre": "string"
      }
    ]
  }
]
```

#### POST /beneficiarios

Crea un nuevo beneficiario y lo asigna automáticamente al técnico.

Body:

```json
{
  "nombre_completo": "string",
  "municipio": "string",
  "localidad": "string",
  "telefono_contacto": "string",
  "cadena_productiva": "string-optional"
}
```

Respuesta 201:

```json
{
  "id": "uuid",
  "nombre": "string",
  "municipio": "string",
  "localidad": "string",
  "telefono_principal": "string",
  "activo": true,
  "cadenas": []
}
```

#### GET /mis-actividades

Respuesta 200:

```json
[
  {
    "id": "uuid",
    "nombre": "string",
    "descripcion": "string|null",
    "activo": true,
    "created_by": "uuid",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
]
```

#### GET /cadenas-productivas

Respuesta 200:

```json
[
  {
    "id": "uuid",
    "nombre": "string",
    "descripcion": "string|null",
    "activo": true,
    "created_by": "uuid",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
]
```

#### GET /localidades?municipio=string

Obtiene localidades filtradas por municipio.

Respuesta 200:

```json
[
  {
    "id": "uuid",
    "municipio": "string",
    "nombre": "string",
    "cp": "string|null",
    "activo": true,
    "created_by": "uuid|null",
    "created_at": "timestamp",
    "updated_at": "timestamp",
    "zona_id": "uuid|null"
  }
]
```

### Bitácoras

#### GET /bitacoras?limit=50&offset=0

Obtiene las bitácoras del técnico autenticado para el mes actual con paginación.

Parámetros de consulta:
- `limit`: Número máximo de resultados (default: 50)
- `offset`: Número de resultados a saltar (default: 0)

Respuesta 200:

```json
[
  {
    "id": "uuid",
    "tipo": "beneficiario|actividad",
    "estado": "borrador|cerrada|...",
    "fecha_inicio": "timestamp",
    "fecha_fin": "timestamp|null",
    "sync_id": "uuid|null"
  }
]
```

#### GET /bitacoras/:id

Respuesta 200:

```json
{
  "id": "uuid",
  "tipo": "beneficiario|actividad",
  "tecnico_id": "uuid",
  "beneficiario_id": "uuid|null",
  "cadena_productiva_id": "uuid|null",
  "actividad_id": "uuid|null",
  "fecha_inicio": "timestamp",
  "fecha_fin": "timestamp|null",
  "coord_inicio": "string|null",
  "coord_fin": "string|null",
  "actividades_desc": "string",
  "recomendaciones": "string|null",
  "comentarios_beneficiario": "string|null",
  "coordinacion_interinst": "boolean",
  "instancia_coordinada": "string|null",
  "proposito_coordinacion": "string|null",
  "observaciones_coordinador": "string|null",
  "foto_rostro_url": "string|null",
  "firma_url": "string|null",
  "fotos_campo": ["string"],
  "estado": "string",
  "pdf_version": "number",
  "pdf_url_actual": "string|null",
  "pdf_original_url": "string|null",
  "creada_offline": "boolean",
  "sync_id": "uuid|null",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

Errores:

- 404: Bitácora no encontrada

#### POST /bitacoras

Body tipo beneficiario:

```json
{
  "tipo": "beneficiario",
  "beneficiario_id": "uuid",
  "cadena_productiva_id": "uuid-optional",
  "fecha_inicio": "2026-03-23T10:00:00Z",
  "coord_inicio": "(x,y)-optional",
  "sync_id": "uuid-optional"
}
```

Body tipo actividad:

```json
{
  "tipo": "actividad",
  "actividad_id": "uuid",
  "fecha_inicio": "2026-03-23T10:00:00Z",
  "coord_inicio": "(x,y)-optional",
  "sync_id": "uuid-optional"
}
```

Respuesta 201:

```json
{
  "id": "uuid",
  "tipo": "string",
  "estado": "borrador",
  "fecha_inicio": "timestamp",
  "sync_id": "uuid|null"
}
```

Si el sync_id ya existe, responde con el id existente y duplicado true.

#### PATCH /bitacoras/:id

Actualiza solo bitácoras en estado borrador.

Body:

```json
{
  "observaciones_coordinador": "string-optional",
  "actividades_desc": "string-optional",
  "coord_inicio": "string-optional",
  "coord_fin": "string-optional",
  "fecha_inicio": "timestamp-optional",
  "fecha_fin": "timestamp-optional",
  "recomendaciones": "string-optional",
  "comentarios_beneficiario": "string-optional"
}
```

Respuesta 200:

```json
{
  "id": "uuid",
  "tipo": "string",
  "estado": "borrador",
  "observaciones_coordinador": "string|null",
  "actividades_desc": "string"
}
```

Errores:

- 404: Bitácora no encontrada
- 400: Solo se pueden editar borradores

#### POST /bitacoras/:id/foto-rostro

FormData:

- foto: archivo

Respuesta 200:

```json
{
  "foto_rostro_url": "string"
}
```

#### POST /bitacoras/:id/firma

FormData:

- firma: archivo

Respuesta 200:

```json
{
  "firma_url": "string"
}
```

#### POST /bitacoras/:id/fotos-campo

FormData:

- fotos: arreglo de archivos (máximo 10 por bitácora)

Respuesta 200:

```json
{
  "fotos_campo": ["string"]
}
```

#### POST /bitacoras/:id/cerrar

Body:

```json
{
  "fecha_fin": "2026-03-23T11:00:00Z",
  "coord_fin": "(x,y)-optional"
}
```

Respuesta 200:

```json
{
  "id": "uuid",
  "estado": "cerrada",
  "pdf_url": "string"
}
```

Errores:

- 404: Bitácora no encontrada
- 400: La bitácora ya está cerrada

#### DELETE /bitacoras/:id

Elimina bitácoras en estado borrador creadas el mismo día.

Respuesta 200:

```json
{
  "message": "Bitácora eliminada"
}
```

### Notificaciones

#### GET /notificaciones

Respuesta 200:

```json
[
  {
    "id": "uuid",
    "destino_id": "uuid",
    "destino_tipo": "string",
    "tipo": "string",
    "titulo": "string",
    "cuerpo": "string",
    "leido": false,
    "enviado_push": false,
    "enviado_email": false,
    "created_at": "timestamp"
  }
]
```

#### PATCH /notificaciones/:id/leer

Respuesta 200:

```json
{
  "message": "Marcada como leída"
}
```

### Sync

#### POST /sync

Procesa operaciones offline ordenadas por timestamp.

Body:

```json
{
  "operaciones": [
    {
      "operacion": "crear_bitacora|editar_bitacora|cerrar_bitacora",
      "timestamp": "2026-03-23T10:00:00Z",
      "payload": {
        "tipo": "actividad",
        "actividad_id": "uuid",
        "fecha_inicio": "2026-03-23T10:00:00Z",
        "coord_inicio": "(x,y)",
        "sync_id": "uuid"
      }
    }
  ]
}
```

Respuesta 200:

```json
{
  "procesadas": 1,
  "resultados": [
    {
      "sync_id": "uuid",
      "operacion": "crear_bitacora",
      "exito": true
    }
  ]
}
```

Nota: Las operaciones `crear_bitacora`, `editar_bitacora` y `cerrar_bitacora` están implementadas.

#### GET /sync/delta?ultimo_sync=ISO-8601

Respuesta 200:

```json
{
  "sync_ts": "timestamp",
  "beneficiarios": [
    {
      "id": "uuid",
      "nombre": "string",
      "municipio": "string",
      "localidad": "string|null",
      "updated_at": "timestamp"
    }
  ],
  "actividades": [
    {
      "id": "uuid",
      "nombre": "string",
      "descripcion": "string|null",
      "updated_at": "timestamp"
    }
  ],
  "cadenas": [
    {
      "id": "uuid",
      "nombre": "string",
      "descripcion": "string|null",
      "updated_at": "timestamp"
    }
  ]
}
```

Error 400:

- Formato de fecha inválido en ultimo_sync

## Scripts de Utilidad

### Crear Coordinadores

Script para crear 3 usuarios coordinadores con códigos de acceso de 6 dígitos.

**Ubicación:** `scripts/crear-coordinadores.ts`

**Uso:**

```bash
bun run scripts/crear-coordinadores.ts
```

**Funcionalidad:**

- Genera 3 usuarios coordinadores con códigos aleatorios de 6 dígitos
- Cada usuario se crea con nombre, correo y código de acceso único
- Los usuarios se crean como activos por defecto
- Muestra en consola los datos de cada coordinador creado

### Ver Estructura DB

Script para ver la estructura completa de la base de datos.

**Ubicación:** `scripts/ver-estructura-db.ts`

**Uso:**

```bash
bun run scripts/ver-estructura-db.ts
```

**Funcionalidad:**

- Muestra todas las tablas de la base de datos
- Lista las columnas de cada tabla con sus tipos
- Muestra las restricciones de cada tabla

## Tablas de la Base de Datos Utilizadas

| Tabla | Uso | Estado |
|-------|-----|--------|
| usuarios | Login, verificación de permisos | ✅ |
| beneficiarios | CRUD de beneficiarios | ✅ |
| actividades | Consulta de actividades asignadas | ✅ |
| asignaciones_beneficiario | Filtrado de beneficiarios por técnico | ✅ |
| asignaciones_actividad | Filtrado de actividades por técnico | ✅ |
| bitacoras | CRUD completo de bitácoras | ✅ |
| cadenas_productivas | Información para beneficiarios | ✅ |
| notificaciones | Notificaciones del técnico | ✅ |
| beneficiario_cadenas | Relación beneficiario-cadena | ✅ |
| pdf_versiones | Versiones de PDF al cerrar bitácora | ✅ |
| auth_logs | Auditoría de accesos | ✅ |
| localidades | Catálogo para formularios | ✅ |
