# Mobile Optimization — Plano de Correção

## Goal
Corrigir bugs, fragilidades e qualidade no fluxo mobile (frontend + backend bridge) — sem adicionar funcionalidades.

## Tasks

### Fase 1: Bugs 🔴
- [x] **MBUG-1**: 12+ variáveis de DOM referenciando IDs que NÃO existem no HTML. Removidas declarações e listeners fantasmas.
- [x] **MBUG-2**: `updateConnection()` usava 5 variáveis não declaradas. Função e chamadas removidas.
- [x] **MBUG-3**: `socket.emit('cut_feedback')` substituído para usar padrão consistente com log de atividade.
- [x] **MBUG-4**: Acesso a `micStatusText` que gerava `TypeError` removido do fluxo do microfone.
- [x] **MBUG-5**: `stopMic()` agora valida a existência do alerta antes de tentar acessá-lo.

### Fase 2: Fragilidade 🟡
- [x] **MFRAG-1**: `setInterval(measureLatency, 3000)` agora guarda referência e dá `clearInterval` na desconexão.
- [x] **MFRAG-2**: `analyzeMic()` teve a alocação de `Uint8Array` e `Float32Array` elevada para fora do requestAnimationFrame (menos GC pressure a 60fps).
- [x] **MFRAG-3**: `globalAlpha` foi checado e está resetando corretamente no fim de `drawAnalyzer()`.
- [x] **MFRAG-4**: `setupMobileTouchFader()` agora chama `e.preventDefault()` prevenindo "bounce" ou scroll indesejado ao mover o fader.

### Fase 3: Qualidade 🟠
- [x] **MQUAL-1**: `mobile.js` (900+ linhas) encapsulado inteiramente em uma IIFE para não poluir window/global.
- [x] **MQUAL-2**: Códigos e botões mortos do desktop que estavam injetados no mobile foram extirpados.
- [x] **MQUAL-3**: Padronização da ponte com o servidor usando `emitMobileTool()` que já cuida dos logs.

## Done When
- [x] Nenhuma variável referenciando ID inexistente
- [x] Mic start/stop funciona sem TypeError
- [x] Código morto removido
- [x] GC pressure reduzido no animation loop
