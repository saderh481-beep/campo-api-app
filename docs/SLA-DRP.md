# SLAs y Métricas de Servicio

## Definiciones

| Término | Definición |
|---------|------------|
| **Uptime** | Porcentaje de tiempo que el servicio está disponible |
| **Latencia p50** | Percentil 50 del tiempo de respuesta |
| **Latencia p95** | Percentil 95 del tiempo de respuesta |
| **Error rate** | Porcentaje de requests que retornan 5xx |

## Objetivos de Servicio

### API Backend

| Métrica | Objetivo | Crítico | Peso |
|---------|----------|---------|------|
| Uptime | >99.9% | <99% | 40% |
| Latencia p50 | <200ms | >500ms | 20% |
| Latencia p95 | <500ms | >1000ms | 20% |
| Error rate | <0.1% | >1% | 20% |

### Servicios Externos

| Servicio | Objetivo | Fallback |
|----------|----------|----------|
| PostgreSQL | >99.9% | Modo degradado (solo lectura) |
| Redis | >99.5% | Sesiones JWT sin cache |
| Cloudinary | >99% | URLs data:image locales |

## Horarios de Cobertura

| Entorno | Horario | SLA |
|---------|---------|-----|
| Producción | 24/7 | 99.9% |
| Staging | Laboral | 99% |
| Desarrollo | Best effort | N/A |

## Proceso de Incidentes

1. **Detección**: Alertas automáticas o reporte manual
2. **Escalamiento**: 15min (crítico), 30min (alto), 60min (medio)
3. **Comunicación**: Updates cada 30min a stakeholders
4. **Resolución**: Target según severidad
5. **Post-mortem**: En 48h para incidentes >1h

## Contacto de Emergencia

| Rol | Contacto |
|-----|----------|
| On-call | Por definir |
| DevOps Lead | Por definir |
| Product Owner | Por definir |

---

# Plan de Recuperación ante Desastres (DRP)

## Objetivo

Minimizar el tiempo de inactividad y la pérdida de datos en caso de desastres.

## Roles y Responsabilidades

| Rol | Responsable | Funciones |
|-----|-------------|-----------|
| Incident Commander | Por definir | Coordinar respuesta |
| Communications Lead | Por definir | Comunicar a stakeholders |
| Technical Lead | Por definir | Decisiones técnicas |
| Recovery Lead | Por definir | Ejecutar recuperación |

## Tipos de Desastres

### 1. Pérdida de Base de Datos

**RTO**: 4 horas | **RPO**: 1 hora

**Escenarios:**
- Base de datos corrupta
- Pérdida de datos
-tables no accesibles

**Procedimiento:**
1. Verificar estado de Railway PostgreSQL
2. Restaurar desde backup más reciente
3. Verificar integridad de datos
4. Comunicar a usuarios si hay pérdida de datos

### 2. Pérdida de Redis

**RTO**: 1 hora | **RPO**: 30 minutos

**Escenarios:**
- Redis no responde
- Pérdida de sesiones

**Procedimiento:**
1. Verificar estado de Railway Redis
2. Si no recoverable, reiniciar servicio
3. Usuarios deberán re-autenticarse
4. Sesiones se recrean desde JWT

### 3. Falla de API

**RTO**: 30 minutos | **RPO**: N/A

**Escenarios:**
- Código defectuoso desplegado
- Dependencias fallidas
- Memory leak

**Procedimiento:**
1. Rollback a versión anterior
2. Verificar healthcheck
3. Monitorizar errores

### 4. Compromiso de Seguridad

**RTO**: 15 minutos | **RPO**: N/A

**Escenarios:**
- Credenciales comprometidas
- Acceso no autorizado
- injection Attack

**Procedimiento:**
1. Bloquear tráfico entrante temporalmente
2. Invalidar todas las sesiones (Redis flush)
3. Rotar credenciales
4. Investigar origen del ataque
5. Restaurar servicio gradualmente

## Backups

| Tipo | Frecuencia | Retención | Ubicación |
|------|------------|-----------|------------|
| PostgreSQL | Diario (estimado) | 7 días | Railway managed |
| Redis | N/A | N/A | En memoria |
| Archivos | Con cada upload | N/A | Cloudinary |

## Comunicación en Desastres

| Escenario | Comunicación |
|-----------|-------------|
| Incidente menor | Notificación interna |
| Incidente moderado | Email a stakeholders |
| Incidente mayor | Notificación push + email |
| Afectación >4 horas | Llamadas directas a usuarios clave |

## Simulacros

| Tipo | Frecuencia | Participantes |
|------|------------|---------------|
| Recovery DB | Trimestral | DevOps + Backend |
| Failover | Semestral | DevOps |
| Seguridad | Anual | Full team |

## Checklist Post-Incidente

- [ ] Documentar línea de tiempo
- [ ] Identificar causa raíz
- [ ] Definir acciones correctivas
- [ ] Asignar responsable y fecha
- [ ] Actualizar DRP si es necesario
- [ ] Comunicar a stakeholders
