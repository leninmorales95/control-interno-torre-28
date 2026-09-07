# Torre 28 Android nativo

Aplicación Android desarrollada con Kotlin y Jetpack Compose. No usa WebView.

## Primera etapa

- Inicio de sesión contra la API existente de Apps Script.
- Recuperación de sesión y modo sin conexión ante fallos temporales.
- Navegación adaptativa para celular y tablet.
- Pantalla Inicio con métricas reales.
- Cierre de sesión.

Los módulos Movimientos y Usuarios aparecen como destinos preparados para las siguientes entregas.

## Compilar

Abrir `android-app` con Android Studio, instalar Android SDK 36 y ejecutar `app`.
También se puede lanzar manualmente desde esta carpeta con Gradle 9.6:

```text
gradle :app:assembleDebug
```

La APK de depuración queda en `app/build/outputs/apk/debug/app-debug.apk`.
