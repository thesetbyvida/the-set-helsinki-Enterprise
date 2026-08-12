# The Set Helsinki Enterprise 2.0 — Phase 5: 3-week Rota

Entrega acumulativa: incluye Fases 1, 2, 3, 4 y 5.

## Fase 5 — Rota de 3 semanas

- Rota real de **21 días**, siempre empezando en lunes.
- Selector de restaurante y selector de fecha de inicio.
- Botones para periodo anterior/siguiente de 3 semanas.
- Empleados activos filtrados por restaurante y respetando `display_order`.
- Edición por día: **Alku / Start**, **Loppu / End**, **Koodi / Code** y **Huomio / Note**.
- Turnos que cruzan medianoche se calculan correctamente (por ejemplo 22:00–03:30 = 5.5 h).
- Códigos iniciales: `S`, `VL`, `VV`, `V`, `VP`.
  - `S` y `VL` = 7.5 h.
  - `VV`, `V` y `VP` = 0 h en horas trabajadas.
- Total semanal por empleado.
- Cambios marcados visualmente y guardado masivo.
- Employee = lectura; Manager/Admin/Super Admin = edición, según RLS.

## Mejora de usabilidad solicitada

- **La fila de fechas queda fija** mientras bajas por la lista de empleados.
- **El nombre del empleado queda fijo** mientras haces scroll horizontal.
- El nombre del día aparece junto a la fecha.
- En impresión se muestran las **horas reales de entrada y salida**, por ejemplo `16:00–23:30`, no solamente `7.5`.
- Código y nota también aparecen en impresión.
- Cada semana se imprime en su propia página **A4 horizontal**.

## Base de datos

Si ya tienes Fases 1–4 instaladas, ejecuta solamente:

```text
supabase/migrations/005_rota.sql
```

Si instalas desde cero:

```text
001_foundation.sql
002_restaurants.sql
003_employees.sql
004_users_permissions.sql
005_rota.sql
```

La migración crea:

- `rota_periods`
- `rota_shifts`
- RLS para lectura por restaurante.
- Escritura de Rota para `manager`, `admin` y `super_admin`.

## Despliegue

```bash
npm install
npm run build
```

En Vercel:

- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Root Directory: `./`

## Siguiente fase

**Phase 6:** motor de cálculo TES / HourCalc para evening, night, Sunday, holiday y aatto-lisä, preparando Payroll.
