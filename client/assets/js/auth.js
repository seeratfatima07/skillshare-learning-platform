async function login(email, password) {
  const data = await api("/api/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });

  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user)); // optional cache

  return data.user;
}

async function signup(payload) {
  return api("/api/auth/signup", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

async function me() {
  const data = await api("/api/auth/me"); // protected
  return data.user; // <-- IMPORTANT
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  location.href = "/client/login.html";
}
