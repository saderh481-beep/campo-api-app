# Fix Token Invalid After Login (401 token_invalido)

## Status: In Progress

- [x] Step 1: Added detailed logging to `src/lib/jwt.ts` verifyJwt ✓\n- [x] Step 2: Created `src/middleware/auth-fixed.ts` with full logging (use instead of broken auth.ts)
- [ ] Step 3: Deploy changes to Railway and reproduce issue (collect server logs)
- [ ] Step 4: Query DB for tecnico '8b802846-2857-4ba8-a7d9-070b1c862351' status
- [ ] Step 5: Test token decode/curl reproduction
- [ ] Step 6: Improve JWT expiration to fixed 30 days
- [ ] Step 7: Distinguish error types (jwt_expired vs invalid vs db_issue)
- [ ] Step 8: Verify Railway env JWT_SECRET stability
- [ ] Step 9: Test fixes and complete

**Next:** 
1. Replace import { authMiddleware } from "@/middleware/auth"; → "@/middleware/auth-fixed"; in controllers (sync, bitacora, auth, notif, benef).
2. Deploy with `railway deploy` (uses Dockerfile).
3. Reproduce in app, share new server logs from Railway.
4. Proceed based on logs.

