/**
 * SoundMaster — app.js (refatorado)
 * Ponto de entrada da aplicação.
 *
 * ORDEM DE CARREGAMENTO dos scripts no index.html (atualizar conforme abaixo):
 *
 *   <!-- Store (deve ser o primeiro) -->
 *   <script src="js/store/app.store.js"></script>
 *
 *   <!-- Services (dependem do Store) -->
 *   <script src="js/services/socket.service.js"></script>
 *   <script src="js/services/mixer.service.js"></script>
 *   <script src="js/services/ai.service.js"></script>
 *
 *   <!-- Módulos de UI legados (não alterados) -->
 *   <script src="js/data.js"></script>
 *   <script src="js/analyzer.js"></script>
 *   <script src="js/layout.js"></script>
 *   <script src="js/church-tools.js"></script>
 *   <script src="js/mappings.js"></script>
 *
 *   <!-- UIs refatoradas (dependem de Services + Store) -->
 *   <script src="js/ui/mixer-panel.ui.js"></script>
 *   <script src="js/ui/ai-chat.ui.js"></script>
 *
 *   <!-- Inicialização (deve ser o último) -->
 *   <script src="js/app.js"></script>
 *
 * REMOVER do index.html os scripts antigos:
 *   - js/mixer-panel.js   → substituído por js/ui/mixer-panel.ui.js
 *   - js/ai-chat.js       → substituído por js/ui/ai-chat.ui.js
 */

document.addEventListener('DOMContentLoaded', async function () {

    // 1. Inicializar o Socket (conecta ao servidor Node.js)
    SocketService.init();

    // 2. Inicializar módulos de layout e ferramentas (não alterados)
    window.SoundMasterLayout?.init();
    window.SoundMasterChurchTools?.init();
    window.SoundMasterMappings?.init();
    window.SoundMasterMapping?.init();

    // 3. Inicializar UIs refatoradas
    //    (não precisam mais receber socket/callbacks como parâmetro)
    window.SoundMasterMixerPanel?.init();
    await window.SoundMasterAIChat?.init();

    // 4. Expor o socket raw para analyzer.js
    //    (analyzer.js ainda referencia `socket` globalmente para cut_feedback)
    //    Quando analyzer.js for refatorado, remover esta linha.
    window.socket = SocketService.raw();

    // 5. Configurar QR Code e link mobile
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        const mobileUrl = config.tunnelUrl || `http://${config.localIp}:${config.port}`;
        
        const qrImg = document.getElementById('mobile-qr-code');
        const linkEl = document.getElementById('mobile-url');
        
        if (qrImg) {
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(mobileUrl + '/mobile.html')}`;
        }
        if (linkEl) {
            linkEl.href = mobileUrl + '/mobile.html';
            linkEl.innerText = mobileUrl + '/mobile.html';
        }
    } catch (err) {
        console.error('[App] Erro ao carregar config de rede:', err);
    }

    console.log('[SoundMaster] Aplicação iniciada.');
});
