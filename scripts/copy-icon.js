const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const buildDir = path.join(root, 'build');
const iconSrc = path.join(root, 'assets', 'icon.png');
const iconDestPng = path.join(buildDir, 'icon.png');
const iconDestIco = path.join(buildDir, 'icon.ico');

if (!fs.existsSync(iconSrc)) {
  console.warn('assets/icon.png não encontrado');
  process.exit(0);
}

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

fs.copyFileSync(iconSrc, iconDestPng);
console.log('Ícone copiado para build/icon.png');
// Linux: electron-builder exige o tamanho no nome (ex.: 256x256.png)
const icon256 = path.join(buildDir, '256x256.png');
fs.copyFileSync(iconSrc, icon256);
console.log('Ícone copiado para build/256x256.png (Linux)');

// Gerar icon.ico para Windows (NSIS usa e mostra no instalador/atalho)
try {
  require('png-to-ico')(iconSrc)
    .then((ico) => {
      fs.writeFileSync(iconDestIco, ico);
      console.log('Ícone Windows gerado: build/icon.ico');
    })
    .catch(() => console.warn('png-to-ico falhou; ícone Windows usará PNG.'))
    .finally(() => process.exit(0));
} catch (e) {
  console.warn('png-to-ico não instalado; ícone Windows usará PNG.');
  process.exit(0);
}
