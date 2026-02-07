#!/usr/bin/env node
/**
 * Cria uma tag de release a partir da versão do package.json
 * e exibe o comando para enviar ao GitHub.
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const version = pkg.version;
const tag = `v${version}`;

console.log('');
console.log('📌 Versão no package.json:', version);
console.log('🏷️  Tag a ser criada:', tag);
console.log('');
console.log('Execute os comandos abaixo para criar a release:');
console.log('');
console.log('  git add -A');
console.log('  git status   # revise as alterações');
console.log(`  git commit -m "Release ${tag}"`);
console.log(`  git tag -a ${tag} -m "Release ${tag}"`);
console.log(`  git push origin main`);
console.log(`  git push origin ${tag}`);
console.log('');
console.log('O GitHub Actions vai fazer o build e publicar a release automaticamente.');
console.log('');
