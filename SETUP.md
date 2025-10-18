# 🚀 Guía de Instalación - MLTrack

Esta guía te llevará paso a paso para configurar y ejecutar MLTrack desde cero después de clonarlo desde GitHub.

## 📋 Prerrequisitos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js 18+** - [Descargar aquí](https://nodejs.org/)
- **PostgreSQL 14+** - [Descargar aquí](https://www.postgresql.org/download/)
- **Redis 6+** - [Descargar aquí](https://redis.io/download)
- **Git** - [Descargar aquí](https://git-scm.com/)

### 🐧 Instalación en Ubuntu/Debian:

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Git
sudo apt install git -y

# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Instalar Redis
sudo apt install redis-server -y

# Instalar pm2 globalmente (opcional, para producción)
sudo npm install -g pm2
```

### Verificar instalaciones:
```bash
node --version    # Debe ser 18.0.0 o superior
npm --version     # Debe ser 8.0.0 o superior
psql --version    # Debe ser 14.0 o superior
redis-cli --version # Debe ser 6.0 o superior
git --version
```

## 🔧 Paso 1: Clonar el repositorio

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/mltrack.git
cd mltrack

# Verificar que estás en el directorio correcto
ls -la  # Debes ver: backend/, frontend/, scripts/, README.md, etc.
```

## 🗄️ Paso 2: Configurar PostgreSQL

### 2.1 Iniciar PostgreSQL
```bash
# En Windows (si usas PostgreSQL instalado)
# PostgreSQL debería iniciarse automáticamente como servicio

# En Ubuntu/Linux
sudo systemctl start postgresql
sudo systemctl enable postgresql  # Para que inicie automáticamente

# En Mac
brew services start postgresql
```

### 2.2 Crear base de datos
```bash
# Crear usuario y base de datos para desarrollo
sudo -u postgres psql

# Dentro de psql, ejecutar:
CREATE USER mltrack_dev WITH PASSWORD 'mltrack_dev_2024';
CREATE DATABASE mltrack_dev OWNER mltrack_dev;
GRANT ALL PRIVILEGES ON DATABASE mltrack_dev TO mltrack_dev;
\q
```

### 2.3 Verificar conexión
```bash
# Probar conexión
psql -h localhost -U mltrack_dev -d mltrack_dev
# Ingresa la contraseña: mltrack_dev_2024
# Luego escribe \q para salir
```

## 🔴 Paso 3: Configurar Redis

### 3.1 Iniciar Redis
```bash
# En Windows (si usas Redis instalado)
redis-server

# En Ubuntu/Linux
sudo systemctl start redis-server
sudo systemctl enable redis-server  # Para que inicie automáticamente

# En Mac
brew services start redis
```

### 3.2 Verificar Redis
```bash
# Probar conexión
redis-cli ping
# Debe responder: PONG
```

## 🔑 Paso 4: Configurar MercadoLibre OAuth2

### 4.1 Crear aplicación en MercadoLibre
1. Ve a [MercadoLibre Developers](https://developers.mercadolibre.com/)
2. Inicia sesión con tu cuenta de MercadoLibre
3. Haz clic en "Crear aplicación"
4. Completa el formulario:
   - **Nombre**: MLTrack
   - **Descripción**: Sistema de tracking de productos
   - **Redirect URI**: `http://localhost:3006/api/auth/callback`
5. Guarda el `CLIENT_ID` y `CLIENT_SECRET` que te proporcionen

### 4.2 Configuración para producción
Para producción en `sqsoft.top/mltrack`, configura:
- **Redirect URI**: `https://sqsoft.top/mltrack/api/auth/callback`
- **Socket.IO path**: `/mltrack/socket.io` (ya configurado automáticamente)

### 4.3 Nota importante
Los tokens de acceso se obtienen automáticamente cuando los usuarios autentican la aplicación.

## ⚙️ Paso 5: Configurar Backend

### 5.1 Navegar al directorio backend
```bash
cd backend
```

### 5.2 Instalar dependencias
```bash
npm install
```

### 5.3 Configurar variables de entorno
```bash
# Copiar archivo de ejemplo
cp env.example .env

# Editar el archivo .env con tus credenciales
# En Windows: notepad .env
# En Linux/Mac: nano .env
```

### 5.4 Contenido del archivo .env
```env
# Configuración de MercadoLibre OAuth2
ML_CLIENT_ID=tu_client_id_de_mercadolibre
ML_CLIENT_SECRET=tu_client_secret_de_mercadolibre
ML_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Tokens de acceso (se actualizan automáticamente)
ML_ACCESS_TOKEN=
ML_REFRESH_TOKEN=

# Base de datos PostgreSQL
DB_URL=postgresql://mltrack_dev:mltrack_dev_2024@localhost:5432/mltrack_dev

# Redis para cache y colas
REDIS_URL=redis://localhost:6379

# JWT Secret para autenticación
JWT_SECRET=tu_secreto_jwt_muy_seguro_de_al_menos_32_caracteres

# Configuración del servidor
PORT=3006
NODE_ENV=development

# Configuración del scheduler (en milisegundos)
SCHEDULER_INTERVAL=300000
MAX_CONCURRENT_SYNCS=3
SCHEDULER_RETRY_DELAY=60000

# URL del frontend (para redirects)
FRONTEND_URL=http://localhost:5173
```

### 5.5 Construir el backend
```bash
npm run build
```

## 🎨 Paso 6: Configurar Frontend

### 6.1 Navegar al directorio frontend
```bash
cd ../frontend
```

### 6.2 Instalar dependencias
```bash
npm install
```

### 6.3 Configurar variables de entorno
```bash
# Crear archivo .env para el frontend
echo "VITE_API_URL=http://localhost:3006/api" > .env
echo "VITE_SOCKET_URL=http://localhost:3006" >> .env
```

## 🚀 Paso 7: Ejecutar la aplicación

### 7.1 Ejecutar en modo desarrollo (recomendado)

#### Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

#### Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

### 7.2 Ejecutar en modo producción con pm2

```bash
# Construir el frontend para producción
cd frontend
npm run build

# Construir el backend para producción
cd ../backend
npm run build

# Iniciar con pm2
pm2 start pm2.config.js

# Ver estado
pm2 status

# Ver logs
pm2 logs mltrack-backend
```

## 📱 Paso 8: Configurar PWA y Notificaciones Push

### 8.1 Generar claves VAPID para notificaciones push

```bash
# Instalar web-push globalmente
npm install -g web-push

# Generar claves VAPID (una sola vez)
npx web-push generate-vapid-keys

# Las claves se mostrarán así:
# Public Key: BEl62iUYgUivxIkv69yViEuiBIa40HI...
# Private Key: Y8f-2OVvpe1a1gOuvT8...
```

### 8.2 Configurar variables de entorno para VAPID

```bash
# Editar archivo .env del backend
nano backend/.env

# Agregar las claves VAPID generadas:
VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa40HI...
VAPID_PRIVATE_KEY=Y8f-2OVvpe1a1gOuvT8...
VAPID_SUBJECT=mailto:admin@sqsoft.top
```

### 8.3 Generar íconos PWA

```bash
# Generar íconos básicos (placeholders)
node scripts/generate-pwa-icons.js

# Para generar íconos reales, instalar Sharp primero:
cd frontend
npm install sharp

# Generar íconos reales
node scripts/generate-icons-with-sharp.js
```

### 8.4 Actualizar base de datos para notificaciones push

```bash
# Ejecutar migraciones para las nuevas tablas
cd backend
npx drizzle-kit push
```

## ✅ Paso 9: Verificar que todo funciona

### 8.1 Verificar backend
- Abre tu navegador en: http://localhost:3006/health
- Debe mostrar un JSON con el estado de salud del sistema

### 8.2 Verificar frontend
- Abre tu navegador en: http://localhost:5173
- Debe mostrar la interfaz de MLTrack

### 8.3 Verificar autenticación
1. En el frontend, haz clic en "Autenticar con MercadoLibre"
2. Serás redirigido a MercadoLibre para autorizar la aplicación
3. Después de autorizar, volverás al frontend autenticado

### 8.4 Verificar Socket.IO (comunicación en tiempo real)
- Abre las herramientas de desarrollador del navegador (F12)
- Ve a la pestaña "Network" o "Red"
- Deberías ver conexiones WebSocket a `ws://localhost:3006/mltrack/socket.io`
- Si ves errores de conexión, verifica que el backend esté corriendo en el puerto 3006

## 🔍 Paso 9: Solución de problemas comunes

### Error: "Cannot connect to PostgreSQL"
```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql    # Ubuntu/Linux
brew services list | grep postgres  # Mac

# Si no está corriendo, iniciarlo:
sudo systemctl start postgresql     # Ubuntu/Linux
brew services start postgresql      # Mac

# Verificar que el servicio esté habilitado
sudo systemctl enable postgresql    # Ubuntu/Linux
```

### Error: "Cannot connect to Redis"
```bash
# Verificar que Redis esté corriendo
redis-cli ping

# Si no responde PONG, iniciar Redis:
redis-server                        # Windows
sudo systemctl start redis-server   # Ubuntu/Linux
brew services start redis           # Mac

# Verificar que el servicio esté habilitado
sudo systemctl enable redis-server  # Ubuntu/Linux
```

### Error: "Invalid ML_CLIENT_ID"
- Verifica que hayas copiado correctamente el CLIENT_ID y CLIENT_SECRET
- Asegúrate de que el redirect URI en MercadoLibre sea exactamente: `http://localhost:3006/api/auth/callback`

### Error: "Port 3006 already in use"
```bash
# Encontrar qué proceso usa el puerto 3006
lsof -i :3006    # Mac/Linux
netstat -ano | findstr :3006    # Windows

# Cambiar puerto en backend/.env
PORT=3007
```

### Error: "Port 5173 already in use"
```bash
# Vite automáticamente usará el siguiente puerto disponible
# O puedes especificar un puerto diferente:
npm run dev -- --port 5174
```

## 📊 Paso 10: Estructura del proyecto

Después de la instalación, tu estructura debería verse así:

```
mltrack/
├── backend/
│   ├── src/                 # Código fuente del backend
│   ├── dist/                # Código compilado (después de npm run build)
│   ├── .env                 # Variables de entorno (crear manualmente)
│   ├── package.json         # Dependencias del backend
│   └── tsconfig.json        # Configuración TypeScript
├── frontend/
│   ├── src/                 # Código fuente del frontend
│   ├── dist/                # Build del frontend (después de npm run build)
│   ├── .env                 # Variables de entorno (crear manualmente)
│   ├── package.json         # Dependencias del frontend
│   └── vite.config.ts       # Configuración Vite
├── scripts/                 # Scripts de deployment y configuración
├── README.md               # Documentación principal
├── SETUP.md                # Esta guía
└── .gitignore              # Archivos ignorados por Git
```

## 🎯 Paso 11: Primeros pasos después de la instalación

1. **Autenticar con MercadoLibre**: Haz clic en el botón de autenticación en el frontend
2. **Crear una búsqueda**: Ve a la sección "Búsquedas" y crea tu primera búsqueda
3. **Ver productos**: Una vez autenticado, podrás ver los productos de tu cuenta
4. **Configurar notificaciones**: Ajusta las configuraciones según tus necesidades

## 🔄 Comandos útiles para desarrollo

### Modo desarrollo:
```bash
# Reiniciar backend
cd backend && npm run dev

# Reiniciar frontend
cd frontend && npm run dev

# Ver logs del backend
cd backend && npm run dev  # Los logs aparecerán en la consola

# Construir para producción
cd backend && npm run build
cd frontend && npm run build

# Limpiar node_modules (si hay problemas)
rm -rf backend/node_modules frontend/node_modules
npm install  # En cada directorio
```

### Script de gestión con pm2 (recomendado):

El proyecto incluye un script simple para gestionar la aplicación con pm2:

```bash
# Hacer ejecutable el script (solo la primera vez)
chmod +x scripts/manage.sh

# Comandos disponibles:
./scripts/manage.sh start      # Iniciar aplicación
./scripts/manage.sh stop       # Detener aplicación
./scripts/manage.sh restart    # Reiniciar aplicación
./scripts/manage.sh status     # Ver estado
./scripts/manage.sh logs       # Ver logs
./scripts/manage.sh monit      # Monitorear recursos
./scripts/manage.sh build      # Construir para producción
./scripts/manage.sh deploy     # Deployment completo (build + start)
./scripts/manage.sh help       # Ver ayuda
```

### Comandos pm2 manuales (alternativa):
```bash
# Iniciar aplicación
pm2 start backend/pm2.config.js

# Detener aplicación
pm2 stop mltrack-backend

# Reiniciar aplicación
pm2 restart mltrack-backend

# Ver estado
pm2 status

# Ver logs en tiempo real
pm2 logs mltrack-backend -f

# Ver logs con timestamp
pm2 logs mltrack-backend --timestamp

# Monitorear recursos
pm2 monit

# Eliminar aplicación de pm2
pm2 delete mltrack-backend

# Configurar para que inicie automáticamente
pm2 startup
pm2 save
```

## 📞 Soporte

Si encuentras algún problema:

1. **Revisa los logs**: Los errores aparecerán en las consolas donde ejecutaste `npm run dev`
2. **Verifica las variables de entorno**: Asegúrate de que el archivo `.env` esté configurado correctamente
3. **Verifica los prerrequisitos**: PostgreSQL y Redis deben estar corriendo
4. **Consulta la documentación**: Revisa el README.md para más detalles

## ✅ Checklist de instalación

- [ ] Node.js 18+ instalado
- [ ] PostgreSQL instalado y corriendo
- [ ] Redis instalado y corriendo
- [ ] Repositorio clonado desde GitHub
- [ ] Base de datos `mltrack_dev` creada
- [ ] Variables de entorno configuradas en `backend/.env`
- [ ] Variables de entorno configuradas en `frontend/.env`
- [ ] Dependencias del backend instaladas (`npm install` en backend/)
- [ ] Dependencias del frontend instaladas (`npm install` en frontend/)
- [ ] Backend construido (`npm run build` en backend/)
- [ ] Backend corriendo en http://localhost:3006
- [ ] Frontend corriendo en http://localhost:5173
- [ ] Health check funcionando en http://localhost:3006/health
- [ ] Aplicación autenticada con MercadoLibre

## 🌐 Configuración para producción (sqsoft.top/mltrack)

### Variables de entorno para producción:

#### Backend (.env):
```env
PORT=3006
NODE_ENV=production
ML_REDIRECT_URI=https://sqsoft.top/mltrack/api/auth/callback
FRONTEND_URL=https://sqsoft.top/mltrack
```

#### Frontend (.env):
```env
VITE_API_URL=https://sqsoft.top/mltrack/api
VITE_SOCKET_URL=https://sqsoft.top
```

### Configuración de Socket.IO:
- ✅ **Backend**: Configurado con path `/mltrack/socket.io`
- ✅ **Frontend**: Configurado para usar el path correcto
- ✅ **Nginx**: Proxy configurado para `/mltrack/socket.io`

## 🛠️ Script de gestión incluido

El proyecto incluye un script simple `scripts/manage.sh` que facilita la gestión de la aplicación:

### Características del script:
- ✅ **Iniciar/detener/reiniciar** la aplicación
- ✅ **Ver logs** en tiempo real
- ✅ **Monitorear recursos** con pm2
- ✅ **Construir** para producción
- ✅ **Deployment completo** automatizado
- ✅ **Ayuda integrada** con `./scripts/manage.sh help`

### Ejemplos de uso:
```bash
# Primera vez - hacer ejecutable
chmod +x scripts/manage.sh

# Desarrollo - iniciar aplicación
./scripts/manage.sh start

# Ver logs en tiempo real
./scripts/manage.sh logs

# Deployment completo
./scripts/manage.sh deploy

# Ver ayuda
./scripts/manage.sh help
```

Este script reemplaza los scripts complejos anteriores y proporciona una interfaz simple y clara para gestionar MLTrack.

## 📱 Funcionalidades PWA y Notificaciones Push

### 🎯 Capacidades PWA Completas

Una vez configurado, MLTrack incluye:

- **Instalación como app nativa** en Android, iOS y escritorio
- **Notificaciones push nativas** con Web Push API
- **Funcionamiento offline** con IndexedDB y Service Worker
- **Cache inteligente** con estrategias avanzadas
- **Interfaz responsive** optimizada para todos los dispositivos

### 🔔 Sistema de Notificaciones Push

#### Tipos de Notificaciones
- **🆕 Nuevos productos** encontrados en sincronizaciones
- **💰 Cambios de precio** en productos seguidos
- **🔍 Nuevos resultados** de búsquedas guardadas
- **✅ Sincronización completa** con estadísticas

#### Configuración de Usuario
- **Filtros personalizables** por precio, categoría, ubicación
- **Preferencias granulares** para cada tipo de notificación
- **Gestión de permisos** y suscripciones
- **Notificaciones de prueba** para verificar funcionamiento

### 📲 Instalación PWA

#### En Android (Chrome)
1. Abre la aplicación en Chrome
2. Aparecerá un prompt "Instalar MLTrack"
3. Toca "Instalar" para agregar a la pantalla de inicio
4. La app se abrirá en modo standalone

#### En iOS (Safari)
1. Abre la aplicación en Safari
2. Toca el botón de compartir
3. Selecciona "Agregar a pantalla de inicio"
4. Confirma el nombre y toca "Agregar"

#### En Escritorio (Chrome/Edge)
1. Abre la aplicación en Chrome o Edge
2. Busca el ícono de instalación en la barra de direcciones
3. Haz clic en "Instalar MLTrack"
4. La app se instalará como aplicación de escritorio

### 🛠️ APIs de Notificaciones

#### Frontend
```typescript
// Hook para PWA
import { usePWA } from './hooks/usePWA';
const { installPWA, isInstallable, hasUpdate } = usePWA();

// Hook para notificaciones push
import { usePushNotifications } from './hooks/usePushNotifications';
const { subscribeToPush, updatePreferences } = usePushNotifications();
```

#### Backend
```typescript
// Enviar notificación push
import { sendNotificationToAllSubscriptions } from './services/pushNotifications';

await sendNotificationToAllSubscriptions({
  title: 'Nuevo producto encontrado',
  body: 'Se encontró un nuevo producto que coincide con tu búsqueda',
  data: { url: '/mltrack/products/123' }
});
```

¡Felicitaciones! 🎉 Si completaste todos los pasos, MLTrack debería estar funcionando correctamente en tu máquina local con todas las capacidades PWA y notificaciones push. 📱✨
