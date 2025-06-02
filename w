
  const ws = new WebSocket(process.env.SOCKET_URL); // Use your computer's IP here

  ws.onopen = () => {
    console.log('Connected to WebSocket server');
  

  document.querySelector('.js-log-in-button').addEventListener('click', () => {
    // Hide error message before attempting login
    const errorMsg = document.getElementById('error-message');
    if (errorMsg) errorMsg.style.display = 'none';

    const studentName = document.querySelector('.student-name1').value.trim();
    const studentId = document.querySelector('.student-id1').value.trim();
    const studentPassword = document.querySelector('.student-password1').value.trim();
    

    const loginData = {
      type: 'login',
      name: studentName,
      id: studentId,
      password: studentPassword
    };

    ws.send(JSON.stringify(loginData));
  });

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'login' && data.status === 'success') {
      localStorage.setItem('isStudentAuthenticated', 'true');
      localStorage.setItem('currentStudentId', data.studentId);
      // Hide error message on success
      const errorMsg = document.getElementById('error-message');
      if (errorMsg) errorMsg.style.display = 'none';
      window.location.href = 'student-question.html';
    } else if (data.type === 'login' && data.status === 'error') {
      // Show error message on failure
      const errorMsg = document.getElementById('error-message');
      if (errorMsg) errorMsg.style.display = 'block';
    }
    console.log(data.type, data.status)
  };
};
