(function () {

    function initSidebar() {
        const sidebarToggle = document.getElementById('btn-sidebar-toggle');
        const sidebar = document.querySelector('.agent-panel');
        
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                const isCollapsed = sidebar.classList.contains('collapsed');
                sidebarToggle.innerText = isCollapsed ? '☰' : '✕';
            });
        }
    }

    function initAnalyzerTabs() {
        const analyzerTabButtons = document.querySelectorAll('.subtab-btn');
        const analyzerSubtabs = document.querySelectorAll('.analyzer-subtab');

        analyzerTabButtons.forEach(tab => {
            tab.addEventListener('click', () => {
                // Update buttons
                analyzerTabButtons.forEach(b => {
                    b.classList.remove('active', 'bg-slate-700', 'text-white');
                    b.classList.add('text-slate-400');
                });
                tab.classList.add('active', 'bg-slate-700', 'text-white');
                tab.classList.remove('text-slate-400');

                // Update subtabs
                analyzerSubtabs.forEach(s => s.classList.add('hidden'));
                const target = document.getElementById(tab.getAttribute('data-subtab'));
                if (target) target.classList.remove('hidden');
            });
        });
    }

    function initExternalLinks() {
        document.querySelectorAll('.resource-card, .link-btn').forEach(button => {
            button.addEventListener('click', () => {
                const url = button.getAttribute('data-url');
                if (url) window.open(url, '_blank');
            });
        });
    }

    function initAccordion() {
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                const isOpen = content.style.display === 'block';
                content.style.display = isOpen ? 'none' : 'block';
                header.style.backgroundColor = isOpen ? 'var(--surface-2)' : 'var(--surface-3)';
            });
        });

        document.querySelectorAll('.accordion-content').forEach(content => {
            content.style.display = 'none';
        });
    }

    function init() {
        initSidebar();
        initAnalyzerTabs();
        initExternalLinks();
        initAccordion();
    }

    window.SoundMasterLayout = { init };

    // Ouvir eventos do roteador para re-inicializar elementos da interface
    document.addEventListener('page-loaded', (e) => {
        init();
    });
})();
