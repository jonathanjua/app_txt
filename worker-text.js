/**
 * Web Worker para processamento pesado de texto (ex.: ordenar linhas).
 * Evita travar a interface do Electron em arquivos muito grandes.
 */
self.onmessage = function (e) {
  const { type, text } = e.data || {};
  if (type !== 'sortLines' || typeof text !== 'string') {
    self.postMessage({ type: 'error', message: 'Dados inválidos' });
    return;
  }
  try {
    const lines = text.split(/\r?\n/);
    lines.sort();
    const result = lines.join('\n');
    self.postMessage({ type: 'done', result });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || 'Erro ao ordenar' });
  }
};
