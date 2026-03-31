# Integración Móvil - Campo API

Guía técnica completa para integrar la aplicación móvil con la API RESTful de gestión agrícola.

## 📱 URL Base de la API

**Desarrollo Local:**
```
http://localhost:3002
```

**Producción (Railway):**
```
https://campo-api-app-production.up.railway.app
```

**Nota:** Reemplazar la URL base según el entorno de despliegue.

## 🔐 Autenticación

### Login de Técnico
**Endpoint:** `POST /auth/tecnico`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "codigo": "12345"
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tecnico": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "nombre": "Juan Pérez",
    "rol": "tecnico"
  }
}
```

**Errores:**
- `401`: Código inválido o expirado
- `401`: Técnico no encontrado o inactivo

### Logout
**Endpoint:** `POST /auth/logout`

**Headers:**
```
Authorization: Bearer <token>
```

**Respuesta (200):**
```json
{
  "message": "Sesión cerrada"
}
```

## 👥 Beneficiarios

### Obtener Beneficiarios del Técnico
**Endpoint:** `GET /mis-beneficiarios`

**Headers:**
```
Authorization: Bearer <token>
```

**Respuesta (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "nombre": "María González",
    "municipio": "San Luis Potosí",
    "localidad": "Centro",
    "direccion": "Calle Principal #123",
    "cp": "78000",
    "telefono_principal": "4441234567",
    "telefono_secundario": "4447654321",
    "coord_parcela": "(22.1234,-100.5678)",
    "activo": true,
    "cadenas": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "nombre": "Maíz"
      }
    ]
  }
]
```

### Crear Nuevo Beneficiario
**Endpoint:** `POST /beneficiarios`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "nombre_completo": "José Martínez",
  "municipio": "San Luis Potosí",
  "localidad": "Vista Hermosa",
  "telefono_contacto": "4449876543",
  "cadena_productiva": "Sorgo"
}
```

**Respuesta (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "nombre": "José Martínez",
  "municipio": "San Luis Potosí",
  "localidad": "Vista Hermosa",
  "telefono_principal": "4449876543",
  "activo": true,
  "cadenas": []
}
```

## 📋 Actividades

### Obtener Actividades del Técnico
**Endpoint:** `GET /mis-actividades`

**Headers:**
```
Authorization: Bearer <token>
```

**Respuesta (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "nombre": "Asesoría Técnica",
    "descripcion": "Asesoría en manejo agronómico",
    "activo": true,
    "created_by": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2026-03-23T10:00:00.000Z",
    "updated_at": "2026-03-23T10:00:00.000Z"
  }
]
```

### Obtener Cadenas Productivas
**Endpoint:** `GET /cadenas-productivas`

**Headers:**
```
Authorization: Bearer <token>
```

**Respuesta (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "nombre": "Maíz",
    "descripcion": "Cultivo de maíz grano",
    "activo": true,
    "created_by": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2026-03-23T10:00:00.000Z",
    "updated_at": "2026-03-23T10:00:00.000Z"
  }
]
```

### Obtener Localidades
**Endpoint:** `GET /localidades?municipio=San%20Luis%20Potosí`

**Headers:**
```
Authorization: Bearer <token>
```

**Respuesta (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440004",
    "municipio": "San Luis Potosí",
    "nombre": "Centro",
    "cp": "78000",
    "activo": true,
    "created_by": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2026-03-23T10:00:00.000Z",
    "updated_at": "2026-03-23T10:00:00.000Z",
    "zona_id": "550e8400-e29b-41d4-a716-446655440005"
  }
]
```

## 📊 Bitácoras

### Crear Bitácora Tipo Beneficiario
**Endpoint:** `POST /bitacoras`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "tipo": "beneficiario",
  "beneficiario_id": "550e8400-e29b-41d4-a716-446655440000",
  "cadena_productiva_id": "550e8400-e29b-41d4-a716-446655440001",
  "fecha_inicio": "2026-03-23T10:00:00Z",
  "coord_inicio": "(22.1234,-100.5678)",
  "sync_id": "sync-12345"
}
```

**Respuesta (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440006",
  "tipo": "beneficiario",
  "estado": "borrador",
  "fecha_inicio": "2026-03-23T10:00:00.000Z",
  "sync_id": "sync-12345"
}
```

### Crear Bitácora Tipo Actividad
**Endpoint:** `POST /bitacoras`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "tipo": "actividad",
  "actividad_id": "550e8400-e29b-41d4-a716-446655440003",
  "fecha_inicio": "2026-03-23T10:00:00Z",
  "coord_inicio": "(22.1234,-100.5678)",
  "sync_id": "sync-12346"
}
```

### Obtener Bitácoras del Técnico
**Endpoint:** `GET /bitacoras?limit=50&offset=0`

**Headers:**
```
Authorization: Bearer <token>
```

**Respuesta (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440006",
    "tipo": "beneficiario",
    "estado": "borrador",
    "fecha_inicio": "2026-03-23T10:00:00.000Z",
    "fecha_fin": null,
    "sync_id": "sync-12345"
  }
]
```

### Obtener Bitácora por ID
**Endpoint:** `GET /bitacoras/550e8400-e29b-41d4-a716-446655440006`

**Headers:**
```
Authorization: Bearer <token>
```

**Respuesta (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440006",
  "tipo": "beneficiario",
  "tecnico_id": "550e8400-e29b-41d4-a716-446655440000",
  "beneficiario_id": "550e8400-e29b-41d4-a716-446655440000",
  "cadena_productiva_id": "550e8400-e29b-41d4-a716-446655440001",
  "actividad_id": null,
  "fecha_inicio": "2026-03-23T10:00:00.000Z",
  "fecha_fin": null,
  "coord_inicio": "(22.1234,-100.5678)",
  "coord_fin": null,
  "actividades_desc": "",
  "recomendaciones": null,
  "comentarios_beneficiario": null,
  "coordinacion_interinst": false,
  "instancia_coordinada": null,
  "proposito_coordinacion": null,
  "observaciones_coordinador": null,
  "foto_rostro_url": null,
  "firma_url": null,
  "fotos_campo": [],
  "estado": "borrador",
  "pdf_version": 0,
  "pdf_url_actual": null,
  "pdf_original_url": null,
  "creada_offline": false,
  "sync_id": "sync-12345",
  "created_at": "2026-03-23T10:00:00.000Z",
  "updated_at": "2026-03-23T10:00:00.000Z"
}
```

### Subir Foto del Rostro
**Endpoint:** `POST /bitacoras/550e8400-e29b-41d4-a716-446655440006/foto-rostro`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**FormData:**
- `foto`: Archivo de imagen (JPEG/PNG)

**Respuesta (200):**
```json
{
  "foto_rostro_url": "https://res.cloudinary.com/.../foto_rostro_sync-12345.jpg"
}
```

### Subir Firma
**Endpoint:** `POST /bitacoras/550e8400-e29b-41d4-a716-446655440006/firma`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**FormData:**
- `firma`: Archivo de imagen (JPEG/PNG)

**Respuesta (200):**
```json
{
  "firma_url": "https://res.cloudinary.com/.../firma_sync-12345.jpg"
}
```

### Subir Fotos de Campo
**Endpoint:** `POST /bitacoras/550e8400-e29b-41d4-a716-446655440006/fotos-campo`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**FormData:**
- `fotos[]`: Arreglo de archivos de imagen (máximo 10)

**Respuesta (200):**
```json
{
  "fotos_campo": [
    "https://res.cloudinary.com/.../foto_campo_1.jpg",
    "https://res.cloudinary.com/.../foto_campo_2.jpg"
  ]
}
```

### Cerrar Bitácora
**Endpoint:** `POST /bitacoras/550e8400-e29b-41d4-a716-446655440006/cerrar`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "fecha_fin": "2026-03-23T11:00:00Z",
  "coord_fin": "(22.1234,-100.5678)"
}
```

**Respuesta (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440006",
  "estado": "cerrada",
  "pdf_url": "https://res.cloudinary.com/.../bitacora_sync-12345.pdf"
}
```

### Actualizar Bitácora
**Endpoint:** `PATCH /bitacoras/550e8400-e29b-41d4-a716-446655440006`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "observaciones_coordinador": "Observaciones del coordinador",
  "actividades_desc": "Descripción de actividades realizadas",
  "recomendaciones": "Recomendaciones técnicas",
  "comentarios_beneficiario": "Comentarios del beneficiario"
}
```

**Respuesta (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440006",
  "tipo": "beneficiario",
  "estado": "borrador",
  "observaciones_coordinador": "Observaciones del coordinador",
  "actividades_desc": "Descripción de actividades realizadas",
  "recomendaciones": "Recomendaciones técnicas",
  "comentarios_beneficiario": "Comentarios del beneficiario"
}
```

## 📡 Sincronización Offline

### Sincronizar Operaciones
**Endpoint:** `POST /sync`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "operaciones": [
    {
      "operacion": "crear_bitacora",
      "timestamp": "2026-03-23T10:00:00Z",
      "payload": {
        "tipo": "beneficiario",
        "beneficiario_id": "550e8400-e29b-41d4-a716-446655440000",
        "fecha_inicio": "2026-03-23T10:00:00Z",
        "sync_id": "sync-offline-001"
      }
    },
    {
      "operacion": "cerrar_bitacora",
      "timestamp": "2026-03-23T11:00:00Z",
      "payload": {
        "fecha_fin": "2026-03-23T11:00:00Z",
        "sync_id": "sync-offline-001"
      }
    }
  ]
}
```

**Respuesta (200):**
```json
{
  "procesadas": 2,
  "resultados": [
    {
      "sync_id": "sync-offline-001",
      "operacion": "crear_bitacora",
      "exito": true
    },
    {
      "sync_id": "sync-offline-001",
      "operacion": "cerrar_bitacora",
      "exito": true
    }
  ]
}
```

### Obtener Cambios Delta
**Endpoint:** `GET /sync/delta?ultimo_sync=2026-03-23T00:00:00Z`

**Headers:**
```
Authorization: Bearer <token>
```

**Respuesta (200):**
```json
{
  "sync_ts": "2026-03-23T12:00:00.000Z",
  "beneficiarios": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440007",
      "nombre": "Nuevo Beneficiario",
      "municipio": "Nuevo Municipio",
      "localidad": "Nueva Localidad",
      "updated_at": "2026-03-23T11:30:00.000Z"
    }
  ],
  "actividades": [],
  "cadenas": []
}
```

## 🔔 Notificaciones

### Obtener Notificaciones
**Endpoint:** `GET /notificaciones`

**Headers:**
```
Authorization: Bearer <token>
```

**Respuesta (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440008",
    "destino_id": "550e8400-e29b-41d4-a716-446655440000",
    "destino_tipo": "tecnico",
    "tipo": "recordatorio",
    "titulo": "Recordatorio de Bitácoras",
    "cuerpo": "Tienes 3 bitácoras pendientes por cerrar",
    "leido": false,
    "enviado_push": false,
    "enviado_email": false,
    "created_at": "2026-03-23T09:00:00.000Z"
  }
]
```

### Marcar Notificación como Leída
**Endpoint:** `PATCH /notificaciones/550e8400-e29b-41d4-a716-446655440008/leer`

**Headers:**
```
Authorization: Bearer <token>
```

**Respuesta (200):**
```json
{
  "message": "Marcada como leída"
}
```

## 🏥 Health Checks

### Estado General
**Endpoint:** `GET /health`

**Respuesta (200):**
```json
{
  "status": "ok",
  "service": "api-app",
  "ts": "2026-03-23T12:00:00.000Z",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

**Respuesta (503):**
```json
{
  "status": "degraded",
  "service": "api-app",
  "ts": "2026-03-23T12:00:00.000Z",
  "checks": {
    "database": "error",
    "redis": "ok"
  }
}
```

### Estado de Redis
**Endpoint:** `GET /health/redis`

**Respuesta (200):**
```json
{
  "redis": {
    "status": "healthy",
    "latency": 5
  },
  "service": "api-app",
  "ts": "2026-03-23T12:00:00.000Z"
}
```

## 📋 Requisitos Técnicos Móvil

### Conexiones Requeridas
1. **HTTPS**: Todas las conexiones deben ser seguras
2. **CORS**: La API permite cualquier origen (`*`)
3. **Timeout**: Configurar timeout de 30 segundos para operaciones largas
4. **Retries**: Implementar reintentos para errores 5xx

### Validaciones Móvil
1. **JWT Storage**: Almacenar token de forma segura (Keychain/Keystore)
2. **Token Expiry**: Validar expiración y refrescar sesión
3. **Offline Storage**: Almacenar operaciones para sincronización posterior
4. **File Upload**: Manejar subida de archivos con progreso

### Errores Comunes
- `401`: Token inválido o expirado → Redirigir a login
- `403`: Acceso denegado → Verificar permisos
- `422`: Datos inválidos → Validar formulario
- `429`: Demasiadas solicitudes → Esperar y reintentar
- `500`: Error interno → Notificar al usuario y reintentar

## 🚀 Despliegue en Railway

### Variables de Entorno para Producción
```env
NODE_ENV=production
PORT=3002
DATABASE_URL="postgresql://user:pass@host:port/db"
REDIS_URL="redis://user:pass@host:port"
JWT_SECRET="clave_secreta_segura_256_bits"
CLOUDINARY_CLOUD_NAME="tu_cloud_name"
CLOUDINARY_API_KEY="tu_api_key"
CLOUDINARY_API_SECRET="tu_api_secret"
CLOUDINARY_PRESET_IMAGENES="campo_imagenes"
CLOUDINARY_PRESET_DOCS="campo_docs"
```

### Pasos para Railway
1. Conectar repositorio GitHub
2. Configurar variables de entorno
3. Desplegar automáticamente
4. Obtener URL de producción

## 📞 Soporte Técnico

### Contacto para Integración
- **Email**: soporte@campoapi.com
- **GitHub Issues**: Reportar bugs y solicitudes
- **Documentación**: [README.md](./README.md)

### Monitoreo
- **Health Checks**: `/health` y `/health/redis`
- **Logs**: Accesibles en Railway dashboard
- **Métricas**: Contadores de operaciones y tiempos de respuesta

---

**Nota:** Esta documentación está actualizada para la versión actual de la API. Cualquier cambio en endpoints o formatos será documentado en este archivo.