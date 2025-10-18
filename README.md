# MLTrack - MercadoLibre Product Tracker

Sistema completo de seguimiento y sincronización de productos de MercadoLibre con funcionalidades PWA, autenticación OAuth2, y comunicación en tiempo real.

## 🚀 Características

- **Autenticación OAuth2** con MercadoLibre
- **Sincronización automática** de productos y búsquedas
- **PWA completa** instalable en Android/iOS con notificaciones push
- **Notificaciones push nativas** con Web Push API y VAPID
- **PWA (Progressive Web App)** con funcionamiento offline
- **Comunicación en tiempo real** con Socket.IO
- **Scheduler personalizado** sin setInterval fijo
- **Colas de trabajo** con BullMQ y Redis
- **Base de datos** PostgreSQL con Drizzle ORM
- **Frontend moderno** React + Vite + TailwindCSS

## 🛠️ Stack Tecnológico

### Backend
- **Node.js** + **Fastify**
- **PostgreSQL** + **Drizzle ORM**
- **Redis** + **BullMQ**
- **Socket.IO**
- **OAuth2** (MercadoLibre)

### Frontend
- **React 18** + **TypeScript**
- **Vite** (build tool)
- **TailwindCSS** (estilos)
- **React Query** (estado servidor)
- **Zustand** (estado local)
- **Socket.IO Client**
- **IndexedDB** (almacenamiento offline)

## 📋 Prerrequisitos

- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+
- pm2 (para producción)

## 🔧 Instalación

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd mltrack
```

### 2. Configurar el backend

```bash
cd backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp env.example .env
# Editar .env con tus credenciales de MercadoLibre y base de datos
```

### 3. Configurar la base de datos

```bash
# Crear base de datos PostgreSQL
createdb mltrack

# Ejecutar migraciones (cuando estén disponibles)
npm run db:migrate
```

### 4. Configurar el frontend

```bash
cd ../frontend

# Instalar dependencias
npm install
```

### 5. Variables de entorno

#### Backend (.env)
```env
# MercadoLibre OAuth2
ML_CLIENT_ID=tu_client_id_de_mercadolibre
ML_CLIENT_SECRET=tu_client_secret_de_mercadolibre
ML_REDIRECT_URI=https://sqsoft.top/mltrack/auth/callback

# Base de datos
DB_URL=postgresql://usuario:contraseña@localhost:5432/mltrack

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=tu_secreto_jwt_muy_seguro

# Servidor
PORT=3006
NODE_ENV=production

# Scheduler
SCHEDULER_INTERVAL=300000
MAX_CONCURRENT_SYNCS=3
```

#### Frontend (.env)
```env
VITE_API_URL=https://sqsoft.top/mltrack/api
VITE_SOCKET_URL=https://sqsoft.top
```

## 🚀 Deployment en VPS

### 1. Preparar el servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PostgreSQL
sudo apt install postgresql postgresql-contrib

# Instalar Redis
sudo apt install redis-server

# Instalar pm2 globalmente
sudo npm install -g pm2

# Instalar nginx (opcional, para proxy)
sudo apt install nginx
```

### 2. Configurar PostgreSQL

```bash
# Crear usuario y base de datos
sudo -u postgres psql
CREATE USER mltrack_user WITH PASSWORD 'tu_password_seguro';
CREATE DATABASE mltrack OWNER mltrack_user;
GRANT ALL PRIVILEGES ON DATABASE mltrack TO mltrack_user;
\q
```

### 3. Configurar Redis

```bash
# Verificar que Redis esté corriendo
sudo systemctl status redis
sudo systemctl enable redis
```

### 4. Desplegar la aplicación

```bash
# Crear directorio de la aplicación
sudo mkdir -p /var/www/apps/mltrack
sudo chown -R $USER:$USER /var/www/apps/mltrack

# Copiar archivos del proyecto
cp -r backend /var/www/apps/mltrack/
cp -r frontend /var/www/apps/mltrack/

# Instalar dependencias del backend
cd /var/www/apps/mltrack/backend
npm install --production

# Construir el backend
npm run build

# Instalar dependencias del frontend
cd ../frontend
npm install

# Construir el frontend
npm run build
```

### 5. Configurar pm2

```bash
cd /var/www/apps/mltrack/backend

# Iniciar la aplicación con pm2
npm run pm2:start

# Verificar que esté corriendo
pm2 status
pm2 logs mltrack-backend

# Configurar pm2 para iniciar automáticamente
pm2 startup
pm2 save
```

### 6. Configurar Nginx (opcional)

```bash
# Crear configuración de nginx
sudo nano /etc/nginx/sites-available/mltrack
```

```nginx
server {
    listen 80;
    server_name sqsoft.top;

    # Backend API
    location /mltrack/api {
        proxy_pass http://localhost:3000/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO
    location /mltrack/socket.io {
        proxy_pass http://localhost:3000/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend
    location /mltrack {
        alias /var/www/apps/mltrack/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Headers para PWA
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # Root redirect
    location / {
        return 301 /mltrack;
    }
}
```

```bash
# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/mltrack /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 📝 Comandos de Desarrollo

### Backend
```bash
# Desarrollo
npm run dev

# Construir
npm run build

# Producción
npm start

# PM2
npm run pm2:start
npm run pm2:stop
npm run pm2:restart
npm run pm2:logs
```

### Frontend
```bash
# Desarrollo
npm run dev

# Construir
npm run build

# Preview
npm run preview
```

## 🔐 Configuración de MercadoLibre

1. Ir a [MercadoLibre Developers](https://developers.mercadolibre.com/)
2. Crear una nueva aplicación
3. Configurar redirect URI: `https://sqsoft.top/mltrack/auth/callback`
4. Obtener `CLIENT_ID` y `CLIENT_SECRET`
5. Configurar en el archivo `.env`

## 📊 Estructura del Proyecto

```
mltrack/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Servidor principal
│   │   ├── db/
│   │   │   ├── schema.ts         # Esquemas de base de datos
│   │   │   └── index.ts          # Conexión a DB
│   │   ├── routes/
│   │   │   ├── auth.ts           # Rutas de autenticación
│   │   │   ├── sync.ts           # Rutas de sincronización
│   │   │   └── searches.ts       # Rutas de búsquedas
│   │   ├── services/
│   │   │   └── mercadolibre.ts   # Servicio ML API
│   │   ├── jobs/
│   │   │   └── syncProducts.ts   # Workers BullMQ
│   │   └── utils/
│   │       ├── scheduler.ts      # Scheduler personalizado
│   │       └── redis.ts          # Cliente Redis
│   ├── package.json
│   ├── pm2.config.js
│   └── .env
└── frontend/
    ├── src/
    │   ├── components/           # Componentes React
    │   ├── pages/               # Páginas de la aplicación
    │   ├── hooks/               # Hooks personalizados
    │   ├── services/            # Servicios API y Socket
    │   ├── stores/              # Stores Zustand
    │   ├── types/               # Tipos TypeScript
    │   └── utils/               # Utilidades
    ├── package.json
    └── vite.config.ts
```

## 🔄 Flujo de Sincronización

1. **Scheduler** ejecuta periódicamente
2. **Obtiene vendedores activos** de la base de datos
3. **Encola trabajos** en BullMQ para cada vendedor
4. **Workers procesan** sincronización en paralelo
5. **Actualiza productos** en base de datos
6. **Notifica** via Socket.IO al frontend
7. **Registra historial** de sincronización

## 🌐 API Endpoints

### Autenticación
- `GET /api/auth/mercadolibre` - Iniciar OAuth2
- `GET /api/auth/callback` - Callback OAuth2
- `GET /api/auth/sellers` - Lista de vendedores
- `POST /api/auth/refresh/:id` - Renovar token

### Sincronización
- `POST /api/sync/scheduler` - Controlar scheduler
- `POST /api/sync/seller/:id` - Sincronizar vendedor
- `POST /api/sync/search/:id` - Ejecutar búsqueda
- `GET /api/sync/status` - Estado de sincronización

### Búsquedas
- `GET /api/searches` - Lista de búsquedas
- `POST /api/searches` - Crear búsqueda
- `GET /api/searches/:id/results` - Resultados

## 🐛 Troubleshooting

### Error de conexión a base de datos
```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Verificar conexión
psql -h localhost -U mltrack_user -d mltrack
```

### Error de conexión a Redis
```bash
# Verificar que Redis esté corriendo
sudo systemctl status redis

# Probar conexión
redis-cli ping
```

### Logs de la aplicación
```bash
# Ver logs de pm2
pm2 logs mltrack-backend

# Ver logs en tiempo real
pm2 logs mltrack-backend --lines 100 -f
```

## 📱 PWA y Notificaciones Push

### 🎯 Capacidades PWA Completas

MLTrack incluye una PWA completamente funcional con:

- **Instalación nativa** en Android, iOS y escritorio
- **Notificaciones push nativas** con Web Push API y VAPID
- **Funcionamiento offline** con IndexedDB y Service Worker
- **Interfaz responsive** optimizada para móviles y escritorio
- **Cache inteligente** con estrategias avanzadas (Stale-While-Revalidate, CacheFirst)

### 🔔 Sistema de Notificaciones Push

#### Configuración VAPID
```bash
# Generar claves VAPID (una sola vez)
npx web-push generate-vapid-keys

# Agregar al archivo .env del backend
VAPID_PUBLIC_KEY=tu_clave_publica_vapid
VAPID_PRIVATE_KEY=tu_clave_privada_vapid
VAPID_SUBJECT=mailto:admin@sqsoft.top
```

#### Características de Notificaciones
- **Suscripción automática** a notificaciones push
- **Filtros personalizables** por:
  - Precio mínimo/máximo
  - Categorías específicas
  - Ubicaciones geográficas
- **Tipos de notificaciones**:
  - 🆕 Nuevos productos encontrados
  - 💰 Cambios de precio
  - 🔍 Nuevos resultados de búsqueda
  - ✅ Completado de sincronizaciones
- **Gestión de permisos** y preferencias de usuario
- **Compatibilidad multiplataforma** (Android Chrome, iOS Safari, Desktop)

#### Instalación PWA
- **Prompt automático** cuando la PWA es instalable
- **Íconos adaptativos** en múltiples resoluciones (72x72 a 512x512)
- **Manifest completo** con shortcuts y configuración
- **Service Worker** con estrategias de cache avanzadas

### 🛠️ Generación de Íconos PWA

```bash
# Generar íconos básicos (placeholders)
node scripts/generate-pwa-icons.js

# Generar íconos reales con Sharp (requiere: npm install sharp)
node scripts/generate-icons-with-sharp.js
```

### 📲 APIs de Notificaciones

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

## 📞 Soporte

Para soporte técnico o reportar bugs, crear un issue en el repositorio del proyecto.

## 📄 Licencia

MIT License - ver archivo LICENSE para más detalles.
