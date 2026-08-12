# The Set Helsinki Enterprise 2.0 — Phase 6: HourCalc / TES engine

Entrega acumulativa: incluye Fases 1–6.

## Phase 6 — HourCalc

Se añade un motor de cálculo separado del Payroll para validar las horas antes de convertirlas en dinero.

### Cálculos incluidos

- Horas base y horas realmente trabajadas.
- **Evening / iltalisä:** 18:00–24:00.
- **Night / yölisä:** 00:00–06:00.
- Turnos que cruzan medianoche.
- **Sunday:** sábado→domingo cuenta domingo solamente desde 00:00; si el turno empieza el domingo y termina el lunes, el premium de domingo sigue durante ese turno, según la regla operativa solicitada para The Set Helsinki.
- **Holiday:** configurable por fecha y franja horaria.
- **100% total:** unión de Sunday + Holiday para evitar doble conteo si coinciden.
- **Aatto-lisä:** configurable por fecha/franja horaria.
- `S` = 7.5 h; `VL` = 7.5 h; `VV` = 1 día separado; `V/VP` = 0 h.

### Nueva página HourCalc

- Selector de restaurante.
- Selector de periodo de 3 semanas.
- Navegación anterior/siguiente.
- Tabla por empleado con Base, Worked, Evening, Night, Sunday, Holiday, 100%, Aatto, S, VL, VV y V/VP.
- Cabecera y empleado sticky.
- Impresión A4 horizontal.

## Base de datos

Ejecuta después de `005_rota.sql`:

```text
supabase/migrations/006_hourcalc.sql
```

La migración crea `tes_special_days`. No se fijan en el código fechas o importes del convenio: los días festivos y aatto se guardan como datos para que la app se pueda mantener cuando cambien reglas o fechas.

Ejemplo de fila de día especial (solo ejemplo; usa la regla oficial que corresponda):

```sql
insert into public.tes_special_days(date,kind,label,premium_start,premium_end)
values ('2026-12-25','holiday','Christmas Day','00:00','00:00')
on conflict do nothing;
```

## Despliegue

```bash
npm install
npm run build
```

Vercel: Framework Vite, Build Command `npm run build`, Output Directory `dist`.

## Siguiente fase

**Phase 7:** Payroll 21–20, tarifas por empleado, compensaciones TES y selector de periodos históricos/futuros.
