# SoundMaster Pro — Arquitetura de Algoritmos Acústicos

## Visão Geral

Este documento descreve a hierarquia e uso dos algoritmos de análise acústica no SoundMaster Pro, seguindo as recomendações do relatório de auditoria técnica.

---

## Algoritmos de RT60 (Tempo de Reverberação)

### Níveis de Implementação

| Nível | Arquivo | Precisão | Uso Recomendado |
|-------|---------|----------|-----------------|
| **1 - Mais preciso** | `backend/ai/acoustic_analysis.py` | Alta | Análises detalhadas, medições profissionais |
| **2 - Alto** | `frontend/js/workers/acoustic.worker.js` | Alta | Análises em tempo real no frontend |
| **3 - Heurístico** | `backend/ai/acoustics/processor.py` | Baixa | Estimativas rápidas (sem medição real) |

### Detalhes

**Nível 1 - `acoustic_analysis.py`**
- Deconvolução de Exponential Sine Sweep (ESS) conforme Farina 2000
- Integração reversa de Schroeder
- Cálculo de EDT, T20, T30, RT60 com critérios de seleção baseados em SNR
- **Dependências**: numpy, scipy

**Nível 2 - `acoustic.worker.js`**
- Schroeder backward integration
- EDT (Early Decay Time), T20, T30, RT60 estimado
- Clarity (C50, C80) e Definição (D50)
- STI aproximado via MTF
- **Dependências**: nenhuma (pure JS)

**Nível 3 - `acoustics/processor.py`**
- Fórmula de Eyring: `RT60 = -0.161 × V / (S × ln(1-α))`
- Requer volume, área de superfície e coeficiente de absorção médio
- **Dependências**: nenhuma

---

## Algoritmos de STI (Speech Transmission Index)

### Níveis de Implementação

| Nível | Arquivo | Precisão | Uso Recomendado |
|-------|---------|----------|-----------------|
| **1 - IEC 60268-16 Completo** | `backend/ai/acoustic_analysis.py` | Muito alta | Relatórios técnicos, certificações |
| **2 - Aproximação MTF** | `frontend/js/workers/acoustic.worker.js` | Alta | Análises em tempo real |
| **3 - Simplificado** | `backend/ai/acoustics/processor.py` | Baixa | Estimativas rápidas |

### Detalhes

**Nível 1 - `acoustic_analysis.py`** (IEC 60268-16:2011)
- 7 bandas de oitava (125Hz – 8kHz)
- 14 frequências de modulação (0.63Hz – 12.5Hz)
- Pesos por gênero (male/female)
- Common Intelligibility Scale (CIS)
- Correção de redundância de octava

**Nível 2 - `acoustic.worker.js`**
- MTF calculado diretamente da resposta ao impulso
- Não considera bandas de oitava separadamente
- Categories: A (Excelente) / B (Bom) / C (Razoável) / D (Fraco) / E (Ininteligível)

**Nível 3 - `acoustics/processor.py`**
- `STI ≈ (1 / (1 + RT60/0.6)) × (SNR/30)`
- Simplificação extrema, apenas para estimativa rápida

---

## Fluxo de Dados Recomendado

### Para Medições Profissionais (Backend)
```
Sweep Recording → acoustic_analysis.py → RT60, EDT, T20, T30, STI (IEC 60868-16)
```

### Para Análise em Tempo Real (Frontend)
```
Microphone → acoustic.worker.js → RT60, EDT, Clarity, STI (MTF)
```

### Para Estimativas Rápidas (sem medição)
```
Volume, Área, Alpha → processor.py (Eyring) → RT60 estimado
```

---

## Decisões de Arquitetura

1. **`acoustic_analysis.py` é a implementação de referência** para medições que exigem alta precisão (IEC 60268-16).

2. **`acoustic.worker.js` é usado para análise em tempo real** no frontend, offloading cálculos pesados para Web Worker.

3. **`acoustics/processor.py` permanece disponível** para casos onde não há dados de medição (estimativas baseadas em dimensões da sala).

4. **STI do `acoustic_analysis.py` deve ser priorizado** para relatórios técnicos e funcionalidades críticas de inteligibilidade.

---

## Referências

- IEC 60268-16:2011 — Sound system equipment - Part 16: Objective rating of speech intelligibility by speech transmission index
- Farina, A. (2000). Simultaneous measurement of impulse response and distortion with a swept-sine technique. AES Convention 108
- Schroeder, M. R. (1965). New method of measuring reverberation time. JASA 37(3), 409-412

---

*Documento criado seguindo recomendações do relatório de auditoria técnica.*
*Autor: Alexandre Calmon Jr.*