import re
import time

CHURCH_PROFILES = {
    'janelas_vidro': {
        'problematic_ranges': [(2000, 4000)],
        'suggestion': 'Corte suave em 2.5-3.2kHz no Master para reduzir brilho excessivo do vidro.'
    },
    'teto_alto': {
        'problematic_ranges': [(80, 160)],
        'suggestion': 'HPF agressivo em 120Hz. Subgraves se acumulam neste ambiente com pé direito alto.'
    },
    'paredes_paralelas': {
        'problematic_ranges': [(400, 800)],
        'suggestion': 'Difusores nas laterais recomendados. Corte em 500Hz no Master para limpar o "embolado".'
    }
}

class SessionContext:
    def __init__(self):
        self.history = []
        self.room_profile = 'janelas_vidro'
        self.analyses_history = []
    
    def add_analysis(self, analysis):
        self.analyses_history.append(analysis)
        if len(self.analyses_history) > 50:
            self.analyses_history.pop(0)

class AIEngine:
    def __init__(self, session):
        self.session = session

    def command(self, action, desc, **kwargs):
        payload = {"action": action, "desc": desc}
        payload.update(kwargs)
        return payload

    def extract_channel(self, text):
        channel_match = re.search(r'(?:canal|ch)\s*(\d{1,2})', text)
        if not channel_match:
            return 1
        return max(1, min(24, int(channel_match.group(1))))

    def process(self, text, analysis=None, mixer_state=None):
        text = text.lower()
        
        # Se o usuário não citar canal, tentamos deduzir pelo contexto ou agir no Master
        channel = self.extract_channel(text)
        has_specific_channel = bool(re.search(r'(canal|ch|ch\s*\d)', text))
        
        analysis = analysis or {}
        if analysis:
            self.session.add_analysis(analysis)

        # 1. Dados Técnicos (FFT) - Atua no que está vindo do PA (Todos os canais somados)
        if 'peakHz' in analysis and analysis.get('peakHz', 0) > 0:
            peak = int(analysis.get('peakHz'))
            is_pink = analysis.get('isPinkNoise', False)
            
            profile = CHURCH_PROFILES.get(self.session.room_profile, {})
            room_suggestion = ""
            for min_hz, max_hz in profile.get('problematic_ranges', []):
                if min_hz <= peak <= max_hz:
                    room_suggestion = profile.get('suggestion', '')

            if is_pink or "rosa" in text:
                return {
                    "text": f"Ouvindo a mesa completa: Pico em {peak}Hz. {room_suggestion}",
                    "command": self.command("eq_cut", f"Ajuste Geral {peak}Hz", target="master", hz=peak, gain=-3, q=1.0)
                }

            if "microfonia" in text or "apito" in text:
                 return {
                    "text": f"ALERTA GERAL: Microfonia em {peak}Hz. Aplicando Notch no Master para proteger todos os canais.",
                    "command": self.command("eq_cut", f"Notch Global {peak}Hz", target="master", hz=peak, gain=-8, q=5.0, band=4)
                }
            
            # Se não especificou canal, a sugestão é para o Master (Ouvindo a sala)
            if not has_specific_channel:
                return {
                    "text": f"Análise Global: Identifiquei acúmulo em {peak}Hz no som da sala. {room_suggestion or 'Sugiro limpar o Master.'}",
                    "command": self.command("eq_cut", f"Limpeza Sala {peak}Hz", target="master", hz=peak, gain=-2, q=1.5)
                }

        # 2. Respostas por Texto (Keywords)
        if re.search(r'(voz|pregador|pregação|pastor)', text):
            target = f"canal {channel}" if has_specific_channel else "canal de voz principal"
            return {
                "text": f"Ouvindo e otimizando {target}. Aplicando clareza e controle dinâmico.",
                "command": self.command("run_clean_sound_preset", f"Voz {target}", channel=channel, type="vocal")
            }

        if re.search(r'(instrumentos|banda|musical)', text):
            return {
                "text": "Ouvindo a banda. Vou equilibrar o Master para dar mais espaço aos instrumentos.",
                "command": self.command("eq_cut", "Espaço Banda", target="master", hz=400, gain=-2, q=0.8)
            }

        if re.search(r'(vidro|janela|eco|reverberacao|rt60)', text):
            return {
                "text": f"Ouvindo a reverberação da sala ({self.session.room_profile}). Aplicando correção de brilho no Master.",
                "command": self.command("eq_cut", "Corte Vidro Master", target="master", hz=2500, gain=-3)
            }

        if re.search(r'(delay|atraso|distancia|metros|fundo)', text):
            # Tenta extrair a distância em metros
            dist_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:m|metro)', text)
            aux_match = re.search(r'(?:aux|retorno|monitor|delay)\s*(\d{1,2})', text)
            aux_ch = int(aux_match.group(1)) if aux_match else 9 # Geralmente delay é no fim dos aux
            
            if dist_match:
                meters = float(dist_match.group(1).replace(',', '.'))
                # Cálculo básico: ~343 m/s -> 1 metro ≈ 2.9ms
                ms = round(meters * 2.91, 1)
                return {
                    "text": f"Para {meters} metros, o atraso ideal é de aproximadamente {ms}ms. Deseja aplicar este delay ao Auxiliar {aux_ch}?",
                    "command": self.command("set_delay", f"Ajustar Delay {meters}m", aux=aux_ch, ms=ms)
                }
            
            return {
                "text": "Para ajustar o delay das caixas do fundo, me diga a distância em metros da frente até elas.",
                "command": None
            }

        if re.search(r'(retorno|monitor|auxiliar|caixa)', text):
            aux_match = re.search(r'(?:aux|retorno|monitor|caixa|auxiliar)\s*(\d{1,2})', text)
            aux_ch = int(aux_match.group(1)) if aux_match else 1
            
            if "pa" in text or "frente" in text:
                return {
                    "text": f"Otimizando o envio do canal {channel} para o PA (Master).",
                    "command": self.command("set_master_level", f"Volume PA Ch {channel}", channel=channel, level=0.7)
                }

            if "alto" in text or "mais" in text or "aumentar" in text:
                 return {
                    "text": f"Aumentando o envio do canal {channel} para o retorno {aux_ch}.",
                    "command": self.command("set_aux_level", f"Aumentar Aux {aux_ch}", channel=channel, aux=aux_ch, level=0.8)
                }
            if "baixo" in text or "baixar" in text or "reduzir" in text:
                 return {
                    "text": f"Reduzindo o envio do canal {channel} para o retorno {aux_ch}.",
                    "command": self.command("set_aux_level", f"Reduzir Aux {aux_ch}", channel=channel, aux=aux_ch, level=0.3)
                }
            if "mudo" in text or "mutar" in text:
                 return {
                    "text": f"Mutando canal {channel} no retorno {aux_ch}.",
                    "command": self.command("set_aux_level", f"Mute Aux {aux_ch}", channel=channel, aux=aux_ch, level=0)
                }
            
            return {
                "text": f"Deseja ajustar o nível do canal {channel} na caixa {aux_ch}? Posso aumentar, baixar ou mutar.",
                "command": None
            }

        if re.search(r'(reverb|fx|efeito|echo)', text):
            fx_match = re.search(r'(?:fx|reverb|efeito)\s*(\d{1,2})', text)
            fx_ch = int(fx_match.group(1)) if fx_match else 1 # Default FX 1 = Reverb
            
            if "mais" in text or "muito" in text or "aumentar" in text:
                 return {
                    "text": f"Adicionando mais brilho/profundidade ao {channel} via FX {fx_ch}.",
                    "command": self.command("set_fx_level", f"Mais Efeito Ch {channel}", channel=channel, fx=fx_ch, level=0.45)
                }
            if "menos" in text or "seco" in text or "tirar" in text:
                 return {
                    "text": f"Tirando o efeito do canal {channel}.",
                    "command": self.command("set_fx_level", f"Remover Efeito Ch {channel}", channel=channel, fx=fx_ch, level=0)
                }
            
            return {
                "text": f"Ajustando a reverberação manual do canal {channel}. Quer mais ou menos efeito?",
                "command": None
            }

        return {
            "text": "Estou ouvindo todos os canais via PA. Posso sugerir ajustes no Master ou em canais específicos, inclusive nos retornos.",
            "command": None
        }
