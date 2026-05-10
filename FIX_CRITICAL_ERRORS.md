# 📋 PLANO DE AÇÃO - CORREÇÃO DE ERROS CRÍTICOS
## Sound Assist - PIBI Project
**Data de Início:** 9 de maio de 2026

---

## ⚠️ RESUMO CRÍTICO

**8 erros CRÍTICOS encontrados** - Bloqueiam produção  
**Tempo estimado de correção:** 3-4 dias de desenvolvimento  
**Prioridade:** 🔴 MÁXIMA

---

## 📅 CRONOGRAMA RECOMENDADO

### DIA 1 (4-5 horas)
- [ ] Correção 1: CORS em backend
- [ ] Correção 2: CORS em app-server  
- [ ] Correção 3: Autenticação na IA
- [ ] Testes unitários para acima

### DIA 2 (4-5 horas)
- [ ] Correção 4: XSS Prevention
- [ ] Correção 5: Rate Limiting
- [ ] Testes e validação

### DIA 3 (4 horas)
- [ ] Correção 6: Race Condition Mixer
- [ ] Correção 7: Tunnel Authentication
- [ ] Testes integração

### DIA 4 (3-4 horas)
- [ ] Correção 8: Memory Leak Audio
- [ ] Testes e validação
- [ ] Deploy em staging

### DIA 5 (2 horas)
- [ ] Smoke tests
- [ ] Correções de bugs encontrados
- [ ] Documentação de mudanças

---

## 🔴 ERRO CRÍTICO 1: CORS Aberto em Backend

**Arquivo:** `backend/ai/ai_server.py`  
**Tempo:** 15 minutos  
**Risco:** Ataque CSRF, acesso não autorizado

### Passo 1: Abra o arquivo
```bash
cd backend/ai
code ai_server.py
```

### Passo 2: Localize a linha com CORS
```python
# Procure por: app.add_middleware(CORSMiddleware
```

### Passo 3: Substitua o CORS middleware
**Remova:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Substitua por:**
```python
import os
from dotenv import load_dotenv

load_dotenv()

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "127.0.0.1:3000",
    "127.0.0.1:3001",
    os.getenv("FRONTEND_URL", "http://localhost:3000")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=3600,
)
```

### Passo 4: Adicione em `backend/ai/.env`
```env
FRONTEND_URL=http://localhost:3000
AI_API_KEY=sua-chave-secreta-aqui
```

### Passo 5: Teste localmente
```bash
# Adicione em um arquivo teste_cors.py:
import requests

headers = {
    'Origin': 'http://attack.com',
    'Content-Type': 'application/json'
}

# Isto deve FALHAR (retornar 403 ou sem header CORS)
response = requests.post('http://localhost:3002/chat', headers=headers)
print(response.headers)
```

---

## 🔴 ERRO CRÍTICO 2: CORS Aberto em Socket.IO

**Arquivo:** `src/server/app-server.js`  
**Tempo:** 15 minutos  
**Risco:** Conexão não autorizada ao Socket.IO

### Passo 1: Localize Socket.IO CORS
```bash
cd src/server
code app-server.js
# Procure: new Server(server, {
```

### Passo 2: Encontre a configuração
```javascript
const io = new Server(server, {
    cors: {
        origin: '*',  // ← ISTO
        methods: ['GET', 'POST']
    }
});
```

### Passo 3: Substitua por
```javascript
const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    process.env.FRONTEND_URL || 'http://localhost:3000'
];

const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true,
        allowEIO3: true
    },
    maxHttpBufferSize: 1e6,
    transports: ['websocket']
});
```

### Passo 4: Valide token de autenticação
```javascript
// Adicione validação na conexão
io.on('connection', (socket) => {
    const token = socket.handshake.auth.token;
    const socketOrigin = socket.handshake.headers.origin;
    
    logger.info(socket.id, 'NEW_CONNECTION', { origin: socketOrigin });
    
    // Validar origem se token não fornecido
    if (!ALLOWED_ORIGINS.includes(socketOrigin) && !token) {
        logger.warn(socket.id, 'BLOCKED_INVALID_ORIGIN', { origin: socketOrigin });
        socket.disconnect();
        return;
    }
});
```

---

## 🔴 ERRO CRÍTICO 3: Sem Autenticação em Endpoints IA

**Arquivo:** `backend/ai/ai_server.py`  
**Tempo:** 30 minutos

### Passo 1: Instale FastAPI Security
```bash
cd backend/ai
pip install fastapi[security]
```

### Passo 2: Adicione imports
```python
from fastapi.security import APIKeyHeader
from fastapi import Depends, HTTPException, status
import os
```

### Passo 3: Crie função de verificação
```python
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str = Depends(api_key_header)):
    """Verifica se API Key é válida"""
    valid_key = os.getenv("AI_API_KEY")
    
    if not valid_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Servidor não configurado"
        )
    
    if api_key != valid_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API Key inválida ou ausente"
        )
    
    return True
```

### Passo 4: Proteja endpoints
```python
@app.post("/chat")
async def chat_endpoint(
    request: ChatRequest, 
    authenticated: bool = Depends(verify_api_key)
):
    return ai_engine.process(request.message, request.analysis)

@app.post("/train")
async def train_endpoint(
    data: TrainRequest,
    authenticated: bool = Depends(verify_api_key)
):
    return ai_engine.train(data)

@app.post("/analyze-feedback")
async def analyze_feedback(
    feedback_data: FeedbackAnalysisRequest,
    authenticated: bool = Depends(verify_api_key)
):
    return ai_engine.analyze_feedback(feedback_data)
```

### Passo 5: Teste com curl
```bash
# Isto deve FALHAR
curl -X POST http://localhost:3002/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'

# Isto deve SUCEDER
curl -X POST http://localhost:3002/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sua-chave-secreta" \
  -d '{"message":"test"}'
```

---

## 🔴 ERRO CRÍTICO 4: XSS via innerHTML

**Arquivo:** `frontend/js/core/router.js`  
**Tempo:** 20 minutos

### Passo 1: Localize função navigate
```bash
cd frontend/js/core
code router.js
# Procure: container.innerHTML = html
```

### Passo 2: Substitua por DOMParser
**Encontre:**
```javascript
async navigate(pageId) {
    const response = await fetch(this.routes[pageId]);
    const html = await response.text();
    const container = document.getElementById('agent-workspace');
    container.innerHTML = html; // ❌ REMOVE ISTO
}
```

**Substitua por:**
```javascript
async navigate(pageId) {
    if (!this.routes[pageId]) {
        console.error(`Página não encontrada: ${pageId}`);
        return;
    }

    try {
        const response = await fetch(this.routes[pageId]);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        
        // ✅ Usar DOMParser para sanitização
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Verificar erros de parsing
        if (doc.body.textContent.includes('html>') || doc.body.textContent.includes('DOCTYPE')) {
            throw new Error('Erro ao fazer parse do HTML');
        }
        
        const container = document.getElementById('agent-workspace');
        
        // ✅ Substituir com segurança
        container.replaceChildren();
        
        // Copiar cada elemento parseado
        Array.from(doc.body.children).forEach(child => {
            container.appendChild(child.cloneNode(true));
        });
        
        // Emitir evento de página carregada
        this.updateActiveLinks(pageId);
        this.notifyPageChange(pageId);
        
    } catch (error) {
        console.error('[Router] Erro ao navegar:', error);
        container.innerHTML = `<div class="error">Erro ao carregar página: ${error.message}</div>`;
    }
}
```

### Passo 3: Teste
```javascript
// Abra console (F12) e teste:
router.navigate('home');
// Deve carregar sem erros
```

---

## 🔴 ERRO CRÍTICO 5: Rate Limiting Ausente

**Arquivo:** `src/server/socket-handlers.js`  
**Tempo:** 40 minutos

### Passo 1: Instale bibliotecas
```bash
cd src
npm install express-rate-limit socket.io-rate-limit
```

### Passo 2: Importe no app-server.js
```javascript
const rateLimit = require('express-rate-limit');
const socketRateLimit = require('socket.io-rate-limit').default;
```

### Passo 3: Configure rate limiting HTTP
```javascript
// Em app-server.js, antes de rotas
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requisições
    message: 'Muitas requisições, tente mais tarde',
    standardHeaders: true,
    legacyHeaders: false,
});

expressApp.use('/api/', apiLimiter);
```

### Passo 4: Configure rate limiting Socket.IO
```javascript
const ioRateLimit = socketRateLimit.rateLimit({
    store: new socketRateLimit.MemoryStore(),
    points: 5, // 5 eventos
    duration: 1, // por segundo
    blockDuration: 2, // bloquear por 2 segundos se exceder
});

io.on('connection', (socket) => {
    socket.on('set_master_level', async (data) => {
        try {
            await ioRateLimit.consume(socket.id, 1);
            // Executar comando
            mixer.master.setFaderLevel(data.level);
        } catch (rejRes) {
            console.warn(`Rate limit excedido para ${socket.id}`);
            socket.emit('error', 'Muitas requisições, aguarde');
        }
    });
});
```

### Passo 5: Teste
```bash
# Criar múltiplas requisições rápidas
for i in {1..200}; do
  curl http://localhost:3001/api/test
done

# Após 100, deve retornar 429 (Too Many Requests)
```

---

## 🔴 ERRO CRÍTICO 6: Race Condition Mixer

**Arquivo:** `src/server/socket-handlers.js`  
**Tempo:** 30 minutos

### Passo 1: Localize variável global mixer
```javascript
// Procure no arquivo:
let mixer = null; // ← ISTO
```

### Passo 2: Mude para escopo local
```javascript
// REMOVA:
let mixer = null; // ← DELETE ISTO

// ADICIONE ISTO em io.on('connection'):
io.on('connection', (socket) => {
    // Cada socket tem seu próprio mixer
    let mixerInstance = null;
    
    socket.on('connect_mixer', async (ip) => {
        try {
            mixerInstance = new SoundcraftUI(ip);
            socket.emit('mixer_connected', { status: 'ok' });
        } catch (err) {
            socket.emit('error', `Falha ao conectar mixer: ${err.message}`);
        }
    });
    
    socket.on('set_master_level', (data) => {
        if (!mixerInstance) {
            return socket.emit('error', 'Mixer não conectado');
        }
        mixerInstance.master.setFaderLevel(data.level);
    });
    
    socket.on('disconnect', () => {
        if (mixerInstance) {
            try {
                mixerInstance.disconnect();
            } catch (e) {
                console.error('Erro ao desconectar mixer:', e);
            }
            mixerInstance = null;
        }
    });
});
```

### Passo 3: Teste com 2 clientes
```javascript
// Cliente 1: conecta ao mixer
socket1.emit('connect_mixer', '192.168.1.100');

// Cliente 2: conecta a outro mixer
socket2.emit('connect_mixer', '192.168.1.101');

// Ambos devem funcionar independentemente
```

---

## 🔴 ERRO CRÍTICO 7: Tunnel sem Autenticação

**Arquivo:** `src/server/app-server.js`  
**Tempo:** 45 minutos

### Passo 1: Gere token aleatório
```javascript
const crypto = require('crypto');

function generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
}
```

### Passo 2: Adicione autenticação no tunnel
```javascript
let tunnelToken = null;

async function startTunnel() {
    tunnelToken = generateSecureToken();
    
    const tunnel = await localtunnel({
        port: process.env.PORT,
        subdomain: process.env.TUNNEL_SUBDOMAIN
    });
    
    console.log('🌐 Tunnel iniciado');
    console.log(`🔐 URL Pública: ${tunnel.url}`);
    console.log(`🔑 Token: ${tunnelToken}`);
    console.log(`⚠️  Compartilhe APENAS esta URL completa com token`);
    console.log(`\n📱 URL para Mobile: ${tunnel.url}?token=${tunnelToken}`);
    
    return tunnel;
}
```

### Passo 3: Valide token no Socket.IO
```javascript
io.on('connection', (socket) => {
    // Se vindo de tunnel, validar token
    const isLocalhost = socket.handshake.address === '127.0.0.1' || 
                        socket.handshake.address === '::1';
    
    if (!isLocalhost) {
        // Vindo de internet - validar token
        const token = socket.handshake.auth.token || 
                     new URL(`http://localhost${socket.handshake.url}`).searchParams.get('token');
        
        if (!token || token !== tunnelToken) {
            console.warn(`❌ Acesso negado: token inválido de ${socket.handshake.address}`);
            socket.disconnect();
            return;
        }
    }
    
    console.log(`✅ ${socket.id} conectado`);
});
```

### Passo 4: Teste
```bash
# Localmente (sem token requerido)
curl http://localhost:3001

# Via tunnel com token inválido
curl https://seu-subdomain.loca.lt/
# Deve retornar erro

# Via tunnel com token válido
curl "https://seu-subdomain.loca.lt/?token=SEUTOKEM"
# Deve funcionar
```

---

## 🔴 ERRO CRÍTICO 8: Memory Leak em Audio API

**Arquivo:** `frontend/js/analyzer.js`  
**Tempo:** 45 minutos

### Passo 1: Localize startAnalyzer
```javascript
// Procure: async function startAnalyzer()
```

### Passo 2: Adicione cleanup completo
```javascript
// ADICIONE NO TOPO DO ARQUIVO:
let audioCtx = null;
let stream = null;
let analyser = null;
let source = null;
let animationId = null;

// FUNÇÃO DE CLEANUP
async function stopAnalyzer() {
    return new Promise(resolve => {
        console.log('[Analyzer] Limpando recursos de audio');
        
        // 1. Parar animation frame
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        // 2. Desconectar nós de audio
        try {
            if (source) {
                source.disconnect();
                source = null;
            }
            if (analyser) {
                analyser.disconnect();
                analyser = null;
            }
        } catch (e) {
            console.warn('[Analyzer] Erro ao desconectar nós:', e);
        }
        
        // 3. Fechar AudioContext
        if (audioCtx && audioCtx.state !== 'closed') {
            console.log('[Analyzer] Fechando AudioContext');
            audioCtx.close();
            audioCtx = null;
        }
        
        // 4. Parar stream de mídia
        if (stream) {
            stream.getTracks().forEach(track => {
                console.log(`[Analyzer] Parando track: ${track.kind}`);
                track.stop();
            });
            stream = null;
        }
        
        // Aguardar garbage collection
        setTimeout(resolve, 100);
    });
}

// FUNÇÃO START ATUALIZADA
async function startAnalyzer() {
    try {
        // Limpar primeira
        await stopAnalyzer();
        
        console.log('[Analyzer] Iniciando analisador');
        
        // Criar stream
        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: false
            }
        });
        
        // Criar contexto
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        
        // Setup nodes
        source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        
        // Iniciar desenho
        animationId = requestAnimationFrame(drawAnalyzer);
        
        console.log('[Analyzer] ✅ Analisador pronto');
        
    } catch (error) {
        console.error('[Analyzer] Erro ao iniciar:', error);
        
        if (error.name === 'NotAllowedError') {
            alert('Permissão negada. Ative microfone nas configurações.');
        } else if (error.name === 'NotFoundError') {
            alert('Nenhum microfone encontrado.');
        } else {
            alert(`Erro: ${error.message}`);
        }
        
        await stopAnalyzer();
    }
}

// LIMPAR AO UNLOAD
window.addEventListener('beforeunload', async () => {
    await stopAnalyzer();
});

// LIMPAR AO NAVEGAR
document.addEventListener('navigationstop', async () => {
    await stopAnalyzer();
});
```

### Passo 3: Verifique DevTools
```
1. Abra DevTools (F12)
2. Vá a Memory tab
3. Clique "Take heap snapshot" - anote tamanho
4. Clique "Start analyzer" - observe
5. Clique "Stop analyzer"
6. Novamente "Take heap snapshot" - compare
7. Tamanho deve ser similar (vazamento corrigido!)
```

---

## ✅ VALIDAÇÃO FINAL

Após fazer todas as correções:

```bash
# 1. Teste de segurança básica
curl -v -H "Origin: http://attacker.com" http://localhost:3002

# 2. Teste de autenticação
curl -X POST http://localhost:3002/chat
# Deve retornar 403 Forbidden

# 3. Teste de memory leak
# Abrir DevTools, rodar analyzer 10x
# Memória deve ser estável

# 4. Teste de rate limit
# Enviar 150 requisições rápidas
# Deve bloquear após 100

# 5. Teste Socket.IO
# Conectar de origem diferente
# Deve ser bloqueado
```

---

## 📊 CHECKLIST DE CONCLUSÃO

- [ ] CORS corrigido em ai_server.py
- [ ] CORS corrigido em app-server.js
- [ ] Autenticação adicionada em endpoints IA
- [ ] XSS Prevention implementada no router
- [ ] Rate Limiting implementado
- [ ] Race condition do mixer corrigida
- [ ] Token de tunnel adicionado
- [ ] Memory leak do audio corrigido
- [ ] Testes manuais passando
- [ ] Deploy em staging OK
- [ ] Documentação atualizada

---

## 🎯 PRÓXIMAS ETAPAS

1. **Hoje:** Fazer correções CRÍTICAS 1-3
2. **Amanhã:** Fazer correções CRÍTICAS 4-5
3. **Dia 3:** Fazer correções CRÍTICAS 6-7
4. **Dia 4:** Fazer correção CRÍTICA 8 + testes
5. **Dia 5:** Deploy e validação

---

## 📞 REFERÊNCIAS

- [OWASP Security Guidelines](https://owasp.org/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Socket.IO Security](https://socket.io/docs/v4/socket-io-security/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

---

**Documento de Planejamento**  
**Data:** 9 de maio de 2026  
**Status:** 📋 Pronto para Implementação
