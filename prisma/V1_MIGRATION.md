# V1 migration

Esta versión amplía el modelo para soportar centros resueltos, elementos por centro, revisiones S1/S2, confirmaciones, certificados, participantes, reglas y alertas.

Antes de desplegar con una base de datos existente:

1. `npx prisma format`
2. `npx prisma validate`
3. `npx prisma generate`
4. En desarrollo con la base actual: `npx prisma migrate dev --name v1_foundation`
5. Ejecutar el seed cuando se quiera cargar/sincronizar los datos reales: `npm run db:seed`

No ejecutar `prisma db push --force-reset` contra una base de datos con datos reales.
