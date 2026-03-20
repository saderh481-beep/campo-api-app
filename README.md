# API App - Documentación de Endpoints

Esta API proporciona endpoints para la aplicación móvil y servicios de backend.

## Autenticación

Todas las rutas (excepto `/auth/*`) requieren autenticación mediante JWT en el header:
```
Authorization: Bearer <token>
```

## Endpoints

### Auth (`/auth`)

#### POST `/tecnico`
Autentica a un técnico usando su código de acceso.

**Body:**
```json
{
  "codigo": "string (5 caracteres)"
}
```

**Respuesta Exitosa (200):**
```json
{
  "token": "jwt_token",
  "tecnico": {
    "id": "uuid",
    "nombre": "string"
  }
}
```

**Errores:**
- 401: Código inválido o expirado
- 401: Técnico no encontrado o inactivo

### Bitácoras (`/bitacoras`)

Todas las rutas requieren autenticación de técnico.

#### GET `/`
Obtiene las bitácoras del técnico autenticado para el mes actual.

**Respuesta Exitosa (200):**
```json
[
  {
    "id": "uuid",
    "tipo": "string (beneficiario|actividad)",
    "estado": "string",
    "fecha_inicio": "timestamp",
    "fecha_fin": "timestamp (nullable)",
    "sync_id": "uuid (nullable)"
  }
]
```

#### GET `/:id`
Obtiene una bitácora específica por ID.

**Parámetros:**
- `id`: UUID de la bitácora

**Respuesta Exitosa (200):**
```json
{
  "id": "uuid",
  "tipo": "string",
  "tecnico_id": "uuid",
  "beneficiario_id": "uuid (nullable)",
  "cadena_productiva_id": "uuid (nullable)",
  "actividad_id": "uuid (nullable)",
  "fecha_inicio": "timestamp",
  "fecha_fin": "timestamp (nullable)",
  "coord_inicio": "point (nullable)",
  "coord_fin": "point (nullable)",
  "actividades_desc": "string",
  "recomendaciones": "string (nullable)",
  "comentarios_beneficiario": "string (nullable)",
  "coordinacion_interinst": "boolean",
  "instancia_coordinada": "string (nullable)",
  "proposito_coordinacion": "string (nullable)",
  "observaciones_coordinador": "string (nullable)",
  "foto_rostro_url": "string (nullable)",
  "firma_url": "string (nullable)",
  "fotos_campo": "string[]",
  "estado": "string",
  "pdf_version": "smallint",
  "pdf_url_actual": "string (nullable)",
  "pdf_original_url": "string (nullable)",
  "creada_offline": "boolean",
  "sync_id": "uuid (nullable)",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**Errores:**
- 404: Bitácora no encontrada

#### POST `/`
Crea una nueva bitácora.

**Body (Tipo Beneficiario):**
```json
{
  "tipo": "beneficiario",
  "beneficiario_id": "uuid",
  "cadena_productiva_id": "uuid",
  "fecha_inicio": "datetime",
  "coord_inicio": "string (opcional)",
  "sync_id": "string (opcional)"
}
```

**Body (Tipo Actividad):**
```json
{
  "tipo": "actividad",
  "actividad_id": "uuid",
  "fecha_inicio": "datetime",
  "coord_inicio": "string (opcional)",
  "sync_id": "string (opcional)"
}
```

**Respuesta Exitosa (201):**
```json
{
  "id": "uuid",
  "tipo": "string",
  "estado": "string",
  "fecha_inicio": "timestamp",
  "sync_id": "uuid (nullable)"
}
```

**Errores:**
- 400: Bitácora duplicada (si se proporciona sync_id y ya existe)

#### PATCH `/:id`
Actualiza una bitácora en estado borrador.

**Body:**
```json
{
  "observaciones": "string (opcional)",
  "actividades_realizadas": "string (opcional)"
}
```

**Respuesta Exitosa (200):**
```json
{
  "id": "uuid",
  "tipo": "string",
  "estado": "string",
  "observaciones": "string",
  "actividades_realizadas": "string"
}
```

**Errores:**
- 404: Bitácora no encontrada
- 400: Solo se pueden editar borradores

#### POST `/:id/foto-rostro`
Sube una foto de rostro para la bitácora.

**Body (FormData):**
- `foto`: archivo de imagen

**Respuesta Exitosa (200):**
```json
{
  "foto_rostro_url": "string"
}
```

**Errores:**
- 404: Bitácora no encontrada
- 400: Foto requerida y debe ser un archivo

#### POST `/:id/firma`
Sube una firma para la bitácora.

**Body (FormData):**
- `firma`: archivo de imagen

**Respuesta Exitosa (200):**
```json
{
  "firma_url": "string"
}
```

**Errores:**
- 404: Bitácora no encontrada
- 400: Firma requerida y debe ser un archivo

#### POST `/:id/fotos-campo`
Sube fotos de campo para la bitácora (máximo 10).

**Body (FormData):**
- `fotos`: array de archivos de imagen

**Respuesta Exitosa (200):**
```json
{
  "fotos_campo": "string[]"
}
```

**Errores:**
- 404: Bitácora no encontrada
- 400: Se requiere al menos una foto como archivo
- 400: Máximo 10 fotos por bitácora

#### POST `/:id/cerrar`
Cierra una bitácora y genera su PDF.

**Body:**
```json
{
  "fecha_fin": "datetime",
  "coord_fin": "string (opcional)"
}
```

**Respuesta Exitosa (200):**
```json
{
  "id": "uuid",
  "estado": "cerrada",
  "pdf_url": "string"
}
```

**Errores:**
- 404: Bitácora no encontrada
- 400: La bitácora ya está cerrada

#### DELETE `/:id`
Elimina una bitácora en estado borrador (solo si fue creada hoy).

**Respuesta Exitosa (200):**
```json
{
  "message": "Bitácora eliminada"
}
```

**Errores:**
- 404: Bitácora no encontrada
- 400: Solo se pueden eliminar borradores
- 400: Solo se pueden eliminar borradores creados hoy

### Datos (`/datos`)

Todas las rutas requieren autenticación de técnico.

#### GET `/mis-beneficiarios`
Obtiene la lista de beneficiarios asignados al técnico.

**Respuesta Exitosa (200):**
```json
[
  {
    "id": "uuid",
    "nombre": "string",
    "municipio": "string",
    "localidad": "string (nullable)",
    "direccion": "string (nullable)",
    "cp": "string (nullable)",
    "telefono_principal": "bytea (nullable)",
    "telefono_secundario": "bytea (nullable)",
    "coord_parcela": "point (nullable)",
    "activo": "boolean",
    "cadenas": [
      {
        "id": "uuid",
        "nombre": "string"
      }
    ]
  }
]
```

#### GET `/mis-actividades`
Obtiene la lista de actividades asignadas al técnico.

**Respuesta Exitosa (200):**
```json
[
  {
    "id": "uuid",
    "nombre": "string",
    "descripcion": "string (nullable)",
    "activo": "boolean",
    "created_by": "uuid",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
]
```

#### GET `/cadenas-productivas`
Obtiene la lista de cadenas productivas activas (con caché de 24h).

**Respuesta Exitosa (200):**
```json
[
  {
    "id": "uuid",
    "nombre": "string",
    "descripcion": "string (nullable)",
    "activo": "boolean",
    "created_by": "uuid",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
]
```

### Notificaciones (`/notificaciones`)

Todas las rutas requieren autenticación de técnico.

#### GET `/`
Obtiene las notificaciones no leídas del técnico.

**Respuesta Exitosa (200):**
```json
[
  {
    "id": "uuid",
    "destino_id": "uuid",
    "destino_tipo": "string",
    "tipo": "string",
    "titulo": "string",
    "cuerpo": "string",
    "leido": "boolean",
    "enviado_push": "boolean",
    "enviado_email": "boolean",
    "creado_en": "timestamp"
  }
]
```

#### PATCH `/:id/leer`
Marca una notificación como leída.

**Parámetros:**
- `id`: UUID de la notificación

**Respuesta Exitosa (200):**
```json
{
  "message": "Marcada como leída"
}
```

### Sync (`/sync`)

#### GET `/`
Obtiene el estado de sincronización.

**Respuesta Exitosa (200):**
```json
{
  "last_sync": "timestamp (nullable)",
  "pending_uploads": "integer",
  "pending_downloads": "integer"
}
```

#### POST `/upload`
Sube datos pendientes de sincronización.

**Body:**
```json
{
  "data": "object"
}
```

**Respuesta Exitosa (200):**
```json
{
  "message": "Datos subidos exitosamente",
  "uploaded": "integer"
}
```

#### POST `/download`
Descarga datos pendientes de sincronización.

**Respuesta Exitosa (200):**
```json
{
  "data": "object",
  "timestamp": "timestamp"
}