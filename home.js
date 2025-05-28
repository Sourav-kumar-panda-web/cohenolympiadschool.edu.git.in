  // SESSION KEY used for frontend display logic (fallback)
  const SESSION_KEY = 'isLoggedIn';

  window.onload = function () {
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const studentProfileBtn = document.getElementById('student-profile-btn');
    const userWelcome = document.getElementById('user-welcome');
    const authButtons = document.getElementById('auth-buttons');
    const usernameDisplay = document.getElementById('usernameDisplay');

    // Get username injected from server
    const currentUser = "<%= username ? username : '' %>";

    // If user is logged in (via session from backend)
    const isLoggedIn = currentUser !== "";

    function updateAuthButtons() {
      if (isLoggedIn) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
        if (studentProfileBtn) studentProfileBtn.style.display = 'inline-block';

        if (authButtons) authButtons.style.display = 'none';
        if (userWelcome) userWelcome.style.display = 'block';
        if (usernameDisplay) usernameDisplay.textContent = currentUser;

        // Optional: sync to sessionStorage (for other pages)
        sessionStorage.setItem(SESSION_KEY, 'true');
      } else {
        if (loginBtn) loginBtn.style.display = 'inline-block';
        if (registerBtn) registerBtn.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (studentProfileBtn) studentProfileBtn.style.display = 'none';

        if (authButtons) authButtons.style.display = 'block';
        if (userWelcome) userWelcome.style.display = 'none';

        sessionStorage.setItem(SESSION_KEY, 'false');
      }
    }

    updateAuthButtons();

    // Logout handler
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();

        fetch('/logout', { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              sessionStorage.removeItem(SESSION_KEY);
              alert("Logged out successfully!");
              window.location.href = '/login'; // or /home
            }
          })
          .catch(err => {
            console.error("Logout failed:", err);
            alert("Logout error.");
          });
      });
    }
  };

  // Hamburger Menu Toggle
  function toggleMenu() {
    const navLinks = document.getElementById('navLinks');
    navLinks.classList.toggle('active');
  }