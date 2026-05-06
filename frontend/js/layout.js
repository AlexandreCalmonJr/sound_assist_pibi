(function () {
    'use strict';

    function initGlobalToggles() {
        const btnSidebar = document.getElementById('btn-toggle-sidebar');
        const btnMixer = document.getElementById('btn-toggle-mixer');
        const btnMain = document.getElementById('btn-toggle-main');
        
        const sidebar = document.getElementById('app-sidebar');
        const mixer = document.getElementById('app-mixer');
        const main = document.getElementById('app-main');

        const txtMixer = document.getElementById('txt-toggle-mixer');
        const txtMain = document.getElementById('txt-toggle-main');

        console.log('[Layout] Inicializando Toggles Globais...');

        // 1. Sidebar Toggle
        btnSidebar?.addEventListener('click', () => {
            console.log('[Layout] Toggle Sidebar');
            const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
            localStorage.setItem('sidebar-collapsed', isCollapsed);
        });

        // 2. Mixer Toggle
        btnMixer?.addEventListener('click', () => {
            console.log('[Layout] Toggle Mixer');
            const isCollapsed = document.body.classList.toggle('mixer-collapsed');
            if (txtMixer) {
                txtMixer.innerText = isCollapsed ? 'Mostrar Mixer' : 'Esconder Mixer';
            }
            localStorage.setItem('mixer-collapsed', isCollapsed);
        });

        // 3. Main/Center Toggle
        btnMain?.addEventListener('click', () => {
            console.log('[Layout] Toggle Main');
            const isCollapsed = document.body.classList.toggle('main-collapsed');
            if (txtMain) {
                txtMain.innerText = isCollapsed ? 'Mostrar Centro' : 'Esconder Centro';
            }
            localStorage.setItem('main-collapsed', isCollapsed);
        });

        // Carregar estados salvos
        if (localStorage.getItem('sidebar-collapsed') === 'true') document.body.classList.add('sidebar-collapsed');
        if (localStorage.getItem('mixer-collapsed') === 'true') {
            document.body.classList.add('mixer-collapsed');
            if (txtMixer) txtMixer.innerText = 'Mostrar Mixer';
        }
        if (localStorage.getItem('main-collapsed') === 'true') {
            document.body.classList.add('main-collapsed');
            if (txtMain) txtMain.innerText = 'Mostrar Centro';
        }
    }

    function initPageSpecifics() {
        // Abas do Analisador
        const analyzerTabButtons = document.querySelectorAll('.subtab-btn');
        const analyzerSubtabs = document.querySelectorAll('.analyzer-subtab');

        analyzerTabButtons.forEach(tab => {
            tab.addEventListener('click', () => {
                analyzerTabButtons.forEach(b => {
                    b.classList.remove('active', 'bg-slate-700', 'text-white');
                    b.classList.add('text-slate-400');
                });
                tab.classList.add('active', 'bg-slate-700', 'text-white');
                tab.classList.remove('text-slate-400');

                analyzerSubtabs.forEach(s => s.classList.add('hidden'));
                const target = document.getElementById(tab.getAttribute('data-subtab'));
                if (target) target.classList.remove('hidden');
            });
        });

        // --- Novo: Accordion da Sidebar ---
        document.querySelectorAll('.menu-trigger').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                const category = trigger.getAttribute('data-category');
                const content = trigger.nextElementSibling;
                const arrow = trigger.querySelector('.arrow-icon');
                
                // Fecha outros menus abertos (opcional, para manter limpo)
                /*
                document.querySelectorAll('.menu-content').forEach(c => {
                    if (c !== content) c.classList.add('hidden');
                });
                */

                const isHidden = content.classList.contains('hidden');
                if (isHidden) {
                    content.classList.remove('hidden');
                    if (arrow) arrow.style.transform = 'rotate(180deg)';
                } else {
                    content.classList.add('hidden');
                    if (arrow) arrow.style.transform = 'rotate(0deg)';
                }
            });
        });

        // Accordions genéricos e Links
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                if (content) {
                    const isOpen = content.style.display === 'block';
                    content.style.display = isOpen ? 'none' : 'block';
                }
            });
        });
    }

    // Inicialização do Shell (Executa uma vez no load)
    function init() {
        initGlobalToggles();
        initPageSpecifics();
    }

    window.SoundMasterLayout = { init };

    // Iniciar imediatamente
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Re-iniciar apenas o que for específico de página quando trocar de rota
    document.addEventListener('page-loaded', () => {
        initPageSpecifics();
    });
})();
