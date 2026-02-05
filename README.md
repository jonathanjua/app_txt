# Editor de Texto

Editor de texto simples feito com Electron, HTML, JavaScript e Tailwind CSS.

## Funcionalidades

- **Novo** – Limpa o editor e inicia um novo documento
- **Abrir** – Abre um arquivo (.txt, .md, .json, .js, .html, .css, etc.)
- **Salvar** – Salva no arquivo atual (Ctrl/Cmd+S)
- **Salvar como** – Salva em um novo arquivo

## Como rodar

```bash
npm install
npm start
```

## Como fazer o build

Instale as dependências e rode o build. O executável sai na pasta `dist/`.

```bash
npm install
npm run build
```

- **Build para o seu sistema**
  `npm run build` gera o instalável do sistema em que você está (Linux, Windows ou macOS).

- **Build por plataforma**
  - Windows: `npm run build:win` → instalador NSIS em `dist/`
  - Linux: `npm run build:linux` → AppImage e .deb em `dist/`
  - macOS: `npm run build:mac` → .dmg em `dist/`

No Linux, após o build você pode executar o AppImage diretamente ou instalar o pacote `.deb`.

## Atalhos

- `Ctrl+N` (ou `Cmd+N` no Mac) – Novo
- `Ctrl+O` (ou `Cmd+O`) – Abrir
- `Ctrl+S` (ou `Cmd+S`) – Salvar
- `Ctrl+W` – Fechar aba

## Desempenho (Electron)

O app já inclui:

- **Sandbox** no renderer e leitura/escrita de arquivos no processo principal (IPC), reduzindo superfície de ataque e mantendo o renderer leve.
- **Barra de status** com debounce (60 ms) na digitação para evitar atualizações excessivas do DOM.
- **DevTools** abertos só em desenvolvimento (`npm start` com app não empacotado).
- **Spellcheck** desativado nas webPreferences para economizar recurso.

Para ir além:

- **Tailwind em build**: em vez do CDN, gere um CSS estático com `npx tailwindcss -i ./src/input.css -o ./dist/output.css` e use esse arquivo; a abertura do app fica mais rápida e dispensa rede.
- **Empacotar**: use `electron-builder` ou `electron-packager` para gerar o executável; o ASAR reduz tamanho e pode melhorar tempo de carga.
- **Hardware acceleration**: mantida ativada por padrão; só desative com `app.disableHardwareAcceleration()` se houver problemas em algum GPU.
