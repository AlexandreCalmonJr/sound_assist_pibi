# 🎚️ SoundMaster Pro

O **SoundMaster Pro** é um ecossistema inteligente de controle e análise de áudio projetado especificamente para técnicos de som de igreja e eventos. Ele integra o controle remoto da mesa **Soundcraft Ui24R** com ferramentas avançadas de análise acústica e um assistente de IA especializado.

![SoundMaster Mobile UI](https://img.shields.io/badge/UI-Premium_Glassmorphism-00cfd5?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Beta_Active-success?style=for-the-badge)

## 🚀 Principais Funcionalidades

### 📱 Interface Mobile Premium (PWA)
*   **Design Glassmorphism**: Interface ultra-moderna otimizada para uso em ambientes escuros.
*   **Controle Master**: Fader de alta precisão com presets rápidos (Muto, Soft, Voz, Show).
*   **Navegação Fluida**: SPA (Single Page Application) com navegação inferior tátil.

### 🔬 Análise Acústica Técnica
*   **Medição de RT60**: Calcula o tempo de reverberação da sala capturando impulsos em tempo real.
*   **Modo Ruído Rosa**: Analisador de espectro com média de 100 amostras para alinhamento de sistema ultra-preciso.
*   **Análise de Timbre**: Diagnóstico automático de equilíbrio tonal (Grave/Médio/Agudo).
*   **Detector de Microfonia**: Identifica picos sustentados e oferece um botão de "Corte de Feedback" imediato.

### 🤖 Assistente SoundMaster AI
*   **Diagnóstico Inteligente**: Recebe dados do analisador e sugere ajustes de equalização.
*   **Comandos de Voz/Chat**: "Equalize a voz do pregador", "Corte os graves do violão no canal 5".
*   **Conhecimento Técnico**: Baseado em princípios de engenharia de áudio para igrejas.

### 🌐 Conectividade e Servidor
*   **Auto-Tunneling**: Servidor integrado com túnel HTTPS automático (Localtunnel) para acesso ao microfone em dispositivos móveis sem configuração complexa.
*   **WebSocket Real-Time**: Sincronização instantânea com a mesa de som.

## 🛠️ Tecnologias Utilizadas

*   **Frontend**: HTML5, Vanilla JavaScript, Tailwind CSS v4.
*   **Backend**: Node.js, Socket.io, Express.
*   **IA**: Python (GPT-based backend).
*   **Desktop App**: Electron (para versão nativa Windows).
*   **Áudio**: Web Audio API (Analysers, BiquadFilters).

## 📦 Como Instalar e Rodar

1.  **Pré-requisitos**:
    *   Node.js instalado.
    *   Python 3.10+ (para o assistente de IA).

2.  **Instalação**:
    ```bash
    git clone https://github.com/AlexandreCalmonJr/sound_assist_pibi.git
    cd sound_assist_pibi
    npm install
    ```

3.  **Configuração da IA**:
    *   Crie um arquivo `.env` na raiz ou configure sua API Key no `ai_server.py`.

4.  **Execução**:
    ```bash
    npm start
    ```
    *   O servidor iniciará o túnel e exibirá o link HTTPS no console.

## 🤝 Contribuição

Este é um projeto focado em simplificar a vida do técnico de som voluntário. Sugestões de novos presets de instrumentos ou melhorias no algoritmo de RT60 são muito bem-vindas.

---
*Desenvolvido com foco na excelência acústica.*
