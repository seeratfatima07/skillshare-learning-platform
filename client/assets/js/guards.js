async function requireLogin() {
  const token = localStorage.getItem("token");
  if (!token) location.href = "/client/login.html";
}

async function requireRole(role) {
  await requireLogin();
  const user = await me(); // returns data.user now
  if (user.role !== role) {
    alert("Access denied: wrong role");
    logout();
  }
  return user;
}
