# The Set Helsinki Enterprise 2.0 — Phase 4 Users & Permissions

Entrega acumulativa: incluye Fases 1, 2, 3 y 4.

## Incluye

### Fase 1
- Autenticación, recuperación de contraseña, roles, idiomas y navegación.

### Fase 2
- Restaurantes completos y asignación de acceso por usuario.

### Fase 3
- Empleados completos, contratos, banco de horas y restaurantes por empleado.

### Fase 4 — Usuarios y permisos
- Página **Users / Usuarios / Käyttäjät** real (ya no es placeholder).
- Lista de perfiles de Supabase.
- Crear usuarios desde la app.
- Roles: `employee`, `manager`, `admin`, `super_admin`.
- Activar/desactivar usuarios.
- Asignar uno o varios restaurantes a cada usuario.
- Cambiar contraseña desde la app.
- Protección para que un Admin normal no cree/modifique un `super_admin`.
- El usuario actual no puede desactivarse ni cambiarse su propio rol desde la pantalla Users.
- RLS reforzado para `profiles` y `user_restaurants`.
- Edge Function segura `admin-users` usando `SUPABASE_SERVICE_ROLE_KEY` solamente en el servidor.

## Estructura corregida

Esta entrega normaliza el proyecto Vite/React bajo `src/`, por ejemplo:

```text
src/
  App.tsx
  main.tsx
  components/
  context/
  lib/
  pages/
  styles/
  types/
supabase/
  migrations/
  functions/admin-users/
```

## Supabase — migración

Si ya tienes las Fases 1–3 instaladas, ejecuta solamente:

```text
supabase/migrations/004_users_permissions.sql
```

Si instalas desde cero, ejecuta en orden:

```text
001_foundation.sql
002_restaurants.sql
003_employees.sql
004_users_permissions.sql
```

## Edge Function admin-users

Con Supabase CLI, desde la raíz del proyecto:

```bash
supabase functions deploy admin-users
```

Supabase proporciona a la Edge Function las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. No pongas la Service Role Key en Vercel ni en el frontend.

La app invoca esta función para:

- crear usuarios en `auth.users`;
- crear su fila en `public.profiles`;
- guardar sus restaurantes en `public.user_restaurants`;
- cambiar contraseñas de forma administrativa.

## Vercel

- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Root Directory: `./`

Mantén las mismas variables públicas de Supabase que ya usabas en la Fase 3.

## Próxima entrega

Fase 5: Rota de 3 semanas.
