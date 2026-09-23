from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, detect
from auth.database import init_db

init_db()  # crea la tabla de usuarios si no existe

app = FastAPI(
    title="EPP Verificador API",
    description="API para verificar el uso de Elementos de Proteccion Personal (casco y tapabocas) mediante deteccion con YOLOv8.",
    version="1.0.0"
)

# Middleware CORS - permite que el frontend Django (Vercel) consuma esta API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restringir a la URL real de Vercel una vez confirmada
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(detect.router)

@app.get("/")
def root():
    return {"message": "EPP Verificador API - FastAPI"}