# 🚀 Guia de Release

Este projeto usa **GitHub Actions** para fazer build automático para Windows, Linux e macOS.

## Como criar uma release

### Opção 1: Usar o script (recomendado)

1. Atualize a versão no `package.json` (ex: `1.0.1`).
2. Rode o script para ver os comandos:

   ```bash
   npm run release
   ```

3. Execute os comandos que aparecem (commit, tag, push). O push da tag dispara o workflow e a release é criada automaticamente no GitHub.

### Opção 2: Via GitHub (interface)

1. Vá para a página do repositório no GitHub.
2. Clique em **Releases** → **Draft a new release**.
3. Escolha ou crie uma tag (ex: `v1.0.1`; deve começar com `v`).
4. Adicione título e descrição da release.
5. Clique em **Publish release**.

O GitHub Actions vai:
- ✅ Fazer build para Windows, Linux e macOS automaticamente
- ✅ Anexar os executáveis na release
- ✅ Gerar notas de release automaticamente

### Opção 3: Via linha de comando (manual)

```bash
# Use a versão do package.json (ex: 1.0.1)
git tag -a v1.0.1 -m "Release v1.0.1"
git push origin v1.0.1
```

## O que é gerado

Os nomes dos arquivos usam a versão do `package.json` (ex: 1.0.1):

- **Windows**: `Editor de Texto Setup 1.0.1.exe` (instalador NSIS)
- **Linux**:
  - `Editor de Texto-1.0.1.AppImage` (executável portátil)
  - `app-txt_1.0.1_amd64.deb` (pacote Debian/Ubuntu)
- **macOS**: `Editor de Texto-1.0.1.dmg` (imagem de disco)

## Troubleshooting

Se o workflow falhar:

1. Verifique os logs em **Actions** → clique no workflow que falhou
2. Certifique-se de que a tag segue o padrão `v*` (ex: `v1.0.0`)
3. Verifique se o `package.json` tem a versão correta
