/**
 * SoundMaster — layout.js
 * Controls the new two-panel sidebar, category flyout, breadcrumbs, and global toggles.
 */
(function () {
    'use strict';

    // Category → sub-items mapping
    const CATEGORIES = {
        measure: {
            title: 'Medir',
            items: [
                { id: 'rt60',         label: 'RT60 & Acústica' },
                { id: 'benchmarking', label: 'Benchmarking' },
                { id: 'spl-heatmap',  label: 'Mapa de Calor SPL' },
            ]
        },
        analysis: {
            title: 'Análise do Som',
            items: [
                { id: 'analyzer',          label: 'FFT & Waterfall' },
                { id: 'feedback-detector', label: 'Detector Feedback' },
                { id: 'eq-guide',          label: 'Guia de EQ' },
            ]
        },
        mixer: {
            title: 'Mixer',
            items: [
                { id: 'mixer-input',   label: 'Canais de Entrada' },
                { id: 'mixer-aux',     label: 'Monitores & Aux' },
                { id: 'mixer-fx',      label: 'Envios de Efeito' },
                { id: 'voice-presets', label: 'Presets de Voz' },
            ]
        },
        network: {
            title: 'Rede & Sistemas',
            items: [
                { id: 'systems', label: 'Conexão Ui24R' },
                { id: 'aes67',   label: 'Saúde de Cabos (AES67)' },
            ]
        },
        settings: {
            title: 'Configurações',
            items: [
                { id: 'settings', label: 'Preferências' },
            ]
        },
        training: {
            title: 'Centro de Treino',
            items: [
                { id: 'tutorials-library',  label: 'Biblioteca Técnica' },
                { id: 'tutorials-workflow', label: 'Workflow Pro' },
                { id: 'tutorials-tools',    label: 'Ferramentas IA' },
            ]
        }
    };

    let activeCategory = null;

    function initSidebar() {
        const panel = document.getElementById('category-panel');
        const panelTitle = document.getElementById('panel-title');
        const panelNav = document.getElementById('panel-nav');
        const sidebar = document.getElementById('app-sidebar');

        if (!panel || !panelNav) return;

        // Handle rail button clicks
        document.querySelectorAll('.rail-btn').forEach(btn => {

            // Direct navigation buttons (home, tutorials, ai-chat, mobile)
            if (btn.hasAttribute('data-direct')) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = btn.getAttribute('data-target');

                    // Close category panel
                    panel.classList.remove('open');
                    sidebar?.classList.remove('panel-open');
                    activeCategory = null;

                    // Clear category rail active states
                    document.querySelectorAll('.rail-btn[data-category]').forEach(b => b.classList.remove('active'));

                    // Navigate
                    if (window.router) {
                        window.router.navigate(target);
                    }
                });
                return;
            }

            // Category buttons (open/close flyout panel)
            const category = btn.getAttribute('data-category');
            if (category && CATEGORIES[category]) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();

                    if (activeCategory === category) {
                        // Toggle off — close panel
                        panel.classList.remove('open');
                        sidebar?.classList.remove('panel-open');
                        btn.classList.remove('active');
                        activeCategory = null;
                        return;
                    }

                    // Open panel with this category's items
                    activeCategory = category;
                    const catData = CATEGORIES[category];

                    // Update panel title
                    if (panelTitle) panelTitle.textContent = catData.title;

                    // Build nav items
                    panelNav.innerHTML = catData.items.map(item => `
                        <button class="panel-nav-btn ${window.router?.currentPage === item.id ? 'active' : ''}" 
                                data-target="${item.id}">
                            <span class="nav-dot"></span>
                            ${item.label}
                        </button>
                    `).join('');

                    // Show panel
                    panel.classList.add('open');
                    sidebar?.classList.add('panel-open');

                    // Update rail active states
                    document.querySelectorAll('.rail-btn[data-category]').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.rail-btn[data-direct]').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            }
        });
    }

    function initGlobalToggles() {
        const btnSidebar = document.getElementById('btn-toggle-sidebar');
        const btnMixer = document.getElementById('btn-toggle-mixer');
        const btnMain = document.getElementById('btn-toggle-main');
        const txtMixer = document.getElementById('txt-toggle-mixer');

        btnSidebar?.addEventListener('click', () => {
            const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
            localStorage.setItem('sidebar-collapsed', isCollapsed);
        });

        btnMixer?.addEventListener('click', () => {
            const isCollapsed = document.body.classList.toggle('mixer-collapsed');
            if (txtMixer) {
                txtMixer.innerText = isCollapsed ? 'Mostrar' : 'Mixer';
            }
            localStorage.setItem('mixer-collapsed', isCollapsed);
        });

        btnMain?.addEventListener('click', () => {
            document.body.classList.toggle('main-collapsed');
        });

        // Restore saved states
        if (localStorage.getItem('sidebar-collapsed') === 'true') {
            document.body.classList.add('sidebar-collapsed');
        }
        if (localStorage.getItem('mixer-collapsed') === 'true') {
            document.body.classList.add('mixer-collapsed');
            if (txtMixer) txtMixer.innerText = 'Mostrar';
        }
    }

    function initBreadcrumbs() {
        document.addEventListener('page-loaded', (e) => {
            const { title, category } = e.detail;
            const catEl = document.getElementById('breadcrumb-category');
            const sepEl = document.getElementById('breadcrumb-sep');
            const pageEl = document.getElementById('breadcrumb-page');

            if (category) {
                if (catEl) { catEl.textContent = category; catEl.style.display = ''; }
                if (sepEl) sepEl.style.display = '';
                if (pageEl) pageEl.textContent = title;
            } else {
                if (catEl) catEl.style.display = 'none';
                if (sepEl) sepEl.style.display = 'none';
                if (pageEl) pageEl.textContent = title;
            }
        });
    }

    // Auto-expand the correct category panel when navigating via cards/links
    function initAutoExpand() {
        document.addEventListener('page-loaded', (e) => {
            const { pageId, category } = e.detail;
            if (!category) return;

            const categoryMap = {
                'Medir': 'measure',
                'Análise': 'analysis',
                'Mixer': 'mixer',
                'Rede': 'network',
                'Treino': 'training',
                'Configurações': 'settings'
            };
            const catId = categoryMap[category];
            if (!catId || activeCategory === catId) return;

            // Simulate clicking the category rail button to open the panel
            const railBtn = document.querySelector(`.rail-btn[data-category="${catId}"]`);
            if (railBtn) railBtn.click();
        });
    }

    function initPageSpecifics() {
        // Analyzer subtabs
        document.querySelectorAll('.subtab-btn').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.subtab-btn').forEach(b => {
                    b.classList.remove('active', 'bg-slate-700', 'text-white');
                    b.classList.add('text-slate-400');
                });
                tab.classList.add('active', 'bg-slate-700', 'text-white');
                tab.classList.remove('text-slate-400');

                document.querySelectorAll('.analyzer-subtab').forEach(s => s.classList.add('hidden'));
                const target = document.getElementById(tab.getAttribute('data-subtab'));
                if (target) target.classList.remove('hidden');
            });
        });

        // Generic accordions
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                if (content) {
                    content.style.display = content.style.display === 'block' ? 'none' : 'block';
                }
            });
        });
    }

    function init() {
        initSidebar();
        initGlobalToggles();
        initBreadcrumbs();
        initAutoExpand();
        initPageSpecifics();
    }

    window.SoundMasterLayout = { init };

    // NOTE: init() is called explicitly by app.js AFTER sidebar HTML is loaded.
    // Do NOT auto-init here — the sidebar DOM doesn't exist yet.

    // Re-init page-specific logic on route change
    document.addEventListener('page-loaded', () => {
        initPageSpecifics();
    });
})();
