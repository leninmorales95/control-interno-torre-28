# Estado real de la mejora de guardado

Estado al 27 de octubre de 2026: **primera entrega de movimientos publicada**. Producción usa Apps Script versión 393 y frontend 30e6272, con respaldo y recuperación automática activados para crear, editar, registrar salida y eliminar movimientos. La copia aislada está en versión 5; las cuatro rutas se comprobaron allí por HTTP real con respuesta perdida. En producción se verificó sesión, recarga y lectura de 77 movimientos, 12 empresas y 103 estacionamientos, sin escribir registros reales. La arquitectura Local First completa para todos los módulos sigue pendiente. Los apartados de continuación conservan el historial de avances y limitaciones.

Las 73 pruebas locales pasan. La última protección comprueba que el recibo de edición, salida o eliminación confirme el ID exacto del movimiento antes de retirar su respaldo. Un recibo inconsistente permanece para revisión y no se reintenta automáticamente.

## Diagnóstico

La web estática sirve desde Vercel y usa `api-client.js` y `gas-compat.js` para llamar a Apps Script. El repositorio partió de `8998f60`. La API real incluye rutas, permisos y un router de Telegram que faltan en `T28_API_NETLIFY.gs`; no debe reemplazarse con ese archivo antiguo.

Las lecturas tienen cachés visuales en IndexedDB y localStorage; los intentos fallidos de ingreso se guardaban solo en sessionStorage. El guardado optimista mostraba éxito antes de recibir confirmación. Los movimientos tienen ID, pero las mutaciones dependían de números de fila. No se observó registro duradero de operaciones procesadas ni una versión de cada registro. AppSheet comparte la hoja; sus cambios no se pueden detectar solo con activadores de Apps Script.

En `actualizarMovimientoWeb`, el servidor modificaba celdas antes de validar las fechas. Una hora inválida podía dejar un movimiento parcialmente editado.

## Cambios implementados localmente

- Base IndexedDB independiente `Torre28PendingWrites`, con almacenes `operations` y `drafts`.
- Cada RPC de escritura de los módulos operativos se conserva antes del envío. Se espera la finalización de la transacción local. Si falla, no se envía la escritura.
- Los formularios de ingreso se conservan antes de consultar disponibilidad; se pueden recuperar tras recargar o cerrar el navegador.
- Los registros se separan por usuario y endpoint. No se guardan tokens ni PIN administrativos en esta base. Los respaldos sí contienen los datos necesarios del formulario, incluidos los documentos o imágenes proporcionados; se mantienen en el dispositivo.
- Confirmaciones visuales después de la respuesta remota. Los errores conservan sus datos y distinguen una respuesta incierta de un rechazo identificado.
- Panel discreto de pendientes, revisión manual y descarga del respaldo.
- `BroadcastChannel` actualiza los indicadores de otras pestañas. No envía escrituras.
- Las lecturas concurrentes idénticas comparten la petición; una lectura posterior vuelve al servidor. Las escrituras nunca se agrupan ni se reenvían de manera implícita.
- Tiempo límite de 30 segundos por petición, refresco de movimientos cada 30 segundos y al recuperar conexión. Continúa suspendido con pestaña oculta o un formulario operativo abierto, según las reglas existentes del panel.
- Etiqueta de alojamiento obtenida de la configuración (Vercel).

## Candidato Apps Script

`BACKEND_APPS_SCRIPT_NUEVO/T28_Movimientos.gs` es el módulo completo construido a partir del archivo real leído del editor. Reemplaza únicamente el contenido de `T28_Movimientos.gs`, después de comparar que el editor no haya cambiado desde el respaldo.

`T28_Movimientos_Seguridad.patch.txt` contiene el fragmento usado en las pruebas y como referencia. **No se debe subir como otro archivo `.gs`**: duplicaría funciones.

El candidato valida fechas y acompañantes antes de escribir, resuelve el movimiento por ID si cambió de fila, preserva fórmulas ajenas al formulario y actualiza una fila en una sola operación `setValues`. Agrega bloqueo entre escrituras web y una huella `_version` al resultado de lectura; el cliente envía `_expectedVersion` para detectar cambios posteriores. Las salidas y eliminaciones también comprueban la versión cuando está disponible. Los clientes antiguos conservan su compatibilidad, pero sin versión no pueden detectar una edición previa a abrir el formulario.

**Límite de concurrencia:** AppSheet no participa en `LockService`. Se comprueba de nuevo la huella inmediatamente antes de escribir, pero una escritura simultánea de AppSheet en el intervalo restante todavía es posible. Google Sheets no ofrece comparación y escritura atómicas entre ambos clientes. Estas pruebas no demuestran ausencia de pérdidas para todos los casos multiusuario.

## Pruebas realizadas

Ejecutar `node --test tests/*.test.cjs` tras instalar las dependencias del lockfile. Se usa `fake-indexeddb` para comprobar transacciones y persistencia simulada y un doble de SpreadsheetApp para las reglas del servidor.

Se comprobaron: confirmación remota, respuesta perdida tras una posible escritura, caída de red antes del envío, fallo del almacenamiento local, conflicto, rechazo anidado del RPC, separación entre cuentas/endpoints, recarga, dos pestañas, lectura concurrente, exclusión de credenciales, fechas inválidas sin escritura parcial, movimiento desplazado, ID eliminado y bloqueo ocupado. La prueba de navegador con datos ficticios confirmó el inicio, error de ingreso, panel de pendientes y recuperación completa después de recargar, sin errores en consola.

La captura está en `outputs/sync-qa/recuperacion-local.jpg` en el directorio padre del checkout. El servidor `node scripts/preview-test.cjs` sirve en `http://127.0.0.1:4173`, usa datos ficticios y no reenvía peticiones a Google. No debe publicarse como backend.

Las duraciones de las pruebas locales no representan el rendimiento de dispositivos reales. No se ha medido todavía el objetivo de menos de 200 ms en los equipos del usuario ni el guardado real de Apps Script. No se ejecutaron pruebas con datos reales o AppSheet.

## Publicación y reversión

1. Conservar el archivo original de Apps Script y el commit anterior del frontend. El original leído está en `outputs/sync-qa/T28_Movimientos.antes.gs.txt` en el directorio padre del checkout.
2. Revisar en el editor que `T28_Movimientos.gs` siga coincidiendo con el respaldo. Aplicar solo el módulo candidato completo y guardarlo. No reemplazar la API o los demás archivos con referencias antiguas del repositorio.
3. Verificar primero en una implementación de prueba y datos aislados. La simulación local no sustituye una prueba de integración real. Se puede crear la copia necesaria; el usuario no necesita suministrar una preexistente.
4. La implementación que coincide con el endpoint configurado usa la **versión 392**. Para activar un cambio, seleccionar una versión nueva en esa misma implementación, manteniendo sus permisos actuales. Guardar el editor por sí solo no cambia `/exec`.
5. Publicar los archivos del frontend en Vercel después de la verificación. El frontend también puede funcionar con el servidor anterior, pero en ese caso la protección `_version` aún no se aplica.
6. Para revertir, volver la implementación de Apps Script a la versión 392 y volver el frontend a `8998f60` con el flujo normal de Vercel. No borrar IndexedDB: los respaldos pendientes deben seguir disponibles y exportarse antes de retirar la interfaz nueva.

## Trabajo pendiente para la especificación completa

- Extender recibos duraderos a los demás módulos. Movimientos ya dispone de recibos; los casos ambiguos PREPARADO en edición, salida y eliminación requieren revisión conservadora.
- Completar una cola común para los envíos iniciales, las dependencias y todos los módulos. El worker de movimientos ya tiene exclusión entre pestañas, espera progresiva y bloqueo por movimiento mientras un intento anterior siga sin confirmar; los envíos iniciales todavía no comparten esa cola.
- Adaptadores por tabla, IDs estables donde falten y resolución de conflictos para avisos, contactos, suministros, empresas y demás módulos.
- Recuperación directa de formularios distintos de ingreso. Por ahora se conservan y se pueden descargar desde el panel.
- Protocolo compartido con AppSheet para evitar la ventana de escritura concurrente; verificar claves, fórmulas, tipos y automatizaciones en el entorno real antes de cualquier cambio estructural.
- Ampliar pruebas de integración a formularios restantes y roles reales; medir rendimiento en los dispositivos del usuario. Las cuatro rutas de movimientos ya pasaron pruebas HTTP aisladas; los permisos se verificaron localmente.

El acceso de navegador se recuperó. Se comprobó que el módulo original seguía coincidiendo con el respaldo y se creó una copia del proyecto: https://script.google.com/home/projects/1pi3KFCgkDvEWIl5PlPHCFFPPAT-bDOGtJypPNyBJZEuf-pRSgbto0jZr/edit . También se creó una copia del documento: https://docs.google.com/spreadsheets/d/1umHzP2JlzJfoRdSQOah7lHSPQJWQesXT-U4m8y3VJGM/edit . No se seleccionó compartir con las mismas personas ni copiar comentarios.

Se detectó que copiar el proyecto de Apps Script por sí solo conserva el contenedor original. Por eso, el módulo de movimientos instalado en el proyecto de prueba tiene todas sus llamadas a `getActiveSpreadsheet()` reemplazadas por `openById()` con el ID del documento de prueba. Incluye el candidato de movimientos, el módulo de recibos y la función `probarSyncMovimientosAisladoT28`. Se recargó el editor y se comprobó que el contenido guardado coincide exactamente con el código preparado. Los demás módulos de la copia todavía pueden referenciar la hoja original o servicios externos: **no ejecutar funciones ajenas a la prueba aislada**.

`T28_Sync.gs` prepara recibos duraderos para creación de movimientos en una hoja separada `_T28_SYNC_OPERACIONES`. Todavía no se conectó a la API ni a la cola del navegador. Confirma un reintento por ID y hash, recupera la escritura con respuesta perdida y rechaza el caso ambiguo en vez de repetirlo. Conserva confirmaciones después de una eliminación posterior. Sus seis pruebas nuevas pasan, para un total de 27 pruebas locales. No es aún la solución para ediciones, eliminaciones u otros módulos.

No se ejecutaron funciones ni se implementó la copia. El selector de funciones no respondió a los controles y la captura de pantalla de Apps Script agotó su tiempo de respuesta. La prueba de integración real sigue pendiente. El proyecto original y el frontend publicado siguen sin modificaciones.
# Continuación: comprobación local

## Edición desde formulario: confirmada, recarga pendiente

El endpoint aislado se actualizó a versión 4 (26 oct 2026 02:00), misma URL
y acceso; gateway permite sync.movimientos.editar con sesión y permiso editar.
El arnés /panel activa syncEdiciones y transmite esa ruta a Google.
Se creó QA989 / PRUEBA FORM EDICION y desde su detalle se editó observaciones
a «Edición desde formulario verificada contra Google». El formulario mostró
«Cambios guardados en este equipo. Confirmando…», seguido de «Movimiento
actualizado correctamente» tras respuesta de Google. No se modificó producción.

En la continuación el navegador indicó acceso desactivado antes de poder
recargar. Por tanto la persistencia de estas observaciones tras recarga y la
recuperación automática HTTP de edición todavía NO están verificadas.
Evidencia del despliegue: outputs/sync-qa/staging-version-4-ediciones.png.

## Resultado de edición en Google recuperado el 26 de octubre

El historial de ejecución confirma que probarEdicionSyncAisladaT28 terminó
Completada el 22 oct 2026 11:12:04, duración 13.144s. Log ok:true,
replay:true, staleVersionRejected:true. Pasó edición aplicada, reintento
conserva cambio posterior y versión anterior rechazada. Registro
bacef183-6230-4bbf-ace9-33629d6b36c6; operación
2b9856a7-b44b-4f28-b5b9-ee74fccf1cca. Evidencia:
outputs/sync-qa/edicion-google-verificada.png en workspace padre.

Se preparó en disco la autorización de sync.movimientos.editar en el gateway
de staging. Todavía falta actualizar ese gateway en Google, publicar nueva
versión de staging y ensayar formulario/worker por HTTP. El endpoint sigue
versión 3, sin edición habilitada. Producción permanece intacta.

## Ediciones conectadas en candidatos cliente/API/worker

Se añadió sync.movimientos.editar con permiso editar en API candidata y
capacidad movimientos.editar. RPC actualizarMovimientoWeb usa recibos solo con
syncEdiciones:true. Reintento específico conserva UUID/payload/versión y no
acepta ser llamado como salida. Borrador asociado se elimina atómicamente al
confirmar; recuperar formulario pendiente reusa la edición original.
El panel local de pendientes soporta edición segura. Worker usa un mapa
explícito por tipo y requiere autoSyncEdiciones:true y capacidad coincidente;
legacy y tipos desconocidos quedan fuera. Se mantiene el bloqueo entre pestañas.

Configuración productiva: syncEdiciones:false y autoSyncEdiciones:false.
61 pruebas aprobadas, incluida ruta con permisos, borrador tras recarga y
activación independiente del worker. No se actualizó Google ni staging para
ediciones todavía; siguen pendientes su ensayo real y demás módulos.

## Ediciones con recibos: candidato local

El motor de recibos de salidas admite ahora un adaptador privado de edición,
t28SyncEditarMovimiento_, con metadatos separados en _T28_SYNC_EDICIONES.
Exige actor, UUID, ID estable y versión esperada; limita campos enviados y
valida campos obligatorios, fechas y acompañantes antes de preparar recibos.
La edición interna se separó del bloqueo exterior para evitar locks anidados.
Los recibos confirmados no vuelven a editar registros que cambiaron después;
un intento preparado ambiguo exige revisión en vez de reaplicar la mutación.
El hash del protocolo de salidas conserva su formato anterior, para no romper
recibos ya existentes en la copia. No se cambió schema de MOVIMIENTOS.

58 pruebas locales pasan, incluidas edición repetida, cambio remoto, payload
alterado y caída tras modificar. No está conectado a ruta HTTP/UI/worker ni
desplegado en Google. Siguen pendientes esos ensayos y los demás módulos.

## Salida automática HTTP real aprobada

Desde el arnés autenticado se creó QA991 / PRUEBA SALIDA AUTOMATICA solo en
staging. Se leyó su _version desde Google, envió salida y descartó a propósito
la primera respuesta exitosa. Sin reintento manual, el worker real con
autoSyncSalidas:true recibió replay:true del recibo original y retiró pendiente.
Una lectura real posterior confirmó Cerrado y salida 22/10/2026 10:34:38.
Operación a534ed7a-8848-4dbb-9ba2-1198411f953d;
registro dd77dcfd-096f-4fd9-b376-dc39b901ec6a.
Evidencia outputs/sync-qa/salida-automatica-google-confirmada.png.
El arnés apaga autoSyncSalidas al terminar. Producción sigue desactivada.
Quedan ediciones y restantes módulos del alcance original.

## Botón real de salida y recarga aprobados

Se retomó la sesión de staging y el registro QA992 / PRUEBA BOTON SALIDA.
Desde Movimientos Hoy se abrió Salida, se guardó 22/10/2026 10:19 y se
observó «1 guardado por confirmar», seguido de «Salida confirmada» y retirada
del pendiente. La lectura real de Google devolvió hora formateada y Con salida.
Tras recarga completa, el dashboard y Movimientos mantuvieron 0 abiertos y
2 finalizados; QA992 conserva su salida 10:19. Solo se modificó la copia.
Evidencia outputs/sync-qa/boton-salida-recarga-confirmada.png en workspace padre.
Siguen 54 pruebas locales aprobadas. Falta ensayo HTTP de respuesta perdida
de salida y su worker automático, además de ediciones y otros módulos.

## Salidas en Google y staging versión 3

Se instaló en la copia el módulo de movimientos actual, recibos de ingresos,
recibos de salidas y ensayos, reemplazando todas sus referencias a hoja activa
por el ID fijo de la hoja duplicada. API copiada contiene la ruta salida con
permiso editar y gateway restringido actualizado. Se ejecutó
probarSalidaSyncAisladaT28: Google devolvió ok:true, replay:true,
staleVersionRejected:true y ejecución completada. Registro sintético:
271f5047-46ef-4756-9c16-f5aca85cfabf; operación:
f3d10f51-8758-42c7-8845-3b34cdb25dbb. Evidencia salida-google-correcta.png.

Se actualizó el mismo endpoint de staging a versión 3 el 22 oct 2026 09:31,
sin modificar acceso, identidad de ejecución ni producción. El arnés del
panel habilita syncSalidas:true y deja pasar esa petición a Google.
Evidencia staging-version-3-salidas.png en outputs/sync-qa del workspace padre.
Se abrió /panel pero la sesión del día anterior terminó: requiere que el
usuario entre de nuevo para probar el botón real de salida y su recarga.
54 pruebas locales aprobadas. Las opciones productivas siguen desactivadas.

## Salidas conectadas en candidatos API/cliente

API candidata incluye sync.movimientos.salida con permiso editar y capacidad
movimientos.salida. T28Api enruta el RPC existente de salida solo cuando
syncSalidas:true; verifica recibos coincidentes y conserva el mismo payload/UUID
en reintentarSalidaSegura. No permite reintentar una salida como creación.
Panel de pendientes ofrece reintento específico. Worker admite salidas solo
con autoSyncSalidas:true y capacidad anunciada; cada tipo conserva activación
independiente. Las cuatro opciones productivas permanecen false.

54 pruebas aprobadas. Todavía no se instaló T28_Sync_Salidas en Google ni se
actualizó gateway/despliegue de staging para esta ruta; no activarla antes.
Los candidatos no equivalen a una salida probada en Google. Continúa pendiente
ese ensayo de integración y luego las ediciones y demás módulos.

## Salidas con recibos: candidato local

T28_Sync_Salidas.gs implementa recibos propios en _T28_SYNC_SALIDAS, con UUID,
actor autenticado, ID estable y versión esperada obligatorios. Valida fecha,
cronología, estructura y versión antes de preparar recibo. Se separó el helper
interno de salida del bloqueo exterior para que recibo y modificación usen el
mismo bloqueo de Apps Script (sin bloqueos anidados).

Un recibo CONFIRMADO responde al reintento sin mutar la fila ni exigir que
esta siga en su versión antigua. Un PREPARADO tras interrupción es ambiguo:
devuelve CONFLICT y exige revisión; no infiere éxito del estado actual que
otra persona o AppSheet pudo cambiar. La limitación de concurrencia con
AppSheet permanece: LockService no coordina sus escrituras externas.

52 pruebas locales aprobadas. Este nuevo módulo no está desplegado, no se
anunció como capacidad y aún no está conectado a API/UI/worker. No confundir
el candidato con una función de salidas publicada o probada en Google.

## Worker automático verificado contra Google

En google-sync-login.html se incorporó el worker real y la opción de ensayo
automático. El primer envío creó el registro en la copia y el arnés descartó
su respuesta exitosa. Sin invocar manualmente reintentarMovimientoSeguro,
el worker recuperó la operación conservada y recibió replay:true de Google.
Se retiró el pendiente tras el recibo correcto. Resultado observado en UI:
«CORRECTO: Google confirmó el reintento automático del mismo ingreso».
Operación 47d8c52b-6755-4990-be78-c369787393ed;
registro 59ade55b-6ca4-4b3d-8073-0431afabc751.
Evidencia outputs/sync-qa/reintento-automatico-google.png en workspace padre.
El arnés vuelve a desactivar autoSyncMovimientos al terminar. Configuración
productiva sigue false. Esto valida creaciones de movimientos, no los demás
tipos de mutaciones pendientes del alcance original.

## Reintentos automáticos candidatos

js/sync-worker.js revisa cada 30 segundos, al recuperar conexión y al volver
a la pestaña. Requiere autoSyncMovimientos:true, sesión y protocolo 1 compatible.
Solo reintenta sync.movimientos.crear; nunca RPC legado. claimRetry usa una
transacción IndexedDB para reservar la operación 60 segundos entre pestañas;
evita intentos en curso recientes y aplica espera exponencial hasta 5 minutos.
Conflictos, recibos inválidos, errores de autorización y operaciones revisadas
no se reintentan automáticamente. Se conserva la operación hasta confirmación.

Configuración productiva: syncMovimientos:false y autoSyncMovimientos:false.
El worker está cargado pero inactivo. Falta activar y ensayar el worker en
el navegador contra staging; no confundir pruebas unitarias con ese ensayo.
Suite vigente: 47 pruebas aprobadas, incluyendo competencia de pestañas,
espera, cuenta distinta, suspensión sin red y sesión vencida.

## Lectura real y recarga del panel verificadas

Tras inicio de sesión del usuario el 21 de octubre, se creó desde el formulario
PRUEBA RECARGA GOOGLE, placa QA994, 09:21, solo en la hoja duplicada. Se observó
pendiente local, confirmación de Google y sustitución por la fila leída con
hora formateada de Sheets. Se recargó por completo /panel: el dashboard ya
mostraba un movimiento antes de entrar a Movimientos; allí apareció la misma
fila. stagingRealPull está activo, sin respuestas de memoria para esa consulta.
Los registros de pruebas del día 20 no aparecen en Movimientos Hoy del 21.
Evidencia: outputs/sync-qa/recarga-google-verificada.png en workspace padre.
Suite local: 41 aprobadas. Producción no modificada. Continúan pendientes
la automatización de reintentos y demás escrituras del alcance original.

## Staging versión 2 publicada

Se actualizó exclusivamente el gateway del proyecto copiado para permitir
inicio.movimientosHoy (mantiene autenticación e ID fijo de hoja duplicada).
Se actualizó su despliegue existente a versión 2, confirmado por Google el
21 de octubre de 2026 a las 09:15 America/Lima. Misma URL de staging;
sin cambios en acceso, identidad de ejecución ni producción.
El arnés /panel activa stagingRealPull:true y ya no devuelve memoria para
movimientos: solicita Google. Al abrir, solicita iniciar sesión de nuevo;
no se leyeron ni inventaron credenciales. Pendiente de entrada del usuario
para comprobar lectura y recarga. Evidencia: outputs/sync-qa/staging-version-2.png.

## Preparación de pull real (21 de octubre)

Se preparó en disco el permiso de ruta inicio.movimientosHoy en gateway de
staging y un opt-in stagingRealPull en el arnés del panel. Todavía no está
activado ni actualizado el despliegue: por defecto continúa la lista simulada.
Nueva prueba asegura que al activar el opt-in la consulta viaja a Google con
la sesión, en lugar de devolver la memoria del arnés. Total: 41 pruebas pasan.
Se recuperó la pestaña del proyecto copiado; sigue pendiente actualizar su
gateway, desplegar y verificar recarga con datos de hoy (los de ayer no deben
aparecer en Movimientos Hoy). Producción no se modificó.

## Panel completo conectado a Google de pruebas

google-login-preview.cjs sirve /panel con index.html real, sustituyendo solo
config.js por tests/panel-google-config.js. Autenticación y escritura con recibos
van al endpoint de Google de staging; consultas/catálogos y lista de movimientos
son ficticios o memoria local del arnés (no constituyen prueba de lectura real).
Las demás mutaciones están bloqueadas. No se cambió configuración productiva.

Se restauró la sesión real de pruebas, abrió el formulario del panel y envió
PRUEBA PANEL GOOGLE, placa QA995, puesto ficticio 18. Se observó el estado local
«1 guardado por confirmar», seguido de «Ingreso confirmado en Google Sheets» y
desaparición del indicador pendiente tras recibo exitoso. La lista de la vista
se alimentó del recibo real, no de una lectura de Sheets. Falta aún verificar
pull real/recarga y automatización del alcance restante antes de publicación.
Evidencia: outputs/sync-qa/panel-google-confirmado.png en workspace padre.

## Ensayo visual del formulario completo

Se amplió preview-test.cjs con recibos ficticios y puerto configurable. En
127.0.0.1:4176 se inició sesión sintética, abrió Movimientos, completó el
formulario real (PRUEBA FORMULARIO, QA996, EMPRESA DEMO, puesto 18) y guardó.
El modal cerró, apareció la fila optimista y se mostró confirmación al recibir
el recibo simulado. No hubo envío a Google en este ensayo del panel; no debe
confundirse su mensaje visual «Google Sheets» con una confirmación real.
La prueba HTTP real anterior sí verificó Google con una página de ensayo
separada. Falta todavía unir panel completo y endpoint real en un entorno
de staging, además de implementar el alcance Local First restante.
Evidencia: outputs/sync-qa/formulario-panel-prueba.png en workspace padre.

## Prueba HTTP autenticada contra Google: aprobada

El usuario inició sesión directamente en tests/google-sync-login.html, servida
en loopback 4175; el PIN no se leyó ni se registró. Se verificaron auth.login,
auth.validar y sync.capabilities contra el endpoint real de staging.

Después, el cliente real envió un ingreso sintético PRUEBA HTTP AISLADA a la
hoja duplicada. El arnés descartó deliberadamente una respuesta exitosa de
Google para simular una confirmación perdida; el pendiente quedó conservado.
El reintento recibió replay:true con el mismo UUID, y retiró el pendiente.
Operación: 3f55b9f2-de4c-475d-9782-495460c8f108.
Registro: 940d5942-0f6b-4050-a4b0-ba66bdebbd7f.
Evidencia: outputs/sync-qa/http-google-reintento-correcto.png en workspace padre.

Esto verifica transporte real, sesión, helper de recibos y cliente; no prueba
todavía todos los formularios del dashboard ni sincronización automática de
otros módulos. Configuración productiva sigue desactivada y no se publicó allí.

## Endpoint de prueba publicado con autorización

Tras confirmación explícita del usuario, se creó versión 1 de la copia el
20 de octubre de 2026, ejecutada como propietario y acceso Cualquiera,
con las restricciones de staging indicadas abajo. URL verificada por navegador:
https://script.google.com/macros/s/AKfycbw-PhXN9lp5QaqsirmvM-wf4AkU0P_C0-VzQlNkkPDh5mx0AITNvzoS1CuyQLRlbFXhZg/exec

GET muestra «Torre 28: API de pruebas aislada. No es el sistema de producción.»
No se cambió config.js ni el despliegue productivo. Pendiente: inicio de sesión
desde cliente de pruebas y comprobación HTTP autenticada; publicar el endpoint
no equivale a completar ese ensayo. Evidencia en workspace padre:
outputs/sync-qa/api-prueba-publicada.png.

## Preparación del endpoint de pruebas: autorización pendiente

Solo en el proyecto copiado: T28_Auth cambió todas sus referencias a hoja activa
por openById de la hoja duplicada; lectura y escritura de usuarios/sesiones ya
no usan la hoja original. Codigo conservó su contenido pero su doGet heredado
se renombró a privado t28LegacyDoGetDisabled_. El doGet de staging devuelve
texto plano, nunca HtmlService ni plantillas con google.script.run.

La copia de T28_API incorpora scripts/T28_Staging_Gateway.gs.txt: doPost aplica
una lista de solo auth.login/validar/logout, sync.capabilities y
sync.movimientos.crear antes de cualquier router Telegram/RPC. El resto se
rechaza. Esta restricción es solo staging, nunca instalarla en producción.
Pruebas de esa lista pasan; suite total: 40 aprobadas.

Se abrió Nueva implementación y se preparó descripción de prueba. Google
propone ejecutar como propietario con acceso Cualquiera. NO se pulsó Implementar:
crear una nueva URL accesible por Internet bajo esa cuenta requiere confirmación
del usuario en ese momento. La API exigiría usuario/PIN y sesiones de la copia;
el enlace no reemplaza el endpoint productivo. Pendiente de esa autorización.

## Adaptador de la API verificado en Google

Se instaló el candidato T28_API_Actual en la copia del proyecto, reemplazando
sus referencias a hoja activa por el ID de la hoja duplicada. Se actualizó el
módulo aislado de movimientos con el ensayo `probarRutaSyncAisladaT28`.
Google devolvió `ok:true` y ejecución completada para cinco comprobaciones:
sin permiso no inserta, autorizado inserta una vez, recibo coincide con UUID,
reintento devuelve el mismo registro y otra cuenta no reutiliza la operación.
Registro sintético creado solo en la copia:
`31f170be-4a33-4037-a8b6-5ccf26797a48`.

Este ensayo invoca el adaptador privado t28ApiSync_ con actores sintéticos;
no modifica validarSesionT28 ni inventa credenciales. No equivale a una prueba
HTTP con inicio de sesión desde la web. La copia no se debe desplegar en público:
otros módulos heredados todavía pueden usar la hoja original y servicios reales.
Producción continúa intacta. Evidencia: outputs/sync-qa/ruta-google-correcta.png
en el workspace padre. Las 38 pruebas locales siguen aprobadas.

## Formulario conectado detrás de una activación explícita

El RPC existente `registrarMovimientoWeb` cambia a la ruta de recibos solo si
`syncMovimientos === true`. Configuración de producción mantiene `false`;
la página aislada de QA usa `true`. No hay fallback a append antiguo.

El formulario conserva el ID de su borrador dentro de la operación local.
Recuperarlo con un intento seguro pendiente reintenta el mismo UUID en lugar
de abrir un nuevo append. Si ese intento fue marcado como revisado, se bloquea
la recreación desde ese respaldo. Al confirmar, una transacción IndexedDB
elimina juntos operación y borrador asociado, respetando su dueño y servidor
capturados incluso si entretanto se cambió de cuenta. El panel de pendientes
ofrece «Reintentar sin duplicar» solo para operaciones del protocolo nuevo.

Suite vigente: 38 pruebas aprobadas. Activación y despliegue real pendientes;
no están implementados todavía los reintentos automáticos de todas las demás
escrituras del sistema. No publicar como solución Local First completa.

## Ensayo del transporte en navegador real

Se ejecutó `scripts/sync-preview.cjs` en loopback 127.0.0.1:4174 y se abrió
`tests/sync-browser.html` en el navegador integrado. Usa local-store.js y
api-client.js reales, API candidata y helper de recibos reales; sesiones,
adaptador Sheets, bloqueo y función de inserción son simulados en memoria.
No llama a Google ni sustituye una prueba HTTP contra su despliegue.

Secuencia verificada visualmente:
1. Primer envío insertó un movimiento; el servidor cortó deliberadamente
   el socket antes de entregar la respuesta.
2. IndexedDB mantuvo el pendiente incierto, incluido su UUID.
3. Tras recargar la página persistió el mismo UUID sin otro envío.
4. Reintento: dos solicitudes totales, una sola inserción, un solo registro,
   cero pendientes después de recibir el recibo coincidente.

Evidencia guardada en el workspace padre:
`outputs/sync-qa/recuperacion-navegador-correcta.png`.
Los formularios de producción siguen sin activar esta ruta y no se publicó.

## Conexión segura candidata (aún no activada en la UI)

Se exportó el módulo API vigente de la copia a `T28_API_Actual.gs`, conservando
router Telegram, administración de sesiones y permisos. Se añadieron rutas
`sync.capabilities` y `sync.movimientos.crear` detrás de sesión válida; crear
exige además permiso `crear`. El usuario de la operación proviene de la sesión,
no de los campos enviados por el cliente. Este candidato está solo en disco.

El cliente dispone de `crearMovimientoSeguro` y `reintentarMovimientoSeguro`:
el identificador persistido se envía al servidor y se conserva al reintentar;
una confirmación sin ID coincidente nunca elimina el pendiente. No hay fallback
a la ruta antigua ni acceso a operaciones de otra cuenta. Un cambio de sesión
durante el compromiso local impide el envío. Los formularios existentes todavía
usan su camino anterior; no se habilitó repetición automática de operaciones.

Suite conjunta vigente: 35 pruebas aprobadas, incluidos permisos, sesión,
respuesta perdida, recibo incorrecto y aislamiento entre cuentas. Sigue pendiente
la prueba HTTP de la API candidata en un despliegue aislado y su activación en
la web. No confundir estos resultados con sincronización completa publicada.

## Prueba real de Apps Script completada

En la continuación posterior sí se recuperó acceso al navegador. Se actualizó
el módulo aislado con el candidato vigente, incluida la normalización de UUID,
y se ejecutó `probarSyncMovimientosAisladoT28` en la copia del proyecto.
El registro de Google devolvió `ok:true` y «Se completó la ejecución».
Destino explícito: `1umHzP2JlzJfoRdSQOah7lHSPQJWQesXT-U4m8y3VJGM`.
Pasaron cuatro comprobaciones: ingreso creado una sola vez, reintento conserva
ID, hora inválida no modifica fila y cambio remoto detectado sin sobrescritura.
Registro sintético conservado en la copia:
`3ba36639-cc1d-4078-aeea-71152584b166`.
Evidencia: `outputs/sync-qa/prueba-google-correcta.png` en el workspace padre.
No se publicó ni cambió producción. Este ensayo prueba los helpers de servidor,
no el circuito de sincronización automática completo del navegador ni su ruta
autenticada, que siguen pendientes de integración.

La suite conjunta de recuperación, movimientos y recibos pasa 28 pruebas.
Se agregó una regresión para normalizar UUID a minúsculas: cambiar la
capitalización de un identificador no debe crear un segundo movimiento.
Esta última corrección está solo en el candidato local; la copia de Google
necesita recibirla antes de su prueba de integración.

El último intento de inventariar las pestañas devolvió que el uso del navegador
local está desactivado en Work. No se ejecutó la función aislada ni se modificó
producción. La sincronización automática completa continúa pendiente de
integración y verificación; los resultados locales no sustituyen esa prueba.


### Edición HTTP automática verificada — 26 de octubre de 2026

Recarga del panel aislado confirmó QA989 y la observación «Edición desde formulario verificada contra Google».
La prueba HTTP real de edición perdió deliberadamente la primera respuesta exitosa. El worker recuperó el mismo recibo (`9551c5f1-45ec-466d-96b7-0577d0804a67`, registro `81e552dc-d323-4d79-99f5-3272eb8ddb5b`), con replay:true; retiró el pendiente y una lectura nueva de Google confirmó la observación. Evidencia: outputs/sync-qa/edicion-automatica-google-confirmada.png (fuera del repositorio).
Se corrigió el formulario sintético de pruebas para enviar fecha ISO y todos los campos obligatorios; los intentos previos fallaron y no se cuentan como pruebas aprobadas. Los rechazos permanecen disponibles para revisión local. Las 61 pruebas locales pasaron. Producción sin cambios. Sigue pendiente completar el alcance de otros módulos y la revisión previa a publicar.

### Orden de cambios pendientes por movimiento

El worker mantiene bloqueado cada ID mientras una operación anterior siga sin confirmar, incluso si esa operación es antigua, tiene conflicto o está siendo enviada desde otra pestaña. Otros movimientos pueden seguir sincronizando. Una confirmación libera el ID para la siguiente operación; una versión obsoleta sigue siendo rechazada por el servidor. Esto ordena los reintentos del worker; no introduce todavía una cola común para todos los envíos iniciales del formulario.
Validación: 63 pruebas aprobadas, incluidas bloqueo por operación antigua, fallo de red, lease y liberación tras confirmación. Reabrir ya usa actualizarMovimientoWeb con versión esperada y se beneficia de la ruta de edición habilitada. Eliminar sigue sin recibo propio y no se reintenta automáticamente. Producción no modificada.

### Eliminación con recibo — implementación local

Se añadió sync.movimientos.eliminar al candidato de API, validado con permiso eliminar y actor de la sesión. Conserva ID y versión esperada, usa recibos separados _T28_SYNC_ELIMINACIONES y vuelve a localizar el ID inmediatamente antes de borrar. Un recibo confirmado se devuelve sin tocar otra fila; un PREPARADO ambiguo exige revisión. Continúa existiendo la ventana de concurrencia externa de AppSheet entre última comprobación y deleteRow: LockService solo coordina este script.
Cliente: respaldo durable, reintento del mismo ID tras recarga, recuperación manual/automática y banderas independientes syncEliminaciones/autoSyncEliminaciones, ambas false en producción. Se corrigió el filtrado visual optimista para priorizar ID estable sobre filaIndex.
72 pruebas locales pasan: incluyen permiso específico, respuesta perdida y recarga, conflicto conservado, eliminación con fila desplazada usando las funciones reales y recibo repetido sin un segundo borrado. Este cambio no fue subido a Apps Script ni habilitado en la copia de Google; el gateway de pruebas sigue bloqueando eliminación. Falta la prueba HTTP aislada antes de habilitarlo.

### Eliminación HTTP real verificada en Google — 26 de octubre de 2026

Copia de Apps Script actualizada a versión 5, misma URL y configuración de acceso; módulos de movimientos y API fijados explícitamente a la hoja duplicada. El usuario autorizó expresamente crear y borrar únicamente el registro ficticio QA987 PRUEBA ELIMINACION DESECHABLE.
Resultado HTTP real: operationId 87aafe50-120a-4275-8b02-1a86e0fe294a, recordId 6cc0f792-851d-4347-9b7f-849e40158536. Se perdió deliberadamente la primera respuesta exitosa; el worker recuperó el recibo original con replay:true y retiró el pendiente. Una lectura nueva de Google confirmó ausencia del ID. Evidencia fuera del repo: outputs/sync-qa/eliminacion-automatica-google-confirmada.png; despliegue: staging-version-5-eliminaciones.png. Las 72 pruebas locales siguen pasando. Producción sin cambios y banderas de eliminación desactivadas allí.
