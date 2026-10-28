# Primera entrega: guardado seguro de movimientos

Alcance: ingresos, ediciones (incluye reabrir), salidas y eliminaciones con recibo persistente y recuperación automática. Los demás módulos conservan respaldo local y requieren revisión si la respuesta es incierta. No se presenta esta entrega como Local First completo para todo el sistema.

## Secuencia de publicación

1. Ejecutar las pruebas y `node scripts/prepare-release.cjs`. El paquete queda fuera del sitio público, en `../outputs/release-movimientos`, con hashes de los dos archivos.
2. Comparar los módulos actuales de producción con los respaldos. Si cambiaron, integrar los cambios antes de reemplazar contenido. Conservar copia de ambos módulos y anotar versión activa del despliegue.
3. Reemplazar únicamente T28_Movimientos.gs y T28_API.gs por el paquete. No copiar el gateway, funciones de pruebas, Auth o Codigo desde la copia aislada. El módulo de movimientos ya incluye los recibos: no añadirlos de nuevo como archivos separados.
4. Crear una nueva versión en la implementación de producción existente; mantener identidad, permisos y URL. Los clientes actuales continúan usando RPC compatible.
5. Verificar sesión y capacidades de esa URL, luego activar las ocho banderas sync/autoSync de movimientos en config.js. Publicar el frontend en Vercel. Hasta verificar el backend, las banderas permanecen false.
6. Comprobar inicio de sesión, lectura, formulario, pendientes y recuperación. No borrar datos reales para probar. Revisar permisos con las cuentas correspondientes.

## Reversión

Desactivar primero las banderas automáticas del frontend y publicar. Conservar/exportar los pendientes, sin borrar IndexedDB ni las hojas de recibos. Restaurar después la versión anterior de Apps Script registrada en el paso 2 (la observada inicialmente fue 392). No reintentar operaciones inciertas a través del RPC antiguo. Restaurar el frontend anterior si fuera necesario.

## Límites de esta entrega

AppSheet no comparte el bloqueo de Apps Script: una escritura externa entre la última comprobación y la escritura todavía puede competir. Un recibo PREPARADO ambiguo de edición/salida/eliminación exige revisión. El orden del worker no sustituye una cola común de todos los envíos iniciales. Estas restricciones deben permanecer visibles en el registro de entrega.

## Ejecución real — 27 de octubre de 2026

Backend publicado en la implementación habitual como versión 393 (anterior 392). Misma URL, ejecutor y acceso. Se respaldaron los dos módulos actuales en outputs/release-movimientos fuera del repositorio; movimientos coincidió con el respaldo previo y la API solo difirió por las rutas de sincronización añadidas. El paquete no contiene el gateway de pruebas. Evidencia: backend-produccion-version-393.png.
Frontend aún no publicado ni banderas activadas. El sitio real abre correctamente el formulario de acceso; no hay sesión vigente en este navegador. Falta inicio de sesión del usuario para comprobar lecturas y continuar con la activación del frontend. No se realizaron escrituras de datos reales.

Frontend publicado mediante commit 30e6272 en main; Vercel sirve api-client?v=152, local-store?v=2 y sync-worker?v=2. Las ocho banderas de movimientos están activadas. Sesión restaurada tras recarga, Inicio y Movimientos Hoy muestran 77 registros (55 abiertos y 22 finalizados), 12 empresas y 103 puestos. No se observaron errores o advertencias en consola durante la comprobación. No se hicieron escrituras reales para esta verificación. Evidencia: outputs/release-movimientos/frontend-produccion-verificado.png fuera del repositorio. Las 73 pruebas locales pasan. Revertir backend a 392 y frontend a 8998f60 solo siguiendo la secuencia de conservación de pendientes indicada arriba.
