/**
 * Script para generar íconos PWA en múltiples tamaños
 * Crea íconos desde un SVG base para todas las resoluciones necesarias
 */

const fs = require('fs');
const path = require('path');

/**
 * Genera íconos PWA desde un SVG base
 * Este script crea los archivos de íconos necesarios para la PWA
 */
function generatePWAIcons() {
  const publicDir = path.join(__dirname, '..', 'frontend', 'public');
  
  // Definir los tamaños de íconos necesarios
  const iconSizes = [
    { size: 72, name: 'pwa-72x72.png' },
    { size: 96, name: 'pwa-96x96.png' },
    { size: 128, name: 'pwa-128x128.png' },
    { size: 144, name: 'pwa-144x144.png' },
    { size: 152, name: 'pwa-152x152.png' },
    { size: 192, name: 'pwa-192x192.png' },
    { size: 384, name: 'pwa-384x384.png' },
    { size: 512, name: 'pwa-512x512.png' }
  ];

  // SVG base para el ícono de MLTrack
  const baseSVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3483fa;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2968c8;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="icon" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f8f9fa;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Fondo redondeado -->
  <rect width="512" height="512" rx="128" ry="128" fill="url(#bg)"/>
  
  <!-- Símbolo de MercadoLibre -->
  <g transform="translate(64, 64)">
    <!-- Círculo principal -->
    <circle cx="192" cy="192" r="160" fill="url(#icon)" stroke="#3483fa" stroke-width="8"/>
    
    <!-- Texto ML -->
    <text x="192" y="220" font-family="Arial, sans-serif" font-size="120" font-weight="bold" text-anchor="middle" fill="#3483fa">ML</text>
    
    <!-- Símbolo de tracking/seguimiento -->
    <g transform="translate(192, 192)">
      <!-- Flecha hacia arriba -->
      <path d="M-40,-60 L-20,-40 L-10,-40 L-10,20 L10,20 L10,-40 L20,-40 L40,-60 Z" fill="#3483fa" opacity="0.8"/>
      
      <!-- Puntos de seguimiento -->
      <circle cx="-30" cy="40" r="6" fill="#3483fa"/>
      <circle cx="0" cy="50" r="8" fill="#3483fa"/>
      <circle cx="30" cy="40" r="6" fill="#3483fa"/>
      
      <!-- Línea de conexión -->
      <path d="M-30,40 Q0,30 30,40" stroke="#3483fa" stroke-width="3" fill="none"/>
    </g>
  </g>
  
  <!-- Efecto de brillo -->
  <ellipse cx="256" cy="128" rx="200" ry="80" fill="white" opacity="0.1"/>
</svg>`;

  console.log('🎨 Generando íconos PWA para MLTrack...');

  // Crear directorio public si no existe
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Escribir el SVG base
  const svgPath = path.join(publicDir, 'icon.svg');
  fs.writeFileSync(svgPath, baseSVG);
  console.log('✅ SVG base creado:', svgPath);

  // Crear archivos PNG placeholder (en un proyecto real, usarías una librería como sharp)
  iconSizes.forEach(({ size, name }) => {
    const iconPath = path.join(publicDir, name);
    
    // Crear un archivo placeholder
    // En un proyecto real, convertirías el SVG a PNG usando sharp o similar
    const placeholderData = `# Placeholder para ${name} (${size}x${size})
# Este archivo debe ser reemplazado por el ícono real generado desde el SVG
# Puedes usar herramientas como:
# - https://realfavicongenerator.net/
# - https://www.favicon-generator.org/
# - sharp (Node.js library)
# - ImageMagick
`;
    
    fs.writeFileSync(iconPath, placeholderData);
    console.log(`✅ Placeholder creado: ${name}`);
  });

  // Crear archivos adicionales
  const additionalFiles = [
    { name: 'favicon.ico', content: '# Favicon para navegadores que no soportan PWA' },
    { name: 'apple-touch-icon.png', content: '# Ícono para iOS Safari (180x180 recomendado)' },
    { name: 'masked-icon.svg', content: baseSVG }
  ];

  additionalFiles.forEach(({ name, content }) => {
    const filePath = path.join(publicDir, name);
    fs.writeFileSync(filePath, content);
    console.log(`✅ Archivo adicional creado: ${name}`);
  });

  console.log('\n🎉 ¡Íconos PWA generados exitosamente!');
  console.log('\n📝 Próximos pasos:');
  console.log('1. Reemplaza los archivos placeholder con íconos reales');
  console.log('2. Usa herramientas como https://realfavicongenerator.net/');
  console.log('3. O instala sharp: npm install sharp');
  console.log('4. Convierte el SVG a PNG en todos los tamaños necesarios');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  generatePWAIcons();
}

module.exports = { generatePWAIcons };
