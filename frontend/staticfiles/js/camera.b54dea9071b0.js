const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const fileInput = document.getElementById('fileInput');
const actionBtn = document.getElementById('actionBtn');
const resultDiv = document.getElementById('result');

const tabUpload = document.getElementById('tabUpload');
const tabCamera = document.getElementById('tabCamera');
const uploadZone = document.getElementById('uploadZone');
const cameraZone = document.getElementById('cameraZone');
const panelTitle = document.getElementById('panelTitle');
const panelSubtitle = document.getElementById('panelSubtitle');

const BACKEND_URL = window.API_BASE_URL + "/api/v1/detect-epp";

const token = localStorage.getItem("access_token");
if (!token) window.location.href = "/";

let mode = "upload"; // "upload" | "camera"
let stream = null;
let selectedFile = null;

// --- Cambiar de pestaña ---
tabUpload.addEventListener('click', () => switchMode("upload"));
tabCamera.addEventListener('click', () => switchMode("camera"));

function switchMode(newMode) {
    mode = newMode;
    tabUpload.classList.toggle("active", mode === "upload");
    tabCamera.classList.toggle("active", mode === "camera");
    uploadZone.style.display = mode === "upload" ? "flex" : "none";
    cameraZone.style.display = mode === "camera" ? "flex" : "none";
    panelTitle.textContent = mode === "upload" ? "Sube tu imagen" : "Captura con tu cámara";
    panelSubtitle.textContent = mode === "upload"
        ? "Selecciona una fotografía para analizarla"
        : "Colócate frente a la cámara y captura";
    actionBtn.textContent = mode === "upload" ? "Procesar imagen" : "Capturar y Verificar";

    if (mode === "camera" && !stream) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(s => { stream = s; video.srcObject = s; })
            .catch(err => showResult("No se pudo acceder a la cámara: " + err.message, false));
    }
}

// --- Selección de archivo ---
uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
        const imgUrl = URL.createObjectURL(selectedFile);
        uploadZone.innerHTML = `
            <img src="${imgUrl}" alt="Vista previa">
        `;
    }
});

// --- Botón principal ---
actionBtn.addEventListener('click', () => {
    if (mode === "upload") {
        if (!selectedFile) {
            showResult("Primero selecciona una imagen", false);
            return;
        }
        sendToBackend(selectedFile);
    } else {
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => sendToBackend(blob), "image/jpeg");
    }
});

function showResult(text, success) {
    resultDiv.textContent = text;
    resultDiv.className = "result-box" + (success === null ? "" : success ? " compliant" : " non-compliant");
}

function sendToBackend(fileOrBlob) {
    const formData = new FormData();
    formData.append("file", fileOrBlob, "capture.jpg");

    showResult("Verificando...", null);

    fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Authorization": "Bearer " + token },
        body: formData
    })
    .then(response => {
        if (response.status === 401) {
            localStorage.removeItem("access_token");
            window.location.href = "/";
            throw new Error("Sesión expirada");
        }
        return response.json();
    })
.then(data => {
    const helmet = data.helmet_detected ? "✅ Casco detectado" : "❌ Sin casco";
    const mask = data.mask_detected ? "✅ Tapabocas detectado" : "❌ Sin tapabocas";
    const isCompliant = data.status === "COMPLIANT";
    const statusText = isCompliant
        ? "ES COMPATIBLE CON LOS PARÁMETROS DE SEGURIDAD"
        : "NO ES COMPATIBLE CON LOS PARÁMETROS DE SEGURIDAD";
    resultDiv.innerHTML = `${helmet}<br>${mask}<br><br>${statusText}`;
    resultDiv.className = "result-box " + (isCompliant ? "compliant" : "non-compliant");
})
    .catch(err => {
        if (err.message !== "Sesión expirada") showResult("Error: " + err.message, false);
    });
}