/**
 * Script avanzado para generar íconos PWA usando Sharp
 * Requiere: npm install sharp
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Genera íconos PWA reales usando Sharp
 */
async function generateRealPWAIcons() {
  const publicDir = path.join(__dirname, '..', 'frontend', 'public');
  
  // SVG base optimizado para Sharp
  const baseSVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3483fa;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2968c8;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Fondo redondeado -->
  <rect width="512" height="512" rx="128" ry="128" fill="url(#bg)"/>
  
  <!-- Símbolo principal -->
  <g transform="translate(256, 256)">
    <!-- Círculo central -->
    <circle cx="0" cy="0" r="120" fill="white" stroke="#3483fa" stroke-width="12"/>
    
    <!-- Texto ML -->
    <text x="0" y="20" font-family="Arial, sans-serif" font-size="80" font-weight="bold" text-anchor="middle" fill="#3483fa">ML</text>
    
    <!-- Símbolo de tracking -->
    <g transform="translate(0, 40)">
      <!-- Flecha hacia arriba -->
      <path d="M-25,-35 L-12,-22 L-6,-22 L-6,12 L6,12 L6,-22 L12,-22 L25,-35 Z" fill="#3483fa" opacity="0.8"/>
      
      <!-- Puntos de seguimiento -->
      <circle cx="-18" cy="25" r="4" fill="#3483fa"/>
      <circle cx="0" cy="30" r="5" fill="#3483fa"/>
      <circle cx="18" cy="25" r="4" fill="#3483fa"/>
      
      <!-- Línea de conexión -->
      <path d="M-18,25 Q0,20 18,25" stroke="#3483fa" stroke-width="2" fill="none"/>
    </g>
  </g>
</svg>`;

  console.log('🎨 Generando íconos PWA reales con Sharp...');

  // Definir los tamaños de íconos
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

  try {
    // Crear directorio public si no existe
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Escribir el SVG base
    const svgPath = path.join(publicDir, 'icon.svg');
    fs.writeFileSync(svgPath, baseSVG);
    console.log('✅ SVG base creado:', svgPath);

    // Generar cada ícono
    for (const { size, name } of iconSizes) {
      const iconPath = path.join(publicDir, name);
      
      await sharp(Buffer.from(baseSVG))
        .resize(size, size)
        .png({
          quality: 90,
          compressionLevel: 9,
          adaptiveFiltering: true
        })
        .toFile(iconPath);
      
      console.log(`✅ Ícono generado: ${name} (${size}x${size})`);
    }

    // Generar favicon.ico (16x16, 32x32, 48x48)
    const faviconPath = path.join(publicDir, 'favicon.ico');
    await sharp(Buffer.from(baseSVG))
      .resize(32, 32)
      .png()
      .toFile(faviconPath.replace('.ico', '.png'));
    
    console.log('✅ Favicon generado: favicon.png');

    // Generar apple-touch-icon (180x180)
    const appleTouchIconPath = path.join(publicDir, 'apple-touch-icon.png');
    await sharp(Buffer.from(baseSVG))
      .resize(180, 180)
      .png({
        quality: 95,
        compressionLevel: 8
      })
      .toFile(appleTouchIconPath);
    
    console.log('✅ Apple Touch Icon generado: apple-touch-icon.png');

    // Generar masked-icon.svg (para Safari)
    const maskedIconPath = path.join(publicDir, 'masked-icon.svg');
    const maskedSVG = baseSVG.replace('fill="url(#bg)"', 'fill="black"');
    fs.writeFileSync(maskedIconPath, maskedSVG);
    console.log('✅ Masked Icon generado: masked-icon.svg');

    console.log('\n🎉 ¡Todos los íconos PWA generados exitosamente!');
    console.log('\n📱 Los íconos están listos para:');
    console.log('• Instalación en Android/iOS');
    console.log('• Agregar a pantalla de inicio');
    console.log('• Mostrar en launcher del sistema');
    console.log('• Notificaciones push');

  } catch (error) {
    console.error('❌ Error al generar íconos:', error.message);
    console.log('\n💡 Solución: Instala Sharp ejecutando:');
    console.log('npm install sharp');
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  generateRealPWAIcons().catch(console.error);
}

module.exports = { generateRealPWAIcons };
