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

// Linux: electron-builder exige o tamanho no nome (ex.: 256x256.png)
const icon256 = path.join(buildDir, '256x256.png');
fs.copyFileSync(iconSrc, icon256);
console.log('Ícone copiado para build/256x256.png (Linux)');

// Gerar icon.ico para Windows (png-to-ico; sem dependências nativas/OpenSSL)
try {
  require('png-to-ico')(iconSrc)
    .then((ico) => {
      fs.writeFileSync(iconDestIco, ico);
      console.log('Ícone Windows gerado: build/icon.ico');
    })
    .catch((err) => console.warn('png-to-ico falhou:', err.message))
    .finally(() => process.exit(0));
} catch (e) {
  console.warn('png-to-ico não disponível; use build/icon.png no Windows.');
  process.exit(0);
}
