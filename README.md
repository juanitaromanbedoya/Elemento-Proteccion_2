# Verificador de EPP (Elementos de Protección Personal)

Sistema de visión artificial que detecta el uso de casco (Hardhat) y tapabocas (Mask) en imágenes o cámara en vivo, pensado para zonas industriales. Usa un modelo YOLOv8 entrenado para reconocer 10 clases (casco, no-casco, tapabocas, no-tapabocas, chaleco de seguridad, persona, cono de seguridad, maquinaria, vehículo).

## Arquitectura

| Componente | Tecnología | Despliegue |
|---|---|---|
| Backend (API) | FastAPI + ONNX Runtime | Vercel (serverless) |
| Frontend (UI) | Django | Vercel (serverless) |
| Base de datos | PostgreSQL | Neon (integrado con Vercel) |
| Modelo de IA | YOLOv8-nano → ONNX | Empaquetado con el backend |

**URLs en producción:**
- Backend: `https://elemento-proteccion-2.vercel.app`
- Frontend: `https://elemento-proteccion-2-ygnn.vercel.app`

## ¿Por qué esta arquitectura?

El plan original del curso pedía desplegar todo en Vercel. El primer obstáculo fue que el backend usaba `ultralytics` + `torch` para correr el modelo YOLOv8, y **torch pesa ~500MB**, muy por encima del límite de 250MB que tiene Vercel para funciones serverless de Python.

La solución fue **convertir el modelo de `.pt` (PyTorch) a `.onnx`** y reescribir el detector para usar `onnxruntime` en vez de `ultralytics`. Esto redujo el peso del backend a un puñado de MB y permitió que todo corriera en Vercel sin depender de un servicio externo como Render.

De la misma forma, **SQLite no sirve en un entorno serverless** (el sistema de archivos es de solo lectura/efímero entre invocaciones), así que la base de datos se migró a **PostgreSQL** (Neon, integrado directamente desde el panel de Vercel).

## Qué se corrigió durante el proceso

Al revisar el proyecto original se encontraron varios problemas que impedían el despliegue:

1. **`frontend/requirements.txt` vacío** — el frontend no tenía ni Django listado como dependencia.
2. **`backend/requirements.txt` en codificación UTF-16** — generado desde PowerShell, ilegible para pip en Linux; además le faltaban `ultralytics`, `opencv-python`, `numpy` y `python-dotenv`, aunque el código sí los usaba.
3. **`SECRET_KEY` hardcodeado** en `auth/jwt_handler.py`, ignorando el archivo `.env`.
4. **Sin `STATIC_ROOT` ni configuración de archivos estáticos** en `settings.py` de Django — causaba errores 404 en `styles.css` y los `.js` al desplegar.
5. **URLs de la API hardcodeadas a `http://127.0.0.1:8000`** en `login.js`, `register.js` y `camera.js` — hubieran roto la conexión frontend↔backend en producción. Se reemplazaron por `window.API_BASE_URL`, inyectado dinámicamente desde Django (`views.py` pasa `settings.API_BASE_URL` a cada plantilla).

## Conversión del modelo a ONNX

```bash
python -c "from ultralytics import YOLO; YOLO('models/epp_model.pt').export(format='onnx')"
```

Esto genera `epp_model.onnx` (y en modelos más grandes, un `epp_model.onnx.data` adicional con los pesos). El nuevo detector (`services/epp_detector.py`) carga el modelo con `onnxruntime`, hace el preprocesamiento manualmente (resize a 640x640, normalización, conversión BGR→RGB) y decodifica la salida cruda `[1, 14, 8400]` (4 valores de caja + 10 puntajes de clase) sin depender de `ultralytics`.

## Estructura del backend para Vercel

```
backend/
├── api/index.py        # Adaptador serverless (Mangum envuelve la app FastAPI)
├── vercel.json          # Configuración de build para Vercel
├── main.py
├── auth/
│   ├── database.py      # Conexión a Postgres vía pg8000 (driver puro Python)
│   ├── jwt_handler.py
│   └── users.py
├── services/
│   └── epp_detector.py  # Detector con onnxruntime
├── models/
│   ├── epp_model.onnx
│   └── epp_model.onnx.data
└── requirements.txt
```

> **Nota sobre el driver de Postgres:** se usó `pg8000` en vez de `psycopg2-binary` porque este último requiere compilar desde código fuente en Python 3.14 (no hay wheels precompilados todavía), y eso exige tener instalado un compilador C. `pg8000` es 100% Python puro y no tiene ese problema.

## Estructura del frontend para Vercel

```
frontend/
├── vercel.json           # @vercel/python (wsgi.py) + @vercel/static (staticfiles/)
├── staticfiles/           # Generado con collectstatic, se commitea a git
├── epp_frontend/
│   ├── wsgi.py
│   └── settings.py        # STATIC_ROOT, whitenoise, variables de entorno
└── epp_app/
    ├── views.py            # Pasa API_BASE_URL a las plantillas
    ├── templates/epp_app/
    └── static/js/          # login.js, register.js, camera.js
```

## Variables de entorno

**Backend (`backend/.env`, y en Vercel → Settings → Environment Variables):**
```
SECRET_KEY=...
ALGORITHM=HS256
DATABASE_URL=postgresql://usuario:password@host/basededatos?sslmode=require
```

**Frontend (`frontend/.env`, y en Vercel):**
```
SECRET_KEY=...
DEBUG=False
ALLOWED_HOSTS=127.0.0.1,localhost,.vercel.app
API_BASE_URL=https://elemento-proteccion-2.vercel.app
```

## Problemas comunes al instalar dependencias (Python 3.14 + Windows)

Varias librerías (`numpy`, `onnxruntime`, `psycopg2-binary`) tenían versiones fijadas en `requirements.txt` que **no cuentan con instalador precompilado para Python 3.14 en Windows**, lo que hacía que `pip` intentara compilarlas desde código fuente y fallara por falta de un compilador C. La solución fue **no fijar versiones exactas** en esas librerías (usar `>=`) para que pip elija una versión con wheel disponible.

## Ejecutar en local

```bash
# Backend
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend (en otra terminal)
cd frontend
pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py runserver 8001
```

## Despliegue en Vercel (resumen)

1. Crear una base de datos Postgres desde Vercel → Storage → Create Database.
2. Importar el repo como **dos proyectos separados** en Vercel: uno con Root Directory `backend`, otro con Root Directory `frontend`.
3. Agregar las variables de entorno correspondientes a cada uno.
4. Desplegar el backend primero, copiar su URL pública.
5. Poner esa URL como `API_BASE_URL` en las variables de entorno del frontend antes de desplegarlo.
6. Una vez ambos funcionando, restringir el CORS del backend (`allow_origins` en `main.py`) a la URL real del frontend en vez de `"*"`.


📂 Historial de commits

El desarrollo siguió una estructura de 8 commits, cada uno representando un avance funcional:

init — estructura base del proyecto
feat — módulo de autenticación (JWT)
feat — carga e inferencia del modelo YOLOv8
docs — esquemas Pydantic y documentación en Swagger
feat — interfaz UI en Django y captura de cámara
feat — integración HTTP entre Django y FastAPI
fix — optimización, manejo de errores, UI y registro de usuarios
deploy — configuración y pruebas de despliegue en producción