<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Teacher Login</title>
  <link rel="stylesheet" href="kshs.css">
</head>
<body>
  <div class="login-form">
    <h2>Teacher Login</h2>
    <input type="password" id="teacher-password" placeholder="Enter Password" required>
    <button id="login-button">Login</button>
    <p id="error-message" style="color: red; display: none;">Invalid password. Please try again.</p>
    <button id="show-change-password" style="margin-top:10px;">Change Password</button>
    <div id="change-password-section" style="display:none; margin-top:10px;">
      <input type="password" id="current-teacher-password" placeholder="Current Password">
      <input type="password" id="new-teacher-password" placeholder="New Password" style="margin-top:5px;">
      <button id="change-password-button">Save New Password</button>
      <p id="change-password-message" style="color: green; display: none;">Password changed!</p>
      <p id="change-password-error" style="color: red; display: none;">Current password incorrect.</p>
    </div>
  </div>
  <script>
    // Only set default password if it has never been set (null), not if it's empty or already set
    if (localStorage.getItem('teacherPassword') === null) {
      localStorage.setItem('teacherPassword', 'teacher123');
    }

    document.getElementById('login-button').addEventListener('click', () => {
      const password = document.getElementById('teacher-password').value;
      const correctPassword = localStorage.getItem('teacherPassword');

      if (password === correctPassword) {
        localStorage.setItem('isTeacherAuthenticated', 'true');
        window.location.href = 'kshs.html';
      } else {
        document.getElementById('error-message').style.display = 'block';
      }
    });

    document.getElementById('show-change-password').addEventListener('click', () => {
      document.getElementById('change-password-section').style.display = 'block';
      document.getElementById('change-password-message').style.display = 'none';
      document.getElementById('change-password-error').style.display = 'none';
      document.getElementById('current-teacher-password').value = '';
      document.getElementById('new-teacher-password').value = '';
    });

    document.getElementById('change-password-button').addEventListener('click', () => {
      const currentPassword = document.getElementById('current-teacher-password').value;
      const newPassword = document.getElementById('new-teacher-password').value;
      const storedPassword = localStorage.getItem('teacherPassword');
      const msg = document.getElementById('change-password-message');
      const err = document.getElementById('change-password-error');
      msg.style.display = 'none';
      err.style.display = 'none';

      if (currentPassword !== storedPassword) {
        err.textContent = 'Current password incorrect.';
        err.style.display = 'block';
        return;
      }
      if (newPassword.length < 4) {
        err.textContent = 'New password must be at least 4 characters.';
        err.style.display = 'block';
        return;
      }
      localStorage.setItem('teacherPassword', newPassword);
      msg.style.display = 'block';
      setTimeout(() => {
        msg.style.display = 'none';
        document.getElementById('change-password-section').style.display = 'none';
      }, 1500);
    });
  </script>
</body>
</html>
