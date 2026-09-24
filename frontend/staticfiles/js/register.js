document.getElementById('registerBtn').addEventListener('click', () => {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorDiv = document.getElementById('error');
    const successDiv = document.getElementById('success');

    errorDiv.textContent = "";
    successDiv.textContent = "";

    if (!username || !password) {
        errorDiv.textContent = "Completa todos los campos";
        return;
    }
    if (password !== confirmPassword) {
        errorDiv.textContent = "Las contraseñas no coinciden";
        return;
    }

    fetch(window.API_BASE_URL + "/api/v1/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Error al registrarse");
        return data;
    })
    .then(() => {
        successDiv.textContent = "¡Cuenta creada! Redirigiendo al login...";
        setTimeout(() => { window.location.href = "/"; }, 1500);
    })
    .catch(err => {
        errorDiv.textContent = err.message;
    });
});