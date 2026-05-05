/**
 * SoundMaster SPA Router
 * Gerencia o carregamento dinâmico de páginas (módulos)
 */
class Router {
    constructor() {
        this.routes = {
            'home': 'pages/home.html',
            'analyzer': 'pages/analyzer.html',
            'eq': 'pages/eq.html',
            'rt60': 'pages/rt60.html',
            'mobile': 'pages/mobile.html',
            'ai-chat': 'pages/ai-chat.html'
        };
        this.currentPage = null;
        
        // Listener para navegação via sidebar
        document.addEventListener('click', (e) => {
            const navBtn = e.target.closest('.nav-btn');
            if (navBtn) {
                const target = navBtn.getAttribute('data-target');
                if (this.routes[target]) {
                    this.navigate(target);
                }
            }
        });
    }

    /**
     * Navega para uma página específica
     * @param {string} pageId 
     */
    async navigate(pageId) {
        if (this.currentPage === pageId) return;

        try {
            console.log(`[Router] Navegando para: ${pageId}`);
            const response = await fetch(this.routes[pageId]);
            if (!response.ok) throw new Error(`Erro ao carregar página: ${pageId}`);
            
            const html = await response.text();
            const container = document.getElementById('agent-workspace');
            
            if (container) {
                // Efeito de transição simples
                container.style.opacity = '0';
                
                setTimeout(() => {
                    container.innerHTML = html;
                    this.currentPage = pageId;
                    this.updateActiveLinks(pageId);
                    
                    // Disparar evento de página carregada para scripts específicos
                    const event = new CustomEvent('page-loaded', { detail: { pageId } });
                    document.dispatchEvent(event);
                    
                    container.style.opacity = '1';
                }, 150);
            }
        } catch (error) {
            console.error('[Router] Erro na navegação:', error);
        }
    }

    /**
     * Atualiza o estado visual dos botões de navegação
     */
    updateActiveLinks(pageId) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            if (btn.getAttribute('data-target') === pageId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}

// Inicializar roteador globalmente
window.router = new Router();
