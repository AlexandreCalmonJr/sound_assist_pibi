/**
 * SoundMaster — app.js (refatorado v2)
 * Ponto de entrada da aplicação.
 * Carrega componentes do shell, inicializa serviços e roteador.
 */

document.addEventListener('DOMContentLoaded', async function () {
    console.log('[SoundMaster] Inicializando App Shell v2...');

    // 1. Load shell components
    const loadComponent = async (id, path) => {
        try {
            const res = await fetch(path);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

    // 2. Init layout (sidebar, toggles, breadcrumbs) — must run AFTER sidebar HTML is loaded
    if (window.SoundMasterLayout) {
        window.SoundMasterLayout.init();
    }

    // 3. Init Socket & Services
    if (typeof SocketService !== 'undefined') {
        SocketService.init();
        window.socket = SocketService.raw();
    }

    // 4. Init Mixer Panel
    if (window.SoundMasterMixerPanel) {
        window.SoundMasterMixerPanel.init();
    }

    // 5. Navigate to Home
    if (window.router) {
        window.router.navigate('home');
    }

    console.log('[SoundMaster] App Shell v2 inicializado com sucesso.');
});
