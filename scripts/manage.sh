#!/bin/bash

# Script de gestión simple para MLTrack con pm2
# Uso: ./manage.sh [start|stop|restart|status|logs|monit]

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes con color
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Función para mostrar ayuda
show_help() {
    echo "MLTrack - Script de gestión con pm2"
    echo ""
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos disponibles:"
    echo "  start     - Iniciar la aplicación"
    echo "  stop      - Detener la aplicación"
    echo "  restart   - Reiniciar la aplicación"
    echo "  status    - Ver estado de la aplicación"
    echo "  logs      - Ver logs de la aplicación"
    echo "  monit     - Monitorear recursos"
    echo "  build     - Construir la aplicación para producción"
    echo "  deploy    - Deployment completo (build + start)"
    echo "  help      - Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 start"
    echo "  $0 logs"
    echo "  $0 restart"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "backend/package.json" ] || [ ! -f "frontend/package.json" ]; then
    print_error "Este script debe ejecutarse desde el directorio raíz del proyecto"
    exit 1
fi

# Verificar que pm2 esté instalado
if ! command -v pm2 &> /dev/null; then
    print_error "pm2 no está instalado. Instálalo con: npm install -g pm2"
    exit 1
fi

# Función para construir la aplicación
build_app() {
    print_status "Construyendo aplicación para producción..."
    
    # Construir frontend
    print_status "Construyendo frontend..."
    cd frontend
    npm run build
    cd ..
    
    # Construir backend
    print_status "Construyendo backend..."
    cd backend
    npm run build
    cd ..
    
    print_success "Aplicación construida correctamente"
}

# Función para iniciar la aplicación
start_app() {
    print_status "Iniciando aplicación con pm2..."
    
    # Verificar que existe el archivo de configuración de pm2
    if [ ! -f "backend/pm2.config.js" ]; then
        print_error "Archivo pm2.config.js no encontrado en backend/"
        exit 1
    fi
    
    # Ir al directorio backend y iniciar con pm2
    cd backend
    pm2 start pm2.config.js
    cd ..
    
    print_success "Aplicación iniciada correctamente"
    print_status "Verifica el estado con: $0 status"
}

# Función para detener la aplicación
stop_app() {
    print_status "Deteniendo aplicación..."
    pm2 stop mltrack-backend
    print_success "Aplicación detenida"
}

# Función para reiniciar la aplicación
restart_app() {
    print_status "Reiniciando aplicación..."
    pm2 restart mltrack-backend
    print_success "Aplicación reiniciada"
}

# Función para mostrar estado
show_status() {
    print_status "Estado de la aplicación:"
    pm2 status
}

# Función para mostrar logs
show_logs() {
    print_status "Mostrando logs de la aplicación (Ctrl+C para salir):"
    pm2 logs mltrack-backend --lines 50
}

# Función para monitorear
show_monit() {
    print_status "Iniciando monitor de recursos (Ctrl+C para salir):"
    pm2 monit
}

# Función para deployment completo
deploy_app() {
    print_status "Iniciando deployment completo..."
    
    # Detener aplicación si está corriendo
    if pm2 list | grep -q "mltrack-backend"; then
        print_status "Deteniendo aplicación actual..."
        pm2 stop mltrack-backend
    fi
    
    # Construir aplicación
    build_app
    
    # Iniciar aplicación
    start_app
    
    print_success "Deployment completado"
}

# Procesar comando
case "${1:-help}" in
    start)
        start_app
        ;;
    stop)
        stop_app
        ;;
    restart)
        restart_app
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    monit)
        show_monit
        ;;
    build)
        build_app
        ;;
    deploy)
        deploy_app
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Comando no reconocido: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
