const ws = new WebSocket(process.env.SOCKET_URL); // Use your actual PC IP

ws.onopen = () => {
  console.log('Connected to WebSocket server');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Message from server:', data);
};

document.addEventListener('DOMContentLoaded', () => {

  let selectionMethod = document.querySelector('.js-question-entry-button');
  if (selectionMethod) {
    selectionMethod.addEventListener('click', () => {
      let question = document.querySelector('.js-question-entry');
      question.classList.add('makeit-visible');
    });
  }

  const registerButton = document.querySelector('.js-register-button');
  if (registerButton) {
    registerButton.addEventListener('click', () => {
      let stdName = document.querySelector('.student-name').value.trim();
      let stdId = document.querySelector('.student-id').value.trim();
      let stdPassword = document.querySelector('.student-password').value.trim();

      const studentObj = {
        type: 'register',
        studentName: stdName,
        studentId: stdId,
        studentPassword: stdPassword,
      };

      ws.send(JSON.stringify(studentObj));
      alert(`Student ${stdName} registered successfully.`);
    });
  }

  const removeButton = document.querySelector('.js-remove-button');
  if (removeButton) {
    removeButton.addEventListener('click', () => {
      if (ws.readyState === WebSocket.OPEN) { // Ensure WebSocket is open
        const resetData = { type: 'resetStudents' }; // Message type for resetting students
        ws.send(JSON.stringify(resetData)); // Send the reset message to the server
        alert('All student data has been reset.');
      } else {
        alert('WebSocket connection is not open. Please refresh the page.');
      }
    });
  }

  const resetButton = document.querySelector('.js-reset-system-button');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      const resetData = { type: 'resetSystem' };
      ws.send(JSON.stringify(resetData));
      alert('All students have been reset.');
    });
  }

  const sendButton = document.querySelector('.send-button');
  if (sendButton) {
    sendButton.addEventListener('click', () => {
      const selectedStudentId = document.getElementById('student-id').value;
      console.log(selectedStudentId)   
       const selectedSubject = document.getElementById('subject').value;
             const selectedQuestionIndex = document.getElementById('question-no').value;

      // Capitalize subject to match server keys
      const subjectKey = selectedSubject.charAt(0).toUpperCase() + selectedSubject.slice(1);
      const questionIndex = parseInt(selectedQuestionIndex.replace('q', '')) - 1;

      const questionData = {
        type: 'sendQuestion',
        studentId: selectedStudentId,
        subject: subjectKey,
        questionIndex: questionIndex
      };

      ws.send(JSON.stringify(questionData));
      alert(`Question sent to student ID: ${selectedStudentId}`);
    });
  }

  const questionEntryButton = document.querySelector('.js-question-entry-button');
  if (questionEntryButton) {
    questionEntryButton.addEventListener('click', () => {
      const questionEntryDiv = document.querySelector('.js-question-entry');
      if (questionEntryDiv) {
        questionEntryDiv.classList.add('makeit-visible'); // Make the subject selection visible
      }
    });

    const subjectDropdown = document.getElementById('subject-question');
    if (subjectDropdown) {
      subjectDropdown.addEventListener('change', () => {
        const selectedSubject = subjectDropdown.value;
        if (selectedSubject && selectedSubject !== 'nothing') {
          // Redirect to question-web.html with the selected subject
          window.location.href = `question-web.html?subject=${encodeURIComponent(selectedSubject)}`;
        }
      });
    }
  }
});
