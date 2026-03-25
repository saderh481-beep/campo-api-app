# API App - Documentacion de Endpoints

Esta API proporciona endpoints para la aplicacion movil de tecnicos y servicios de backend para trabajo online/offline.

## Flujo funcional esperado

1. El tecnico inicia sesion con codigo de acceso de 5 digitos.
2. Descarga sus beneficiarios y actividades asignadas.
3. Crea y llena bitacoras con evidencias, en linea o fuera de linea.
4. Cierra bitacoras.
5. Si hay internet, sincroniza bitacoras y evidencias con los servicios correspondientes.
6. La sesion autenticada se guarda en Redis.

## Autenticacion

Rutas publicas:

- GET /health
- POST /auth/tecnico

El resto de rutas requiere token en el header Authorization:

```txt
Authorization: Bearer <token>
```

Detalles de sesion:

- La sesion se guarda en Redis con clave session:{token}.
- Si la sesion no existe o expira, responde 401.
- Si el tecnico esta en periodo vencido o corte aplicado, responde 401 con error periodo_vencido.
- Los datos del tecnico (autenticacion y validacion de sesion) se obtienen de la tabla usuarios.

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

- codigo debe ser numerico de 5 digitos.
- El usuario debe existir en la tabla usuarios y estar activo.
- Si fecha_limite ya vencio o estado_corte es distinto de en_servicio, responde 401 con error periodo_vencido.

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

- 401: Codigo invalido o expirado
- 401: Tecnico no encontrado o inactivo
- 401: periodo_vencido

### Datos

Nota: estas rutas estan montadas en la raiz.

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
    "telefono_principal": "bytea|null",
    "telefono_secundario": "bytea|null",
    "coord_parcela": "point|null",
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

### Bitacoras

#### GET /bitacoras

Obtiene las bitacoras del tecnico autenticado para el mes actual.

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
  "coord_inicio": "point|null",
  "coord_fin": "point|null",
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

- 404: Bitacora no encontrada

#### POST /bitacoras

Body tipo beneficiario:

```json
{
  "tipo": "beneficiario",
  "beneficiario_id": "uuid",
  "cadena_productiva_id": "uuid",
  "fecha_inicio": "2026-03-23T10:00:00Z",
  "coord_inicio": "(x,y)",
  "sync_id": "uuid-opcional"
}
```

Body tipo actividad:

```json
{
  "tipo": "actividad",
  "actividad_id": "uuid",
  "fecha_inicio": "2026-03-23T10:00:00Z",
  "coord_inicio": "(x,y)",
  "sync_id": "uuid-opcional"
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

Actualiza solo bitacoras en estado borrador.

Body:

```json
{
  "observaciones_coordinador": "string-opcional",
  "actividades_desc": "string-opcional"
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

- 404: Bitacora no encontrada
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

- fotos: arreglo de archivos (maximo 10 por bitacora)

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
  "coord_fin": "(x,y)"
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

- 404: Bitacora no encontrada
- 400: La bitacora ya esta cerrada

#### DELETE /bitacoras/:id

Elimina bitacoras en estado borrador creadas el mismo dia.

Respuesta 200:

```json
{
  "message": "Bitacora eliminada"
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
  "message": "Marcada como leida"
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
      "operacion": "crear_bitacora",
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

Nota: actualmente solo crear_bitacora esta implementada; cerrar_bitacora y editar_bitacora regresan exito false con mensaje.

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

- Formato de fecha invalido en ultimo_sync
