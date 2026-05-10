/**
 * SoundMaster SPA Router
 * Manages dynamic page loading with transitions and breadcrumb data.
 */

const ROUTE_MAP = {
    'home':              { path: 'pages/home.html',              title: 'Dashboard',           category: null },
    'tutorials':         { path: 'pages/tutorials.html',         title: 'Treinamento',         category: null },
    'rt60':              { path: 'pages/rt60.html',              title: 'RT60 & Acústica',     category: 'Medir' },
    'benchmarking':      { path: 'pages/benchmarking.html',      title: 'Benchmarking',        category: 'Medir' },
    'spl-heatmap':       { path: 'pages/spl-heatmap.html',       title: 'Mapa SPL',            category: 'Medir' },
    'analyzer':          { path: 'pages/analyzer.html',          title: 'FFT & Waterfall',     category: 'Análise' },
    'feedback-detector': { path: 'pages/feedback-detector.html', title: 'Detector Feedback',   category: 'Análise' },
    'eq-guide':          { path: 'pages/eq-guide.html',          title: 'Guia de EQ',          category: 'Análise' },
    'eq':                { path: 'pages/eq.html',                title: 'Equalização',         category: 'Análise' },
    'mixer-input':       { path: 'pages/mixer-input.html',       title: 'Canais de Entrada',   category: 'Mixer' },
    'mixer-aux':         { path: 'pages/mixer-aux.html',         title: 'Monitores & Aux',     category: 'Mixer' },
    'mixer-fx':          { path: 'pages/mixer-fx.html',          title: 'Efeitos',             category: 'Mixer' },
    'voice-presets':     { path: 'pages/voice-presets.html',      title: 'Presets de Voz',      category: 'Mixer' },
    'systems':           { path: 'pages/systems.html',           title: 'Conexão Ui24R',       category: 'Rede' },
    'aes67':             { path: 'pages/aes67.html',             title: 'Saúde de Cabos',      category: 'Rede' },
    'ai-chat':           { path: 'pages/ai-chat.html',           title: 'Assistente IA',       category: null },
    'mobile':            { path: 'pages/mobile.html',            title: 'Modo Remoto',         category: null },
    'settings':          { path: 'pages/settings.html',          title: 'Configurações',       category: null },
};

class Router {
    constructor() {
        this.currentPage = null;
        this.routes = {};

        // Build simple route map for backward compat
        for (const [id, data] of Object.entries(ROUTE_MAP)) {
            this.routes[id] = data.path;
        }

        // Click delegation for nav buttons
        document.addEventListener('click', (e) => {
            const navBtn = e.target.closest('[data-target]');
            if (navBtn && this.routes[navBtn.getAttribute('data-target')]) {
                const target = navBtn.getAttribute('data-target');
                this.navigate(target);
            }
        });
    }

    async navigate(pageId) {
        if (this.currentPage === pageId) return;
        if (!ROUTE_MAP[pageId]) {
            console.warn(`[Router] Rota desconhecida: ${pageId}`);
            return;
        }

        const container = document.getElementById('agent-workspace');
        if (!container) return;

        try {
            console.log(`[Router] Navegando para: ${pageId}`);

            // Exit animation
            container.classList.remove('page-enter');
            container.classList.add('page-exit');
            await this._wait(200);

            // Fetch new page
            const response = await fetch(this.routes[pageId]);
            if (!response.ok) throw new Error(`Erro ao carregar: ${pageId}`);

            const html = await response.text();
            container.innerHTML = html;
            this.currentPage = pageId;

            // Enter animation
            container.classList.remove('page-exit');
            container.classList.add('page-enter');

            // Update sidebar active states
            this.updateActiveLinks(pageId);

            // Dispatch page-loaded event with route metadata
            const routeData = ROUTE_MAP[pageId];
            document.dispatchEvent(new CustomEvent('page-loaded', {
                detail: {
                    pageId,
                    title: routeData.title,
                    category: routeData.category
                }
            }));

            // Cleanup animation class after it completes
            setTimeout(() => container.classList.remove('page-enter'), 400);

        } catch (error) {
            console.error('[Router] Erro na navegação:', error);
            container.classList.remove('page-exit');
        }
    }

    updateActiveLinks(pageId) {
        // Update panel nav buttons
        document.querySelectorAll('.panel-nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-target') === pageId);
        });

        // Update rail buttons (direct links)
        document.querySelectorAll('.rail-btn[data-direct]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-target') === pageId);
        });

        // Find which category this page belongs to and highlight rail icon
        const routeData = ROUTE_MAP[pageId];
        if (routeData && routeData.category) {
            const categoryMap = {
                'Medir': 'measure',
                'Análise': 'analysis',
                'Mixer': 'mixer',
                'Rede': 'network',
                'Configurações': 'settings'
            };
            const catId = categoryMap[routeData.category];
            document.querySelectorAll('.rail-btn[data-category]').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-category') === catId);
            });
        }
    }

    getRouteData(pageId) {
        return ROUTE_MAP[pageId] || null;
    }

    _wait(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

window.ROUTE_MAP = ROUTE_MAP;
window.router = new Router();
