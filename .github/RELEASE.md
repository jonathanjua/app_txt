# 🚀 Guia de Release

Este projeto usa **GitHub Actions** para fazer build automático para Windows, Linux e macOS.

## Como criar uma release

### Opção 1: Via GitHub (Recomendado)

1. Vá para a página do repositório no GitHub
2. Clique em **Releases** → **Draft a new release**
3. Escolha ou crie uma tag (ex: `v1.0.0`)
4. Adicione título e descrição da release
5. Clique em **Publish release**

O GitHub Actions vai:
- ✅ Fazer build para Windows, Linux e macOS automaticamente
- ✅ Anexar os executáveis na release
- ✅ Gerar notas de release automaticamente

### Opção 2: Via linha de comando

```bash
# Criar tag
git tag -a v1.0.0 -m "Release v1.0.0"

# Push da tag (dispara o workflow)
git push origin v1.0.0
```

Depois, vá no GitHub e crie a release manualmente ou use a API do GitHub.

## O que é gerado

- **Windows**: `Editor de Texto Setup 1.0.0.exe` (instalador NSIS)
- **Linux**:
  - `Editor de Texto-1.0.0.AppImage` (executável portátil)
  - `app-txt_1.0.0_amd64.deb` (pacote Debian/Ubuntu)
- **macOS**: `Editor de Texto-1.0.0.dmg` (imagem de disco)

## Troubleshooting

Se o workflow falhar:

1. Verifique os logs em **Actions** → clique no workflow que falhou
2. Certifique-se de que a tag segue o padrão `v*` (ex: `v1.0.0`)
3. Verifique se o `package.json` tem a versão correta
