import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Importações Modulares
from engine.ai_logic import AIEngine, SessionContext
from acoustics.processor import AcousticProcessor

load_dotenv()

app = FastAPI(title="SoundMaster Pro AI Engine")

# Configuração de CORS para o Electron/Web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicialização de Estado (Dicionário de sessões por ID)
sessions: Dict[str, SessionContext] = {}

def get_session(session_id: str = "default") -> SessionContext:
    if session_id not in sessions:
        sessions[session_id] = SessionContext()
    return sessions[session_id]

# Modelos de Dados
class ChatRequest(BaseModel):
    message: str
    analysis: Optional[Dict[str, Any]] = None
    session_id: Optional[str] = "default"

class AcousticRequest(BaseModel):
    volume: float = 1000
    surface_area: float = 600
    alpha: float = 0.1

@app.get("/")
async def root():
    return {"status": "online", "engine": "SoundMaster Pro AI", "active_sessions": len(sessions)}

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        session = get_session(request.session_id)
        ai_engine = AIEngine(session)
        result = ai_engine.process(request.message, request.analysis)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/acoustic_analysis")
async def acoustic_analysis_endpoint(request: AcousticRequest):
    try:
        rt60 = AcousticProcessor.eyring_rt60(request.volume, request.surface_area, request.alpha)
        classification = AcousticProcessor.classify_room(rt60)
        return {
            "rt60": round(rt60, 2),
            "classification": classification,
            "formula": "Eyring"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/diagnose")
async def diagnose_endpoint(session_id: str = "default"):
    try:
        session = get_session(session_id)
        patterns = AcousticProcessor.diagnose_patterns(session.analyses_history)
        return {
            "patterns": patterns,
            "totalMeasurements": len(session.analyses_history),
            "session_id": session_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Rodando na porta 3002 (padrão do projeto)
    print("SoundMaster Pro AI Engine v2 Iniciando...")
    uvicorn.run(app, host="127.0.0.1", port=3002)
