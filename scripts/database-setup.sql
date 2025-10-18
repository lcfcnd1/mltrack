-- Script de configuración inicial de la base de datos para MLTrack
-- Ejecutar como superusuario de PostgreSQL

-- Crear usuario y base de datos para producción
CREATE USER mltrack_user WITH PASSWORD 'mltrack_password_2024';

-- Crear base de datos
CREATE DATABASE mltrack OWNER mltrack_user;

-- Otorgar privilegios
GRANT ALL PRIVILEGES ON DATABASE mltrack TO mltrack_user;

-- Conectar a la base de datos
\c mltrack;

-- Otorgar privilegios en el esquema público
GRANT ALL ON SCHEMA public TO mltrack_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mltrack_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mltrack_user;

-- Configurar permisos por defecto para futuras tablas
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mltrack_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mltrack_user;

-- Crear usuario y base de datos para desarrollo
CREATE USER mltrack_dev WITH PASSWORD 'mltrack_dev_2024';
CREATE DATABASE mltrack_dev OWNER mltrack_dev;

-- Otorgar privilegios para desarrollo
GRANT ALL PRIVILEGES ON DATABASE mltrack_dev TO mltrack_dev;

-- Conectar a la base de datos de desarrollo
\c mltrack_dev;

-- Otorgar privilegios en el esquema público para desarrollo
GRANT ALL ON SCHEMA public TO mltrack_dev;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mltrack_dev;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mltrack_dev;

-- Configurar permisos por defecto para futuras tablas en desarrollo
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mltrack_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mltrack_dev;

-- Configuraciones adicionales de PostgreSQL para optimización
-- Ajustar configuración de conexiones (opcional)
-- ALTER SYSTEM SET max_connections = 200;

-- Configurar logging (opcional)
-- ALTER SYSTEM SET log_statement = 'mod';
-- ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Recargar configuración
-- SELECT pg_reload_conf();

-- Mostrar información de las bases de datos creadas
\l+ mltrack*
\du mltrack*

-- Mensaje de confirmación
SELECT 'Base de datos MLTrack configurada correctamente' AS status;
