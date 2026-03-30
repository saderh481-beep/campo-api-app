# TODO: Disable fecha global

## Plan Steps:
- [x] 1. Edit src/services/auth.service.ts - Comment out fechaLimiteVencida check in loginTecnico
- [x] 2. Edit src/middleware/auth.ts - Comment out fechaLimiteVencida and corteAplicado checks
- [ ] 3. Test authentication endpoints
- [ ] 4. Mark complete

Temporary disable of global date limit validation.
