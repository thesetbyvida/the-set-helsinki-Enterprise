# The Set Helsinki Enterprise 2.0 — Phase 3 Employees

Entrega acumulativa: incluye Fases 1, 2 y 3.

## Incluye

### Fase 1
- Autenticación, recuperación de contraseña, roles, idiomas y navegación.

### Fase 2
- Restaurantes completos.

### Fase 3
- Crear, editar y eliminar empleados.
- Activar y desactivar empleados.
- Número de empleado.
- Email, teléfono, dirección y fecha de nacimiento.
- Cargo.
- Contrato 112,5 h, contrato 0 h o salario mensual.
- Horas contratadas.
- Tarifa por hora.
- Salario mensual.
- Banco de horas.
- Asignación a varios restaurantes.
- Filtro por restaurante.
- Búsqueda por nombre, número o cargo.
- Permisos: Super Admin y Admin editan; Manager y Employee consultan.

## Supabase

Ejecuta en orden:

```text
supabase/migrations/001_foundation.sql
supabase/migrations/002_restaurants.sql
supabase/migrations/003_employees.sql
```

Si ya tienes Fase 2, ejecuta solamente:

```text
supabase/migrations/003_employees.sql
```

## GitHub

Descomprime el ZIP y reemplaza el contenido del repositorio de Fase 2.

## Vercel

- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Root Directory: `./`

## Próxima entrega

Fase 4: Usuarios y permisos.
