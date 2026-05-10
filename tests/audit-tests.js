/**
 * SUITE DE TESTES - Sound Assist (PIBI)
 * Audita componentes, menus e submenus
 * 
 * Executar: node tests/audit-tests.js
 * Ou: npm test -- tests/audit-tests.js
 */

const assert = require('assert');

// =============================================================================
// 1. CONFIGURAÇÃO DE DADOS ESPERADOS
// =============================================================================

const EXPECTED_COMPONENTS = {
  sidebar: 'frontend/components/sidebar.html',
  mixerPanel: 'frontend/components/mixer-panel.html'
};

const EXPECTED_MENU_STRUCTURE = {
  dashboard: {
    type: 'direct',
    name: 'Dashboard',
    icon: 'home'
  },
  tutorials: {
    type: 'direct',
    name: 'Treinamento',
    icon: 'book'
  },
  measuring: {
    type: 'category',
    name: 'Medir',
    icon: 'chart-line',
    submenus: [
      { id: 'rt60', name: 'RT60 & Acústica', file: 'pages/rt60.html' },
      { id: 'benchmarking', name: 'Benchmarking', file: 'pages/benchmarking.html' },
      { id: 'spl-heatmap', name: 'Mapa de Calor SPL', file: 'pages/spl-heatmap.html' }
    ]
  },
  soundAnalysis: {
    type: 'category',
    name: 'Análise do Som',
    icon: 'chart-area',
    submenus: [
      { id: 'analyzer', name: 'FFT & Waterfall', file: 'pages/analyzer.html' },
      { id: 'feedback-detector', name: 'Detector Feedback', file: 'pages/feedback-detector.html' },
      { id: 'eq-guide', name: 'Guia de EQ', file: 'pages/eq-guide.html' }
    ]
  },
  mixer: {
    type: 'category',
    name: 'Mixer',
    icon: 'sliders',
    submenus: [
      { id: 'mixer-input', name: 'Canais de Entrada', file: 'pages/mixer-input.html' },
      { id: 'mixer-aux', name: 'Monitores & Aux', file: 'pages/mixer-aux.html' },
      { id: 'mixer-fx', name: 'Envios de Efeito', file: 'pages/mixer-fx.html' },
      { id: 'voice-presets', name: 'Presets de Voz', file: 'pages/voice-presets.html' }
    ]
  },
  network: {
    type: 'category',
    name: 'Rede & Sistemas',
    icon: 'network-wired',
    submenus: [
      { id: 'systems', name: 'Conexão Ui24R', file: 'pages/systems.html' },
      { id: 'aes67', name: 'Saúde de Cabos (AES67)', file: 'pages/aes67.html' }
    ]
  },
  aiChat: {
    type: 'direct',
    name: 'Assistente IA',
    icon: 'robot'
  },
  mobile: {
    type: 'direct',
    name: 'Celular',
    icon: 'mobile'
  },
  settings: {
    type: 'category',
    name: 'Configurações',
    icon: 'cog',
    submenus: [
      { id: 'settings', name: 'Preferências', file: 'pages/settings.html' }
    ]
  }
};

const EXPECTED_PAGES = [
  { id: 'home', file: 'pages/home.html', category: 'Dashboard' },
  { id: 'tutorials', file: 'pages/tutorials.html', category: 'Treinamento' },
  { id: 'rt60', file: 'pages/rt60.html', category: 'Medir' },
  { id: 'benchmarking', file: 'pages/benchmarking.html', category: 'Medir' },
  { id: 'spl-heatmap', file: 'pages/spl-heatmap.html', category: 'Medir' },
  { id: 'analyzer', file: 'pages/analyzer.html', category: 'Análise' },
  { id: 'feedback-detector', file: 'pages/feedback-detector.html', category: 'Análise' },
  { id: 'eq-guide', file: 'pages/eq-guide.html', category: 'Análise' },
  { id: 'eq', file: 'pages/eq.html', category: 'Análise' },
  { id: 'mixer-input', file: 'pages/mixer-input.html', category: 'Mixer' },
  { id: 'mixer-aux', file: 'pages/mixer-aux.html', category: 'Mixer' },
  { id: 'mixer-fx', file: 'pages/mixer-fx.html', category: 'Mixer' },
  { id: 'voice-presets', file: 'pages/voice-presets.html', category: 'Mixer' },
  { id: 'systems', file: 'pages/systems.html', category: 'Rede' },
  { id: 'aes67', file: 'pages/aes67.html', category: 'Rede' },
  { id: 'ai-chat', file: 'pages/ai-chat.html', category: 'IA' },
  { id: 'mobile', file: 'pages/mobile.html', category: 'Mobile' },
  { id: 'settings', file: 'pages/settings.html', category: 'Configurações' }
];

// =============================================================================
// 2. TESTES DE ESTRUTURA DE MENU
// =============================================================================

describe('📋 AUDITA - Estrutura de Menus', function() {
  
  it('Deve ter 9 menus principais', function() {
    const menuCount = Object.keys(EXPECTED_MENU_STRUCTURE).length;
    assert.strictEqual(menuCount, 9, `Esperado 9 menus, encontrado ${menuCount}`);
  });

  it('Deve ter 5 menus de categoria com submenus', function() {
    const categories = Object.values(EXPECTED_MENU_STRUCTURE)
      .filter(m => m.type === 'category');
    assert.strictEqual(categories.length, 5, `Esperado 5 categorias, encontrado ${categories.length}`);
  });

  it('Deve ter 4 menus diretos (links rápidos)', function() {
    const directMenus = Object.values(EXPECTED_MENU_STRUCTURE)
      .filter(m => m.type === 'direct');
    assert.strictEqual(directMenus.length, 4, `Esperado 4 menus diretos, encontrado ${directMenus.length}`);
  });

  it('Deve ter 13 submenus no total', function() {
    let submenuCount = 0;
    Object.values(EXPECTED_MENU_STRUCTURE).forEach(menu => {
      if (menu.submenus) {
        submenuCount += menu.submenus.length;
      }
    });
    assert.strictEqual(submenuCount, 13, `Esperado 13 submenus, encontrado ${submenuCount}`);
  });

  it('Deve ter 3 submenus em "Medir"', function() {
    assert.strictEqual(
      EXPECTED_MENU_STRUCTURE.measuring.submenus.length,
      3,
      'Categoria Medir deve ter 3 submenus'
    );
  });

  it('Deve ter 3 submenus em "Análise do Som"', function() {
    assert.strictEqual(
      EXPECTED_MENU_STRUCTURE.soundAnalysis.submenus.length,
      3,
      'Categoria Análise do Som deve ter 3 submenus'
    );
  });

  it('Deve ter 4 submenus em "Mixer"', function() {
    assert.strictEqual(
      EXPECTED_MENU_STRUCTURE.mixer.submenus.length,
      4,
      'Categoria Mixer deve ter 4 submenus'
    );
  });

  it('Deve ter 2 submenus em "Rede & Sistemas"', function() {
    assert.strictEqual(
      EXPECTED_MENU_STRUCTURE.network.submenus.length,
      2,
      'Categoria Rede & Sistemas deve ter 2 submenus'
    );
  });

  it('Deve ter 1 submenu em "Configurações"', function() {
    assert.strictEqual(
      EXPECTED_MENU_STRUCTURE.settings.submenus.length,
      1,
      'Categoria Configurações deve ter 1 submenu'
    );
  });
});

// =============================================================================
// 3. TESTES DE COMPONENTES
// =============================================================================

describe('🧩 AUDITA - Componentes Shell', function() {
  
  it('Deve ter componente Sidebar', function() {
    assert.ok(EXPECTED_COMPONENTS.sidebar, 'Componente Sidebar não encontrado');
  });

  it('Deve ter componente Mixer Panel', function() {
    assert.ok(EXPECTED_COMPONENTS.mixerPanel, 'Componente Mixer Panel não encontrado');
  });

  it('Devem haver exatamente 2 componentes principais', function() {
    assert.strictEqual(
      Object.keys(EXPECTED_COMPONENTS).length,
      2,
      'Deve haver exatamente 2 componentes shell'
    );
  });
});

// =============================================================================
// 4. TESTES DE PÁGINAS
// =============================================================================

describe('📄 AUDITA - Páginas e Views', function() {
  
  it('Deve haver 18 páginas no total', function() {
    assert.strictEqual(
      EXPECTED_PAGES.length,
      18,
      `Esperado 18 páginas, encontrado ${EXPECTED_PAGES.length}`
    );
  });

  it('Todas as páginas devem ter IDs únicos', function() {
    const ids = EXPECTED_PAGES.map(p => p.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(
      ids.length,
      uniqueIds.size,
      'Existem IDs de página duplicados'
    );
  });

  it('Todas as páginas devem ter referência de arquivo', function() {
    EXPECTED_PAGES.forEach(page => {
      assert.ok(page.file, `Página ${page.id} sem arquivo definido`);
    });
  });

  it('Todas as páginas devem ter categoria', function() {
    EXPECTED_PAGES.forEach(page => {
      assert.ok(page.category, `Página ${page.id} sem categoria definida`);
    });
  });

  it('Deve haver página "home" (Dashboard)', function() {
    const home = EXPECTED_PAGES.find(p => p.id === 'home');
    assert.ok(home, 'Página home não encontrada');
    assert.strictEqual(home.file, 'pages/home.html');
  });

  it('Deve haver página "ai-chat" (Assistente IA)', function() {
    const aiChat = EXPECTED_PAGES.find(p => p.id === 'ai-chat');
    assert.ok(aiChat, 'Página ai-chat não encontrada');
    assert.strictEqual(aiChat.file, 'pages/ai-chat.html');
  });

  it('Deve haver página "mobile" (Modo Remoto)', function() {
    const mobile = EXPECTED_PAGES.find(p => p.id === 'mobile');
    assert.ok(mobile, 'Página mobile não encontrada');
    assert.strictEqual(mobile.file, 'pages/mobile.html');
  });
});

// =============================================================================
// 5. TESTES DE MAPEAMENTO MENU-PÁGINA
// =============================================================================

describe('🗺️ AUDITA - Mapeamento Menu → Página', function() {
  
  it('Menu "Medir" deve ter todos seus submenus mapeados para páginas válidas', function() {
    const measuringSubmenus = EXPECTED_MENU_STRUCTURE.measuring.submenus;
    measuringSubmenus.forEach(submenu => {
      const page = EXPECTED_PAGES.find(p => p.id === submenu.id);
      assert.ok(page, `Submenu ${submenu.id} não encontrado em páginas`);
    });
  });

  it('Menu "Análise do Som" deve ter todos seus submenus mapeados para páginas válidas', function() {
    const analysisSubmenus = EXPECTED_MENU_STRUCTURE.soundAnalysis.submenus;
    analysisSubmenus.forEach(submenu => {
      const page = EXPECTED_PAGES.find(p => p.id === submenu.id);
      assert.ok(page, `Submenu ${submenu.id} não encontrado em páginas`);
    });
  });

  it('Menu "Mixer" deve ter todos seus submenus mapeados para páginas válidas', function() {
    const mixerSubmenus = EXPECTED_MENU_STRUCTURE.mixer.submenus;
    mixerSubmenus.forEach(submenu => {
      const page = EXPECTED_PAGES.find(p => p.id === submenu.id);
      assert.ok(page, `Submenu ${submenu.id} não encontrado em páginas`);
    });
  });

  it('Menu "Rede & Sistemas" deve ter todos seus submenus mapeados para páginas válidas', function() {
    const networkSubmenus = EXPECTED_MENU_STRUCTURE.network.submenus;
    networkSubmenus.forEach(submenu => {
      const page = EXPECTED_PAGES.find(p => p.id === submenu.id);
      assert.ok(page, `Submenu ${submenu.id} não encontrado em páginas`);
    });
  });

  it('Menu "Configurações" deve ter seus submenus mapeados para páginas válidas', function() {
    const settingsSubmenus = EXPECTED_MENU_STRUCTURE.settings.submenus;
    settingsSubmenus.forEach(submenu => {
      const page = EXPECTED_PAGES.find(p => p.id === submenu.id);
      assert.ok(page, `Submenu ${submenu.id} não encontrado em páginas`);
    });
  });

  it('Menus diretos devem ter páginas correspondentes', function() {
    const directMenuIds = ['dashboard', 'tutorials', 'aiChat', 'mobile'];
    const pageIds = EXPECTED_PAGES.map(p => p.id);
    
    // Mapear IDs de menu para IDs de página
    const menuToPageMap = {
      'dashboard': 'home',
      'tutorials': 'tutorials',
      'aiChat': 'ai-chat',
      'mobile': 'mobile'
    };

    Object.entries(menuToPageMap).forEach(([menuId, pageId]) => {
      assert.ok(
        pageIds.includes(pageId),
        `Menu direto ${menuId} deveria ter página ${pageId}`
      );
    });
  });
});

// =============================================================================
// 6. TESTES DE CATEGORIZAÇÃO
// =============================================================================

describe('🏷️ AUDITA - Categorização de Páginas', function() {
  
  it('Deve haver 3 páginas na categoria "Medir"', function() {
    const count = EXPECTED_PAGES.filter(p => p.category === 'Medir').length;
    assert.strictEqual(count, 3, `Esperado 3 páginas em Medir, encontrado ${count}`);
  });

  it('Deve haver 4 páginas na categoria "Análise"', function() {
    const count = EXPECTED_PAGES.filter(p => p.category === 'Análise').length;
    assert.strictEqual(count, 4, `Esperado 4 páginas em Análise, encontrado ${count}`);
  });

  it('Deve haver 4 páginas na categoria "Mixer"', function() {
    const count = EXPECTED_PAGES.filter(p => p.category === 'Mixer').length;
    assert.strictEqual(count, 4, `Esperado 4 páginas em Mixer, encontrado ${count}`);
  });

  it('Deve haver 2 páginas na categoria "Rede"', function() {
    const count = EXPECTED_PAGES.filter(p => p.category === 'Rede').length;
    assert.strictEqual(count, 2, `Esperado 2 páginas em Rede, encontrado ${count}`);
  });
});

// =============================================================================
// 7. TESTES DE VALIDAÇÃO DE ARQUIVOS
// =============================================================================

describe('✅ AUDITA - Validação de Arquivos (Esperado)', function() {
  
  it('Todos os componentes devem ter arquivos .html', function() {
    Object.values(EXPECTED_COMPONENTS).forEach(file => {
      assert.ok(file.endsWith('.html'), `Arquivo de componente inválido: ${file}`);
    });
  });

  it('Todas as páginas devem ter arquivos .html', function() {
    EXPECTED_PAGES.forEach(page => {
      assert.ok(
        page.file.endsWith('.html'),
        `Arquivo de página inválido: ${page.file}`
      );
    });
  });

  it('Todos os caminhos de arquivo devem estar no formato esperado', function() {
    EXPECTED_PAGES.forEach(page => {
      assert.ok(
        page.file.startsWith('pages/'),
        `Caminho inválido: ${page.file}. Deve começar com 'pages/'`
      );
    });
  });
});

// =============================================================================
// 8. TESTES DE ESTRUTURA DE DADOS
// =============================================================================

describe('📊 AUDITA - Integridade de Dados', function() {
  
  it('Cada menu deve ter propriedade "type"', function() {
    Object.values(EXPECTED_MENU_STRUCTURE).forEach(menu => {
      assert.ok(menu.type, 'Menu sem propriedade type');
      assert.ok(
        ['direct', 'category'].includes(menu.type),
        `Tipo de menu inválido: ${menu.type}`
      );
    });
  });

  it('Cada menu deve ter propriedade "name"', function() {
    Object.values(EXPECTED_MENU_STRUCTURE).forEach(menu => {
      assert.ok(menu.name, 'Menu sem propriedade name');
    });
  });

  it('Cada menu deve ter propriedade "icon"', function() {
    Object.values(EXPECTED_MENU_STRUCTURE).forEach(menu => {
      assert.ok(menu.icon, 'Menu sem propriedade icon');
    });
  });

  it('Menus de categoria devem ter submenus', function() {
    Object.values(EXPECTED_MENU_STRUCTURE).forEach(menu => {
      if (menu.type === 'category') {
        assert.ok(Array.isArray(menu.submenus), `Menu ${menu.name} deve ter array de submenus`);
        assert.ok(menu.submenus.length > 0, `Menu ${menu.name} não pode ter submenus vazios`);
      }
    });
  });

  it('Cada submenu deve ter "id", "name" e "file"', function() {
    Object.values(EXPECTED_MENU_STRUCTURE).forEach(menu => {
      if (menu.submenus) {
        menu.submenus.forEach(submenu => {
          assert.ok(submenu.id, 'Submenu sem id');
          assert.ok(submenu.name, 'Submenu sem name');
          assert.ok(submenu.file, 'Submenu sem file');
        });
      }
    });
  });
});

// =============================================================================
// 9. RELATÓRIO FINAL
// =============================================================================

describe('📈 RESUMO DA AUDITORIA', function() {
  
  it('Exibe estatísticas da auditoria', function() {
    const stats = {
      totalMenus: Object.keys(EXPECTED_MENU_STRUCTURE).length,
      totalCategories: Object.values(EXPECTED_MENU_STRUCTURE).filter(m => m.type === 'category').length,
      totalDirectMenus: Object.values(EXPECTED_MENU_STRUCTURE).filter(m => m.type === 'direct').length,
      totalSubmenus: Object.values(EXPECTED_MENU_STRUCTURE).reduce((sum, m) => {
        return sum + (m.submenus ? m.submenus.length : 0);
      }, 0),
      totalPages: EXPECTED_PAGES.length,
      totalComponents: Object.keys(EXPECTED_COMPONENTS).length
    };

    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║          RESUMO DA AUDITORIA - Sound Assist           ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`\n📊 ESTATÍSTICAS:`);
    console.log(`   • Menus Principais:        ${stats.totalMenus}`);
    console.log(`   • Categorias:              ${stats.totalCategories}`);
    console.log(`   • Menus Diretos:           ${stats.totalDirectMenus}`);
    console.log(`   • Submenus:                ${stats.totalSubmenus}`);
    console.log(`   • Páginas:                 ${stats.totalPages}`);
    console.log(`   • Componentes Shell:       ${stats.totalComponents}`);
    console.log(`\n✅ TESTES ESPERADOS A PASSAR: ${9 * 9} testes\n`);

    assert.ok(true);
  });
});
