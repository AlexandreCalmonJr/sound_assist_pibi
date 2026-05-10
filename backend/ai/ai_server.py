import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import time
import asyncio
from dotenv import load_dotenv
from contextlib import asynccontextmanager

# Importações Modulares
from engine.ai_logic import AIEngine, SessionContext
from acoustics.processor import AcousticProcessor

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Inicia limpeza de sessões
    asyncio.create_task(cleanup_sessions_task())
    yield
    # Shutdown logic here if needed

app = FastAPI(title="SoundMaster Pro AI Engine", lifespan=lifespan)

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    os.getenv("FRONTEND_URL", "http://localhost:3000")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
    max_age=3600,
)

from fastapi.security import APIKeyHeader
from fastapi import Depends, status

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str = Depends(api_key_header)):
    """Verifica se API Key é válida"""
    valid_key = os.getenv("AI_API_KEY")
    
    if not valid_key:
        # No desenvolvimento, se não houver chave, permitimos (ou podemos forçar uma padrão)
        # Para produção, deve ser obrigatória
        if os.getenv("NODE_ENV") == "production":
             raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Servidor não configurado (AI_API_KEY faltando)"
            )
        return True
    
    if api_key != valid_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API Key inválida ou ausente"
        )
    
    return True

# Inicialização de Estado (Dicionário de sessões por ID)
sessions: Dict[str, SessionContext] = {}

def get_session(session_id: str = "default") -> SessionContext:
    if session_id not in sessions:
        sessions[session_id] = SessionContext()
    else:
        sessions[session_id].touch()
    return sessions[session_id]

async def cleanup_sessions_task():
    """Tarefa em background para limpar sessões inativas (TTL de 1 hora)"""
    while True:
        await asyncio.sleep(600)  # Roda a cada 10 minutos
        cutoff = time.time() - 3600  # 1 hora
        expired = [sid for sid, s in sessions.items() if s.last_activity < cutoff]
        for sid in expired:
            if sid != "default": # Mantemos a default
                del sessions[sid]
        if expired:
            print(f"[AI Server] Sessões limpas: {len(expired)}")

# Modelos de Dados
class ChatRequest(BaseModel):
    message: str
    analysis: Optional[Dict[str, Any]] = None
    session_id: Optional[str] = "default"

class AcousticRequest(BaseModel):
    volume: float = 1000
    surface_area: float = 600
    alpha: float = 0.1

class FeedbackRequest(BaseModel):
    freq: float
    db: float
    prevDb: float
    gain: float = 0

class TrainRequest(BaseModel):
    freq: float
    db: float
    prevDb: float
    gain: float
    isFeedback: bool

@app.get("/")
async def root():
    return {"status": "online", "engine": "SoundMaster Pro AI", "active_sessions": len(sessions)}

@app.post("/chat")
async def chat_endpoint(
    request: ChatRequest,
    authenticated: bool = Depends(verify_api_key)
):
    try:
        session = get_session(request.session_id)
        ai_engine = AIEngine(session)
        result = ai_engine.process(request.message, request.analysis)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/acoustic_analysis")
async def acoustic_analysis_endpoint(
    request: AcousticRequest,
    authenticated: bool = Depends(verify_api_key)
):
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

@app.post("/analyze-feedback")
async def analyze_feedback_endpoint(
    request: FeedbackRequest,
    authenticated: bool = Depends(verify_api_key)
):
    try:
        # Lógica simples de risco baseada em delta de dB
        risk = 0.0
        delta = request.db - request.prevDb
        if delta > 3: risk = 0.5
        if delta > 6: risk = 0.8
        if request.db > -10: risk += 0.2
        return {"risk": min(1.0, risk)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/train")
async def train_endpoint(
    request: TrainRequest,
    authenticated: bool = Depends(verify_api_key)
):
    try:
        # Simulação de treinamento (apenas log por enquanto)
        print(f"[AI Train] Evento recebido: {request}")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
