import json
import re
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 3002


def command(action, desc, **kwargs):
    payload = {"action": action, "desc": desc}
    payload.update(kwargs)
    return payload


def extract_channel(text):
    channel_match = re.search(r'(?:canal|ch)\s*(\d{1,2})', text)
    if not channel_match:
        return 1
    return max(1, min(24, int(channel_match.group(1))))


class AILogic:
    @staticmethod
    def process(text, analysis=None):
        text = text.lower()
        channel = extract_channel(text)
        analysis = analysis or {}

        # 1. Se houver dados técnicos (FFT)
        if 'peakHz' in analysis and analysis.get('peakHz', 0) > 0:
            peak = int(analysis.get('peakHz'))
            is_pink = analysis.get('isPinkNoise', False)
            
            if is_pink or "rosa" in text:
                res_text = f"Análise de Ruído Rosa: Pico em {peak}Hz. "
                if peak < 250: res_text += "Excesso de graves. Sugiro HPF em 120Hz."
                elif peak > 2000: res_text += "Ressonância aguda (vidro). Sugiro corte em 3.2kHz."
                else: res_text += "Resposta equilibrada."
                
                return {
                    "text": res_text,
                    "command": command("eq_cut", f"Ajuste Rosa {peak}Hz", target="master", hz=peak, gain=-3, q=1.0)
                }

            if "microfonia" in text or "apito" in text:
                 return {
                    "text": f"Microfonia em {peak}Hz. Aplicando Notch Filter.",
                    "command": command("eq_cut", f"Notch {peak}Hz", target="master", hz=peak, gain=-6, q=4.0, band=4)
                }
            
            return {
                "text": f"Análise acústica concluída: pico em {peak}Hz. Sugiro ajuste fino para clareza.",
                "command": command("eq_cut", f"Limpeza {peak}Hz", target="master", hz=peak, gain=-2, q=1.5)
            }

        # 2. Respostas por palavras-chave (Texto)
        if re.search(r'(microfonia|apito|feedback|apitando)', text):
             return {
                "text": f"Para microfonia no canal {channel}, aplique um corte estreito em 4.3kHz (ou na frequência que estiver apitando no gráfico).",
                "command": command("eq_cut", f"Corte Preventivo Ch{channel}", target="channel", channel=channel, hz=4300, gain=-6, q=4.0)
            }

        if re.search(r'(voz|pregador|pregação|pastor)', text):
            return {
                "text": f"Configurando canal {channel} para Voz (HPF 100Hz + Brilho em 3kHz).",
                "command": command("run_clean_sound_preset", f"Voz Ch{channel}", channel=channel, type="vocal")
            }
        
        if re.search(r'(violao|violão|acustico)', text):
            return {
                "text": f"Ajustando Violão no canal {channel} (Corte em 250Hz para tirar o 'boxiness').",
                "command": command("eq_cut", f"Violão Ch{channel}", target="channel", channel=channel, hz=250, gain=-4, q=1.5)
            }

        if re.search(r'(baixo|bass|kick|bumbo)', text):
            return {
                "text": f"Limpando graves no canal {channel} (Corte em 400Hz para definição).",
                "command": command("eq_cut", f"Graves Ch{channel}", target="channel", channel=channel, hz=400, gain=-3, q=1.0)
            }

        if re.search(r'(teclado|piano|synth)', text):
            return {
                "text": f"Equalizando Teclado no canal {channel} para não embolar com a voz.",
                "command": command("eq_cut", f"Teclado Ch{channel}", target="channel", channel=channel, hz=300, gain=-3)
            }

        if re.search(r'(som limpo|limpar|culto limpo)', text):
            return {
                "text": f"Limpando canal {channel} com HPF e EQ subtrativo.",
                "command": command("run_clean_sound_preset", f"Preset Limpo Ch{channel}", channel=channel)
            }

        if re.search(r'(abafado|embolado|boomy|grave sobrando|sem clareza)', text):
            return {
                "text": f"Abrindo o som no canal {channel} (Corte em 250Hz e High Shelf).",
                "command": command("eq_cut", f"Clareza Ch{channel}", target="channel", channel=channel, hz=250, gain=-3)
            }

        if re.search(r'(vidro|janela|eco|reverberacao|reverberação|rt60|brilho)', text):
            return {
                "text": "Reduzindo reflexões de vidro (Corte no Master em 2.5kHz).",
                "command": command("eq_cut", "Corte Vidro Master", target="master", hz=2500, gain=-3)
            }
        
        if re.search(r'(limpar afs|resetar afs|zerar microfonia)', text):
            return {
                "text": "Limpando todos os filtros de microfonia do AFS2.",
                "command": command("set_afs_enabled", "Reset AFS2", enabled=0) # Toggling off/on clears live filters
            }

        if re.search(r'(sibilancia|sibilância|sss|chiado)', text):
            return {
                "text": f"Reduzindo sibilância no canal {channel} (De-esser em 6.5kHz).",
                "command": command("eq_cut", f"De-esser Ch{channel}", target="channel", channel=channel, hz=6500, gain=-3, q=1.5)
            }

        if re.search(r'(equilibrar master|curva ideal|flat)', text):
            return {
                "text": "Aplicando curva de correção master para o salão (Graves +3, Mid -2, High +1).",
                "command": command("run_master_ideal_curve", "Curva Ideal Master")
            }

        # 3. Resposta padrão
        return {
            "text": "Entendido. Posso ajudar com: 'voz', 'violão', 'bumbo', 'teclado' ou problemas como 'som abafado', 'microfonia' e 'limpar AFS'.",
            "command": None
        }


class RequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Evita que o HTTPServer escreva logs padrão no stderr como erro.
        print("[Python AI] " + format % args)

    def send_json(self, status, payload):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode('utf-8'))

    def do_POST(self):
        if self.path != '/chat':
            self.send_json(404, {"error": "Rota nao encontrada"})
            return

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8') or '{}')
            result = AILogic.process(data.get('message', ''), data.get('analysis'))
            self.send_json(200, result)
        except json.JSONDecodeError:
            self.send_json(400, {"error": "JSON invalido"})

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-type")
        self.end_headers()


def run():
    server_address = ('127.0.0.1', PORT)
    httpd = HTTPServer(server_address, RequestHandler)
    print(f"IA Python iniciada com sucesso na porta {PORT} (127.0.0.1)")
    print("Aguardando comandos do SoundMaster...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()


if __name__ == '__main__':
    run()
