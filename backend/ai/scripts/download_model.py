import os
import requests
from tqdm import tqdm

def download_model():
    model_url = "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat.v1.0.Q4_K_M.gguf"
    target_dir = os.path.join(os.path.dirname(__file__), "..", "models")
    target_path = os.path.join(target_dir, "tinyllama-1.1b-chat.Q4_K_M.gguf")

    if not os.path.exists(target_dir):
        os.makedirs(target_dir)

    if os.path.exists(target_path):
        print(f"Modelo já existe em: {target_path}")
        return

    print(f"Iniciando download do modelo leve (TinyLlama)...")
    print(f"Isso pode levar alguns minutos (aprox. 670MB)")

    response = requests.get(model_url, stream=True)
    total_size = int(response.headers.get('content-length', 0))

    with open(target_path, 'wb') as f, tqdm(
        desc="Progresso",
        total=total_size,
        unit='iB',
        unit_scale=True,
        unit_divisor=1024,
    ) as bar:
        for data in response.iter_content(chunk_size=1024):
            size = f.write(data)
            bar.update(size)

    print(f"\nSucesso! Modelo salvo em: {target_path}")

if __name__ == "__main__":
    try:
        import tqdm
    except ImportError:
        print("Instalando dependência tqdm...")
        os.system("pip install tqdm requests")
        import tqdm
    
    download_model()
