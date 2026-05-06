# SoundMaster Pro — Plano de Evolução Acústica (Fase 4)

Com base no documento de Otimização de Medições e Qualidade Acústica, este planejamento traduz os requisitos teóricos em **arquitetura técnica e tarefas acionáveis** utilizando a base atual do SoundMaster (Web Audio API + Python AI).

## Fase 1: Módulo de Calibração (Fundação)
*Sem dados calibrados, as decisões da IA são baseadas em distorções do microfone do celular ou notebook.*

- [ ] **1.1 Parser de Arquivo de Calibração (.cal/.txt):**
  - Criar interface no painel Desktop para upload de arquivo `.cal`.
  - Desenvolver função JS para ler as frequências e compensações (dB).
- [ ] **1.2 Aplicação de Gain de Compensação (Web Audio API):**
  - Modificar o `analyser.getFloatFrequencyData` no `mobile.js` e `analyzer.js` para somar/subtrair o valor do `.cal` na curva em tempo real.
- [ ] **1.3 Calibração de SPL Reference (94dB / 1kHz):**
  - Adicionar botão "Calibrar a 94dB" que recebe um tom de um calibrador acústico externo e grava o *offset* global de ganho (salvando no banco JSON local).

## Fase 2: Mapeamento de Ruído e Grid Térmico (Heatmap)
*Evolução da atual aba de "Mapeamento".*

- [ ] **2.1 Integração de Planta Baixa:**
  - Permitir upload de imagem da planta da igreja/evento.
- [ ] **2.2 Sistema de Pins Interativos:**
  - Clicar na planta gera um "Pin". O sistema exige 3 minutos de gravação para extrair o **LAeq** (Leq com curva de ponderação A).
- [ ] **2.3 Geração de Heatmap Visual:**
  - Usar a biblioteca `heatmap.js` (ou Canvas nativo) para gerar gradientes de cor (Verde -> Vermelho) baseados na pressão sonora interpolada entre os pontos medidos. Salvar os dados no arquivo `db/mappings.json`.

## Fase 3: Análise Multibanda e RT60 Avançado
*A medição global atual de RT60 é básica. O som se comporta diferente nos graves e agudos.*

- [ ] **3.1 Divisor de Frequência (Crossover Virtual):**
  - Criar instâncias de `BiquadFilterNode` configuradas como `bandpass` nas frequências centrais: **125Hz, 500Hz, 1kHz, 4kHz**.
- [ ] **3.2 Schroeder Integration (Decay reverso):**
  - Refatorar a lógica atual de RT60 em `mobile.js` para usar a integração de Schroeder, garantindo precisão mesmo com alto ruído de fundo (Noise Floor).
- [ ] **3.3 Exibição Multibanda no Mobile:**
  - Trocar o texto genérico "RT60 Medido" por um card detalhado exibindo o tempo de reverberação das 4 frequências críticas independentemente.

## Fase 4: O "SoundMaster AI" Direcionado
*Com os dados precisos das Fases 1-3, a inteligência da aplicação decola.*

- [ ] **4.1 Prompt Engineering Baseado em Normas:**
  - Injetar no contexto da IA (Python) os padrões da **IEC 60268-16** (Inteligibilidade) e limites toleráveis de RT60.
- [ ] **4.2 Actionable EQ (Equalização Ativa):**
  - Se a Fase 3 detectar que o RT60 em 250Hz está com 3.5s (muita lama/mud), o próprio SoundMaster enviará o comando Socket para sugerir a aplicação de cortes na mesa de som Ui24R nessa exata frequência.

---

### Decisões de Arquitetura:
1. **Frontend (SPA):** Toda a matemática pesada (FFT, Filtros, RT60) continua no frontend rodando via Web Audio API, aliviando o backend e garantindo latência quase zero.
2. **Armazenamento:** O `db/mappings.json` será estendido para guardar matrizes de coordenadas X,Y e valores de SPL para suportar o Heatmap.
3. **Progressão:** Recomenda-se iniciar estritamente pela **Fase 3 (RT60 Multibanda)**, pois é o que traz o maior valor de diagnóstico acústico imediato usando o microfone do celular destravado anteriormente.
