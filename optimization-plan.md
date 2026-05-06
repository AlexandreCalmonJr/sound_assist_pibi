# SoundMaster — Plano de Otimização & Correção

## Goal
Corrigir bugs, eliminar fragilidades e melhorar qualidade do código existente — sem adicionar funcionalidades.

## Tasks

### Fase 1: Bugs 🔴
- [x] **BUG-1**: `analyzer.js:611` — Usar `MixerService.cutFeedback()` ao invés de `socket.emit()` direto
- [x] **BUG-2**: `analyzer.js:682-684` — Mover `btnPink`, `btnSine`, `sineFreqInput` para dentro de `initAnalyzer()` (eram `null` no load global)
- [x] **BUG-3**: `database.js` vs `app-server.js:63` — Dois bancos de mappings separados. Unificado via `initDatabase(dbDir)`.
- [x] **BUG-4**: `mixer-actions.js:93` — Variável `ch` calculada mas nunca usada em `runCleanSoundPreset`. Removida.

### Fase 2: Fragilidade 🟡
- [x] **FRAG-1**: `app-server.js` — Tunnel retry limitado a 10 tentativas com backoff exponencial (5s→60s max)
- [x] **FRAG-2**: `ai.service.js` — setTimeout do ping agora tem clearTimeout no try e no catch
- [x] **FRAG-3**: `python-ai.js` — Verifica existência do script, tenta python/python3 fallback, loga exit codes, filtra stderr do uvicorn
- [x] **FRAG-4**: `python-ai.js` — `stopPythonAI` agora verifica `.killed` antes de matar (protege contra dupla chamada)
- [x] **FRAG-5**: `socket-handlers.js` — Tracking de conexões ativas + aviso ao usuário quando múltiplos clientes se conectam

### Fase 3: Qualidade 🟠
- [x] **QUAL-1**: `analyzer.js` — Encapsulado em IIFE com 'use strict', 20+ variáveis removidas do escopo global
- [x] **QUAL-2**: `analyzer.js` — Documentação técnica sobre createScriptProcessor deprecated + justificativa do fallback
- [x] **QUAL-3**: `socket-handlers.js` — try/catch adicionado em `set_afs_enabled` e `set_oscillator` (únicos handlers sem proteção)

## Done When
- [x] Nenhum uso direto de `socket` fora do SocketService
- [x] Banco de dados unificado
- [x] Tunnel com retry limitado
- [x] Processo Python protegido contra falhas
- [x] Todos os handlers de socket com try/catch
