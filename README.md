# ARASK — Red comunitaria de rescate animal

App móvil para reportar, rescatar y cuidar animales en situación de calle en Montería.
Proyecto de Electiva Profesional II · Ingeniería de Sistemas · Universidad del Sinú.

- **Web:** https://arask.josedanielmd2021.workers.dev
- **Android:** APK generado con Capacitor (ver abajo)

## Arquitectura

| Capa | Tecnología |
|---|---|
| Interfaz | React 19 + Vite + Tailwind (diseño de los mockups de Stitch), React Router, TanStack Query, Leaflet + OpenStreetMap |
| API | Cloudflare Worker con Hono (`worker/`), validación con Zod compartida (`shared/schemas.ts`) |
| Base de datos | Cloudflare D1 (SQLite) — esquema en `migrations/` |
| Fotos | Cloudflare R2 (`arask-photos`) |
| Android | Capacitor 8 (`android/`) — empaqueta la web y llama a la API desplegada |

**Roles:** `user` (reporta, dona, guarda casos, se une a rescates; quien reporta o se une puede actualizar el caso) y `admin` (moderación, usuarios, estadísticas, campaña). Los correos en `ADMIN_EMAILS` (wrangler.jsonc) se vuelven admin al registrarse o iniciar sesión.

**Seguridad:** contraseñas con PBKDF2-SHA256 (100 000 iteraciones), sesiones con token aleatorio (se guarda solo su hash), permisos verificados en el servidor, límite de 5 reportes por hora por usuario.

**Donaciones:** simuladas (se registran en D1 sin cobro real). La pasarela (Wompi / PayU / Mercado Pago) queda pendiente.

## Desarrollo local

```bash
npm install
npm run db:migrate:local   # crea la base D1 local
npm run dev                # http://localhost:5173 (app + API + D1 + R2 locales)
```

Crea `.dev.vars` (ver `.dev.vars.example`) con tu correo en `ADMIN_EMAILS`.

## Desplegar en Cloudflare

```bash
npx wrangler login
npm run db:migrate:remote  # aplica migraciones nuevas
npm run deploy
```

## Android (APK)

```bash
npm run android:sync       # build con VITE_API_URL (.env.mobile) + copia a android/
cd android && ./gradlew assembleDebug
```

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.
Requiere el JDK de Android Studio (`JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"`).

Para publicar en Play Store se necesita un APK/AAB **firmado**: en Android Studio, *Build → Generate Signed App Bundle / APK*, y guardar el archivo `.jks` y sus contraseñas en un lugar seguro.
