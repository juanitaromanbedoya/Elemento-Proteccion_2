document.getElementById('loginBtn').addEventListener('click', () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error');

    fetch(window.API_BASE_URL + "/api/v1/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(response => {
        if (!response.ok) throw new Error("Credenciales inválidas");
        return response.json();
    })
    .then(data => {
        localStorage.setItem("access_token", data.access_token);
        window.location.href = "/camera/";
    })
    .catch(err => {
        errorDiv.textContent = err.message;
    });
});