# Campo API - Sistema de Gestión de Técnicos Agrícolas

API RESTful para la gestión de técnicos, beneficiarios y bitácoras agrícolas. Sistema robusto con soporte offline, autenticación segura y sincronización inteligente.

## 🚀 Características Principales

- **🔐 Autenticación Segura**: JWT con Redis para sesiones persistentes
- **📱 Soporte Offline**: Sincronización inteligente para trabajo sin internet
- **📊 Gestión Completa**: Beneficiarios, actividades, bitácoras y reportes
- **☁️ Cloud Integration**: Cloudinary para manejo de archivos y evidencias
- **🔒 Validación Robusta**: Protección contra ataques y datos inconsistentes
- **⚡ Alta Disponibilidad**: Health checks y manejo de errores profesional

## 🏗️ Arquitectura

La API sigue una arquitectura limpia y escalable:

```
src/
├── app.ts                    # Configuración principal de Hono
├── index.ts                  # Punto de entrada con validación de entorno
├── controllers/              # Controladores de rutas
│   ├── auth.controller.ts    # Autenticación de técnicos
│   ├── beneficiario.controller.ts  # Gestión de beneficiarios
│   ├── bitacora.controller.ts      # Bitácoras y reportes
│   ├── notificacion.controller.ts  # Notificaciones
│   ├── sync.controller.ts          # Sincronización offline
│   └── index.ts
├── services/                 # Lógica de negocio
│   ├── auth.service.ts       # Servicios de autenticación
│   ├── beneficiario.service.ts
│   ├── bitacora.service.ts
│   ├── notificacion.service.ts
│   ├── sync.service.ts       # Sincronización inteligente
│   └── index.ts
├── models/                   # Tipos TypeScript
│   ├── usuario.ts
│   ├── beneficiario.ts
│   ├── bitacora.ts
│   ├── asignacion.ts
│   ├── auth-log.ts
│   └── index.ts
├── lib/                      # Utilidades
│   ├── cloudinary.ts         # Manejo de archivos
│   ├── jwt.ts                # Autenticación JWT
│   ├── pdf.ts                # Generación de PDFs
│   └── redis.ts              # Conexión y sanitización Redis
├── middleware/               # Middlewares
│   ├── auth.ts               # Middleware de autenticación
│   └── ratelimit.ts          # Protección contra ataques
└── db/                       # Conexión a base de datos
    └── index.ts              # PostgreSQL con sanitización
```

## 📋 Requisitos del Sistema

- **Node.js**: Versión 18 o superior
- **Bun**: Runtime moderno para TypeScript
- **PostgreSQL**: Base de datos relacional
- **Redis**: Almacenamiento de sesiones y cache
- **Cloudinary**: Almacenamiento de archivos (opcional para desarrollo)

## ⚙️ Configuración

### Variables de Entorno

Crea un archivo `.env` basado en `.env.example`:

```env
# Base de datos
DATABASE_URL="postgresql://postgres:password@localhost:5432/campo_db"
DATABASE_PUBLIC_URL="postgresql://postgres:password@localhost:5432/campo_db"

# Redis
REDIS_URL="redis://localhost:6379"
REDIS_PUBLIC_URL="redis://localhost:6379"

# JWT
JWT_SECRET="tu_clave_secreta_jwt_aqui"

# Cloudinary (para producción)
CLOUDINARY_CLOUD_NAME="tu_cloud_name"
CLOUDINARY_API_KEY="tu_api_key"
CLOUDINARY_API_SECRET="tu_api_secret"
CLOUDINARY_PRESET_IMAGENES="campo_imagenes"
CLOUDINARY_PRESET_DOCS="campo_docs"

# Servidor
PORT=3002
NODE_ENV=development
```

### Instalación

```bash
# Instalar dependencias
bun install

# Iniciar desarrollo
bun run dev

# Construir para producción
bun run build

# Iniciar producción
bun run start
```

## 🔌 Endpoints API

### Autenticación

#### POST /auth/tecnico
Inicia sesión de técnico con código de acceso.

**Body:**
```json
{
  "codigo": "12345"
}
```

**Respuesta:**
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

#### POST /auth/logout
Cierra sesión del técnico autenticado.

### Beneficiarios

#### GET /mis-beneficiarios
Obtiene beneficiarios asignados al técnico.

#### POST /beneficiarios
Registra un nuevo beneficiario.

**Body:**
```json
{
  "nombre_completo": "María González",
  "municipio": "San Luis Potosí",
  "localidad": "Centro",
  "telefono_contacto": "4441234567",
  "cadena_productiva": "Maíz"
}
```

### Bitácoras

#### POST /bitacoras
Crea una nueva bitácora (tipo beneficiario o actividad).

**Body Tipo Beneficiario:**
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

**Body Tipo Actividad:**
```json
{
  "tipo": "actividad",
  "actividad_id": "550e8400-e29b-41d4-a716-446655440002",
  "fecha_inicio": "2026-03-23T10:00:00Z",
  "coord_inicio": "(22.1234,-100.5678)",
  "sync_id": "sync-12346"
}
```

#### POST /bitacoras/:id/foto-rostro
Sube foto del rostro del beneficiario.

#### POST /bitacoras/:id/firma
Sube firma del beneficiario.

#### POST /bitacoras/:id/fotos-campo
Sube fotos del trabajo en campo (máximo 10).

#### POST /bitacoras/:id/cerrar
Cierra bitácora y genera PDF.

### Sincronización Offline

#### POST /sync
Sincroniza operaciones realizadas offline.

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
        "sync_id": "sync-12345"
      }
    }
  ]
}
```

#### GET /sync/delta?ultimo_sync=2026-03-23T00:00:00Z
Obtiene cambios desde la última sincronización.

## 🛡️ Seguridad

### Autenticación JWT
- Tokens con expiración de 30 días
- Algoritmo HS256 para firma
- Almacenamiento seguro en Redis
- Validación en cada solicitud protegida

### Rate Limiting
- Protección contra ataques de fuerza bruta
- 10 intentos de login por minuto
- 20 solicitudes generales por minuto

### Validación de Datos
- Esquemas Zod para validación robusta
- Sanitización de URLs para prevenir duplicados
- Validación de asignaciones (técnico ↔ beneficiario/actividad)

## 📊 Base de Datos

### Tablas Principales

| Tabla | Descripción | Estado |
|-------|-------------|--------|
| usuarios | Técnicos y coordinadores | ✅ |
| beneficiarios | Información de beneficiarios | ✅ |
| actividades | Actividades asignadas | ✅ |
| bitacoras | Reportes y seguimiento | ✅ |
| asignaciones_beneficiario | Relación técnico-beneficiario | ✅ |
| asignaciones_actividad | Relación técnico-actividad | ✅ |
| beneficiario_cadenas | Cadena productiva del beneficiario | ✅ |
| pdf_versiones | Versiones de PDFs generados | ✅ |
| auth_logs | Auditoría de accesos | ✅ |
| localidades | Catálogo de localidades | ✅ |

### Conexiones Seguras
- Sanitización automática de URLs duplicadas
- Validación de conexiones en startup
- Health checks continuos
- Timeouts configurables

## 🚀 Despliegue

### Docker
```bash
# Construir imagen
docker build -t campo-api .

# Iniciar contenedor
docker run -p 3002:3002 campo-api
```

### Railway
1. Conectar repositorio a Railway
2. Configurar variables de entorno
3. Desplegar automáticamente

### Variables para Producción
```env
NODE_ENV=production
PORT=3002
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
JWT_SECRET="clave_secreta_segura"
```

## 🧪 Pruebas

### Validación de Tipos
```bash
bun run typecheck
```

### Scripts de Utilidad

#### Crear Coordinadores
```bash
bun run scripts/crear-coordinadores.ts
```

#### Ver Estructura DB
```bash
bun run scripts/ver-estructura-db.ts
```

## 🔧 Solución de Problemas

### Errores Comunes

#### Conexión a Redis Fallida
```bash
# Verificar Redis está corriendo
redis-cli ping

# Verificar URL en .env
echo $REDIS_URL
```

#### Conexión a PostgreSQL Fallida
```bash
# Verificar PostgreSQL está corriendo
pg_isready -h localhost -p 5432

# Verificar credenciales en .env
echo $DATABASE_URL
```

#### JWT Secret No Configurado
```bash
# Generar nuevo secreto
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

### Logs de Depuración
```bash
# Ver logs en tiempo real
bun run dev

# Ver logs de producción
docker logs <container_id>
```

## 📈 Monitoreo

### Health Checks
- `/health` - Estado general del sistema
- `/health/redis` - Estado de conexión a Redis

### Métricas
- Contador de operaciones por endpoint
- Tiempos de respuesta
- Errores por tipo

## 🤝 Contribución

1. Fork del repositorio
2. Crear rama de característica
3. Realizar cambios
4. Probar localmente
5. Crear pull request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

## 📞 Soporte

Para soporte técnico o reporte de bugs:

- Crea un issue en GitHub
- Contacta al equipo de desarrollo
- Revisa la documentación en línea

---

**Campo API** - Simplificando la gestión agrícola con tecnología moderna.