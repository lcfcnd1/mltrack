# Guía de Deployment - MLTrack

Esta guía detalla el proceso completo de deployment de MLTrack en un VPS usando pm2 y nginx.

## 📋 Prerrequisitos del Servidor

### Especificaciones mínimas recomendadas:
- **CPU**: 2 cores
- **RAM**: 4GB
- **Almacenamiento**: 20GB SSD
- **OS**: Ubuntu 20.04+ / Debian 11+

### Software requerido:
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Nginx (opcional, para proxy)
- pm2 (para gestión de procesos)

## 🚀 Deployment Automático

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

# Instalar nginx (opcional)
sudo apt install nginx
```

### 2. Configurar base de datos

```bash
# Ejecutar script de configuración de base de datos
sudo -u postgres psql -f scripts/database-setup.sql
```

### 3. Ejecutar deployment

```bash
# Hacer el script ejecutable
chmod +x scripts/deploy.sh

# Ejecutar deployment
./scripts/deploy.sh
```

El script de deployment automáticamente:
- ✅ Verifica prerrequisitos
- ✅ Copia archivos al directorio de deployment
- ✅ Instala dependencias
- ✅ Construye la aplicación
- ✅ Configura pm2
- ✅ Verifica conectividad a base de datos y Redis
- ✅ Inicia la aplicación

## 🔧 Deployment Manual

### 1. Preparar directorio

```bash
# Crear directorio de deployment
sudo mkdir -p /var/www/apps/mltrack
sudo chown -R $USER:$USER /var/www/apps/mltrack

# Copiar archivos
cp -r backend /var/www/apps/mltrack/
cp -r frontend /var/www/apps/mltrack/
```

### 2. Configurar backend

```bash
cd /var/www/apps/mltrack/backend

# Instalar dependencias
npm ci --production

# Configurar variables de entorno
cp env.example .env
# Editar .env con tus credenciales

# Construir aplicación
npm run build
```

### 3. Configurar frontend

```bash
cd /var/www/apps/mltrack/frontend

# Instalar dependencias
npm ci

# Construir aplicación
npm run build
```

### 4. Configurar pm2

```bash
cd /var/www/apps/mltrack/backend

# Iniciar con pm2
pm2 start pm2.config.js

# Configurar auto-start
pm2 startup
pm2 save
```

## 🌐 Configuración de Nginx

### 1. Crear configuración

```bash
# Copiar configuración de nginx
sudo cp scripts/nginx-config.conf /etc/nginx/sites-available/mltrack

# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/mltrack /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Recargar nginx
sudo systemctl reload nginx
```

### 2. Configurar SSL (opcional)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obtener certificado SSL
sudo certbot --nginx -d sqsoft.top -d www.sqsoft.top

# Verificar renovación automática
sudo certbot renew --dry-run
```

## 🔍 Verificación del Deployment

### 1. Verificar servicios

```bash
# Verificar pm2
pm2 status
pm2 logs mltrack-backend

# Verificar nginx
sudo systemctl status nginx

# Verificar PostgreSQL
sudo systemctl status postgresql

# Verificar Redis
sudo systemctl status redis
```

### 2. Verificar aplicación

```bash
# Health check
curl http://localhost:3006/health

# Verificar frontend
curl http://localhost:3006/
```

### 3. Verificar logs

```bash
# Logs de la aplicación
pm2 logs mltrack-backend --lines 50

# Logs de nginx
sudo tail -f /var/log/nginx/mltrack_access.log
sudo tail -f /var/log/nginx/mltrack_error.log

# Logs del sistema
sudo journalctl -u nginx -f
```

## 🛠️ Comandos de Mantenimiento

### Gestión de la aplicación

```bash
# Reiniciar aplicación
pm2 restart mltrack-backend

# Detener aplicación
pm2 stop mltrack-backend

# Ver estado
pm2 status

# Ver logs en tiempo real
pm2 logs mltrack-backend -f

# Monitorear recursos
pm2 monit
```

### Actualización de la aplicación

```bash
# Detener aplicación
pm2 stop mltrack-backend

# Hacer backup
sudo cp -r /var/www/apps/mltrack /var/www/apps/mltrack-backup-$(date +%Y%m%d-%H%M%S)

# Actualizar código
# ... copiar nuevos archivos ...

# Reinstalar dependencias
cd /var/www/apps/mltrack/backend
npm ci --production
npm run build

cd ../frontend
npm ci
npm run build

# Reiniciar aplicación
pm2 restart mltrack-backend
```

### Limpieza de logs

```bash
# Limpiar logs de pm2
pm2 flush

# Limpiar logs de nginx
sudo truncate -s 0 /var/log/nginx/mltrack_*.log

# Limpiar logs del sistema
sudo journalctl --vacuum-time=7d
```

## 🔒 Seguridad

### 1. Firewall

```bash
# Configurar UFW
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 3006  # Solo si no usas nginx
```

### 2. Configuración de PostgreSQL

```bash
# Editar configuración de PostgreSQL
sudo nano /etc/postgresql/*/main/postgresql.conf

# Configuraciones recomendadas:
# listen_addresses = 'localhost'
# max_connections = 100
# shared_buffers = 256MB
# effective_cache_size = 1GB

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

### 3. Configuración de Redis

```bash
# Editar configuración de Redis
sudo nano /etc/redis/redis.conf

# Configuraciones recomendadas:
# bind 127.0.0.1
# requirepass tu_password_seguro
# maxmemory 512mb
# maxmemory-policy allkeys-lru

# Reiniciar Redis
sudo systemctl restart redis
```

## 📊 Monitoreo

### 1. Monitoreo básico con pm2

```bash
# Instalar módulo de monitoreo
pm2 install pm2-server-monit

# Ver métricas
pm2 monit
```

### 2. Monitoreo de logs

```bash
# Instalar herramienta de logs
npm install -g pm2-logrotate

# Configurar rotación de logs
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### 3. Alertas por email (opcional)

```bash
# Instalar módulo de alertas
pm2 install pm2-mail

# Configurar alertas
pm2 set pm2-mail:mail_to "admin@sqsoft.top"
pm2 set pm2-mail:mail_from "mltrack@sqsoft.top"
pm2 set pm2-mail:mail_smtp "smtp.gmail.com:587"
```

## 🐛 Troubleshooting

### Problemas comunes

#### 1. Error de conexión a base de datos

```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Verificar conexión
psql -h localhost -U mltrack_user -d mltrack

# Verificar configuración
sudo nano /etc/postgresql/*/main/postgresql.conf
```

#### 2. Error de conexión a Redis

```bash
# Verificar que Redis esté corriendo
sudo systemctl status redis

# Probar conexión
redis-cli ping

# Verificar configuración
sudo nano /etc/redis/redis.conf
```

#### 3. Error de permisos

```bash
# Verificar permisos del directorio
ls -la /var/www/apps/mltrack

# Corregir permisos
sudo chown -R $USER:$USER /var/www/apps/mltrack
sudo chmod -R 755 /var/www/apps/mltrack
```

#### 4. Error de memoria

```bash
# Verificar uso de memoria
free -h
pm2 monit

# Configurar límite de memoria en pm2
pm2 restart mltrack-backend --max-memory-restart 1G
```

### Logs de debug

```bash
# Habilitar logs detallados
pm2 restart mltrack-backend --log-date-format "YYYY-MM-DD HH:mm:ss Z"

# Ver logs con timestamp
pm2 logs mltrack-backend --timestamp

# Filtrar logs por nivel
pm2 logs mltrack-backend --err
pm2 logs mltrack-backend --out
```

## 📞 Soporte

Para problemas de deployment:

1. Verificar logs: `pm2 logs mltrack-backend`
2. Verificar estado: `pm2 status`
3. Verificar conectividad: `curl http://localhost:3006/health`
4. Revisar configuración de nginx: `sudo nginx -t`
5. Verificar servicios: `sudo systemctl status postgresql redis nginx`

## 📝 Checklist de Deployment

- [ ] Servidor configurado con prerrequisitos
- [ ] Base de datos PostgreSQL creada y configurada
- [ ] Redis instalado y corriendo
- [ ] Variables de entorno configuradas
- [ ] Aplicación construida correctamente
- [ ] pm2 configurado y aplicaciones corriendo
- [ ] nginx configurado (opcional)
- [ ] SSL configurado (opcional)
- [ ] Firewall configurado
- [ ] Monitoreo configurado
- [ ] Backup configurado
- [ ] Logs configurados
- [ ] Health check funcionando
- [ ] Frontend accesible
- [ ] API respondiendo
- [ ] Socket.IO funcionando
