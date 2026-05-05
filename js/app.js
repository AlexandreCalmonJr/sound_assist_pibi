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
    console.log('[SoundMaster] Inicializando serviços e Shell...');

    // 1. Carregar Componentes Globais do Shell
    const loadComponent = async (id, path) => {
        try {
            const res = await fetch(path);
            const container = document.getElementById(id);
            if (container) container.innerHTML = await res.text();
        } catch (err) {
            console.error(`[SoundMaster] Erro ao carregar componente ${id}:`, err);
        }
    };

    await Promise.all([
        loadComponent('app-sidebar', 'components/sidebar.html'),
        loadComponent('app-mixer', 'components/mixer-panel.html')
    ]);

    // 2. Inicializar o Socket e Serviços
    SocketService.init();
    window.socket = SocketService.raw();

    // 3. Inicializar Componentes do Shell (que não mudam)
    if (window.SoundMasterMixerPanel) {
        window.SoundMasterMixerPanel.init();
    }

    // 4. Iniciar o Roteador SPA e carregar a Home
    if (window.router) {
        window.router.navigate('home');
    }

    // 5. Controle Global do Título da Página
    document.addEventListener('page-loaded', (e) => {
        const titles = {
            'home': 'Dashboard',
            'analyzer': 'Analisador de Áudio',
            'eq': 'Guia de Equalização',
            'rt60': 'Cálculo Acústico',
            'ai-chat': 'Assistente IA Local',
            'mobile': 'Modo Remoto'
        };
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.innerText = titles[e.detail.pageId] || 'SoundMaster';
    });

    // 6. Controle do Painel do Mixer (Toggle)
    const btnToggleMixer = document.getElementById('btn-toggle-mixer');
    const appMixer = document.getElementById('app-mixer');
    let mixerVisible = true;

    if (btnToggleMixer && appMixer) {
        btnToggleMixer.addEventListener('click', () => {
            mixerVisible = !mixerVisible;
            if (mixerVisible) {
                appMixer.style.width = '400px';
                appMixer.style.opacity = '1';
                btnToggleMixer.innerHTML = 'Ocultar Mixer ➡️';
            } else {
                appMixer.style.width = '0px';
                appMixer.style.opacity = '0';
                btnToggleMixer.innerHTML = '⬅️ Mostrar Mixer';
            }
        });
    }

    console.log('[SoundMaster] App Shell inicializado com sucesso.');
});
