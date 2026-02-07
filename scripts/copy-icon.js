const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const buildDir = path.join(root, 'build');
const iconSrc = path.join(root, 'assets', 'icon.png');
const iconDestPng = path.join(buildDir, 'icon.png');
const iconDestIco = path.join(buildDir, 'icon.ico');

if (!fs.existsSync(iconSrc)) {
  console.warn('assets/icon.png não encontrado');
  process.exit(1);
}

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

fs.copyFileSync(iconSrc, iconDestPng);
console.log('Ícone copiado para build/icon.png');

// Linux: conjunto de ícones (electron-builder instala em hicolor e o launcher encontra)
const linuxSizes = ['16x16', '32x32', '48x48', '64x64', '128x128', '256x256', '512x512'];
const iconsDir = path.join(buildDir, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
linuxSizes.forEach((size) => {
  const dest = path.join(iconsDir, `${size}.png`);
  fs.copyFileSync(iconSrc, dest);
});
console.log('Ícones Linux: build/icons/ (16 a 512 px)');

// Windows: pasta win/ com icon.ico (instalador e atalho)
const winDir = path.join(buildDir, 'win');
if (!fs.existsSync(winDir)) fs.mkdirSync(winDir, { recursive: true });

// macOS: pasta mac/ com icon.png (DMG e .app)
const macDir = path.join(buildDir, 'mac');
if (!fs.existsSync(macDir)) fs.mkdirSync(macDir, { recursive: true });
fs.copyFileSync(iconSrc, path.join(macDir, 'icon.png'));
console.log('Ícone macOS: build/mac/icon.png');

// Gerar icon.ico para Windows (png-to-ico; sem dependências nativas/OpenSSL)
const winIcoPath = path.join(winDir, 'icon.ico');
try {
  require('png-to-ico')(iconSrc)
    .then((ico) => {
      fs.writeFileSync(winIcoPath, ico);
      fs.writeFileSync(iconDestIco, ico);
      console.log('Ícone Windows: build/win/icon.ico');
    })
    .catch((err) => console.warn('png-to-ico falhou:', err.message))
    .finally(() => process.exit(0));
} catch (e) {
  console.warn('png-to-ico não disponível; use build/icon.png no Windows.');
  process.exit(0);
}
