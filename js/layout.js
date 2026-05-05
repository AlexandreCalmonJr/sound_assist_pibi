(function () {
    function initNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        const modules = document.querySelectorAll('.module');
        const sidebarToggle = document.getElementById('btn-sidebar-toggle');
        const panel = document.querySelector('.agent-panel');

        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                navButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const targetId = btn.getAttribute('data-target');
                modules.forEach(mod => {
                    mod.classList.toggle('active', mod.id === targetId);
                });
            });
        });

        sidebarToggle?.addEventListener('click', () => {
            if (!panel) return;
            panel.classList.toggle('collapsed');
            const collapsed = panel.classList.contains('collapsed');
            sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
            sidebarToggle.innerText = collapsed ? '☰' : '✕';
        });

        // Lógica para esconder o Agent Workspace e maximizar o Mixer
        const btnHideAgent = document.getElementById('btn-hide-agent');
        const btnShowAgent = document.getElementById('btn-show-agent');
        const agentWorkspace = document.getElementById('agent-workspace');

        if (btnHideAgent && btnShowAgent && agentWorkspace) {
            btnHideAgent.addEventListener('click', () => {
                agentWorkspace.classList.add('hidden');
                btnShowAgent.style.display = 'inline-block';
            });

            btnShowAgent.addEventListener('click', () => {
                agentWorkspace.classList.remove('hidden');
                btnShowAgent.style.display = 'none';
            });
        }
    }

    function initAnalyzerTabs() {
        const analyzerTabButtons = document.querySelectorAll('.subtab-btn');
        const analyzerSubtabs = document.querySelectorAll('.analyzer-subtab');

        analyzerTabButtons.forEach(tab => {
            tab.addEventListener('click', () => {
                analyzerTabButtons.forEach(b => b.classList.remove('active'));
                analyzerSubtabs.forEach(s => s.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(tab.getAttribute('data-subtab'))?.classList.add('active');
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
        initNavigation();
        initAnalyzerTabs();
        initExternalLinks();
        initAccordion();
    }

    window.SoundMasterLayout = { init };
})();
