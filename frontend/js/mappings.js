(function () {
    let tunnelPollCount = 0;

    async function loadConfig() {
        try {
            const res = await fetch('/api/config');
            if (!res.ok) return;

            const config = await res.json();
            const ipCard = document.getElementById('local-ip-card');
            const ipDisplay = document.getElementById('server-ip-display');
            const mobileUrl = document.getElementById('mobile-url');
            const mobileLink = document.getElementById('mobile-open-link');
            const mobileQrCode = document.getElementById('mobile-qr-code');

            if (ipCard) ipCard.style.display = 'block';
            if (ipDisplay) ipDisplay.innerText = `http://${config.localIp}:${config.port}`;
            
            if (config.localIp === '127.0.0.1' && !config.tunnelUrl) {
                if (mobileUrl) mobileUrl.innerText = 'Aguardando rede...';
                return;
            }

            // Informativo sobre o Túnel
            if (!config.tunnelUrl) {
                if (mobileUrl) mobileUrl.innerHTML = '<span style="color: var(--slate-400); font-size: 9px; text-transform: uppercase;">Túnel HTTPS Desativado (Melhor Performance). Ative em "Sistemas" se precisar do Celular.</span>';
                
                const localHref = `http://${config.localIp}:${config.port}/mobile/index.html`;
                if (mobileLink) mobileLink.href = localHref;
                if (mobileQrCode) {
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(localHref)}`;
                    mobileQrCode.src = qrUrl;
                }
                return;
            }

            // Se o túnel subiu ou se desistimos após 20s
            const baseUrl = config.tunnelUrl || `http://${config.localIp}:${config.port}`;
            const mobileHref = `${baseUrl}/mobile/index.html`;

            if (!config.tunnelUrl) {
                if (mobileUrl) mobileUrl.innerHTML = `${mobileHref} <br><span style="color: var(--danger); font-size: 10px; font-weight: 800; text-transform: uppercase; margin-top: 4px; display: block;">Túnel Falhou: Microfone bloqueado no celular.</span>`;
            } else {
                if (mobileUrl) mobileUrl.innerHTML = `<span style="color: var(--success); font-weight: bold;">${mobileHref}</span>`;
            }

            if (mobileLink) mobileLink.href = mobileHref;
            
            if (mobileQrCode) {
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(mobileHref)}`;
                mobileQrCode.src = qrUrl;
                console.log('[Config] QR Code setado para:', mobileHref);
            }
        } catch (e) {
            console.error('[Config] Erro ao carregar config:', e);
        }
    }

    async function loadMappings() {
        try {
            const res = await fetch('/api/mappings');
            if (!res.ok) return;

            const mappings = await res.json();
            const list = document.getElementById('db-mappings-list');
            if (!list) return;

            list.innerHTML = '';
            if (mappings.length === 0) {
                list.innerHTML = '<li style="color: var(--text-muted);">Nenhum mapeamento salvo.</li>';
                return;
            }

            mappings.forEach(map => {
                const li = document.createElement('li');
                li.style.cssText = 'display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);';
                const location = map.location ? ` - ${map.location}` : '';
                const channel = map.channel ? ` canal ${map.channel}` : '';
                li.innerHTML = `
                    <span><strong>${map.hz} Hz</strong>${channel}${location} - Detectado em ${new Date(map.date).toLocaleDateString()}</span>
                    <button class="btn-delete-map" data-id="${map._id}" style="background: none; border: none; color: var(--danger); cursor: pointer;">Excluir</button>
                `;
                list.appendChild(li);
            });

            document.querySelectorAll('.btn-delete-map').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.getAttribute('data-id');
                    await fetch(`/api/mappings/${id}`, { method: 'DELETE' });
                    loadMappings();
                });
            });
        } catch (e) {
            console.log('Erro ao carregar mapeamentos:', e);
        }
    }

    function initSaveMapping() {
        const btnSaveMap = document.getElementById('btn-save-map');
        if (!btnSaveMap) return;

        btnSaveMap.addEventListener('click', async () => {
            const hzInput = document.getElementById('save-hz');
            const channelInput = document.getElementById('save-map-channel');
            const locationInput = document.getElementById('save-map-location');
            const hzVal = parseInt(hzInput.value, 10);

            if (!hzVal) {
                alert('Insira uma frequência válida!');
                return;
            }

            try {
                const res = await fetch('/api/mappings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        hz: hzVal,
                        channel: Number(channelInput?.value || 1),
                        location: locationInput?.value?.trim() || '',
                        date: new Date().toISOString()
                    })
                });

                if (res.ok) {
                    hzInput.value = '';
                    if (locationInput) locationInput.value = '';
                    loadMappings();
                    alert('Frequência salva com sucesso no Banco de Dados!');
                }
            } catch (e) {
                alert('Erro ao salvar no banco de dados local.');
            }
        });
    }

    function init() {
        loadConfig();
        loadMappings();
        initSaveMapping();
    }

    window.SoundMasterMappings = { init, loadMappings };

    // Ouvir eventos do roteador
    document.addEventListener('page-loaded', (e) => {
        if (e.detail.pageId === 'home') {
            loadConfig();
        } else if (e.detail.pageId === 'analyzer') {
            loadMappings();
            initSaveMapping();
        } else if (e.detail.pageId === 'mobile') {
            loadConfig();
        }
    });
})();
