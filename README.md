# STL SAVILLS — V1 GRAN VERSIÓN

Primera gran versión funcional de la demo web STL SAVILLS, construida sobre el proyecto desplegado existente.

## Incluido en V1

- 30 centros reales iniciales (26 España + 4 Portugal).
- Catálogo real: 84 elementos España + 139 Portugal.
- Ficha de centro como pantalla principal de trabajo.
- Código y número separados.
- Edición de datos del centro.
- Logo e imagen del centro en la ficha (modo demo local mediante almacenamiento del navegador).
- Elementos activos / no activos sin perder histórico.
- Alta/activación de nuevas unidades.
- Revisiones S1 / S2 por año con histórico.
- Estados: APTO, APTO CONDICIONADO, NO APTO, PENDIENTE y SIN INFORMACIÓN.
- Puntuación: 3 / 2 / 1 / 0 / 0.
- Confirmación individual de elementos por Administrador.
- Bloqueo de elementos confirmados.
- Cierre de revisión únicamente cuando todos los elementos activos están confirmados.
- Contador de elementos pendientes.
- Certificado resumen por centro y revisión.
- Vista imprimible preparada para «Imprimir → Guardar como PDF».
- Participantes y firmas en el certificado.
- Plan de inspecciones resumen + matriz completa.
- STL España / Portugal integrado con instalaciones reguladas.
- Sistema de alertas y notificaciones en modo demo.
- Reglas de alerta preparadas para persistencia.
- Administración con ADMIN / GESTOR / LECTURA.
- Auditoría preparada en Prisma.
- Modelo Prisma ampliado para PostgreSQL/Supabase.
- Seed preparado con los datos reales del catálogo y centros.

## Importante sobre esta V1

La interfaz sigue funcionando sin conexión a base de datos, utilizando `data/demo-data.json` y `localStorage` para poder probar el flujo inmediatamente.

La persistencia real, autenticación SSO, Supabase Storage, email Resend y ejecución automática de alertas requieren configurar el entorno productivo.

## Arranque

```bash
npm install
npm run dev
```

## Prisma

Si existe `DATABASE_URL`:

```bash
npx prisma format
npx prisma generate
npx prisma migrate dev --name v1_foundation
npm run db:seed
```

Para Vercel:

```text
Build Command:
prisma generate && next build
```

El proyecto mantiene `postinstall: prisma generate`.

## Flujo recomendado de prueba

1. Entrar en `/centers`.
2. Pulsar cualquier punto de una fila.
3. Entrar en la ficha.
4. Cambiar el rol de la cabecera a GESTOR.
5. Editar estados, fechas, empresa y observaciones.
6. Desactivar alguna unidad y comprobar «Elementos no activos».
7. Cambiar a ADMINISTRADOR.
8. Confirmar todos los elementos.
9. Confirmar la revisión S1/S2.
10. Abrir «Ver / exportar certificado».
11. Utilizar «Imprimir / guardar PDF».
12. Revisar `/inspections`.
13. Revisar `/alerts`.
14. Revisar `/settings`.

## Siguiente fase:

La siguiente fase debe conectar esta V1 con PostgreSQL/Supabase, autenticación corporativa, Storage, Resend y un proceso programado para generar las alertas de 90/60/30 días, vencimiento y post-vencimiento.

prueba conexion Github Vercel
