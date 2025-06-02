const ws = new WebSocket(process.env.SOCKET_URL);

ws.onopen = () => {
  console.log('Connected to WebSocket server');
};

let subject;

window.onload = function () {
  const urlParams = new URLSearchParams(window.location.search);
  subject = urlParams.get('subject');
  if (!subject) {
    alert('No subject selected. Redirecting to the host page.');
    window.location.href = 'kshs.html';
    return;
  }
  subject = subject.charAt(0).toUpperCase() + subject.slice(1);
  document.title = `Enter questions for ${subject}`;
  document.querySelector('.subject-title').textContent = `Questions for ${subject}`;
};

let question, choiceA, choiceB, choiceC, choiceD, correctAnswer;
document.querySelector('.save-question').addEventListener('click', function () {
  question = document.querySelector('.js-text-area').value;
  choiceA = document.querySelector('.choice-a').value;
  choiceB = document.querySelector('.choice-b').value;
  choiceC = document.querySelector('.choice-c').value;
  choiceD = document.querySelector('.choice-d').value;
  correctAnswer = document.querySelector('.correct-answer').value.toUpperCase(); // Normalize to uppercase

  if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
    alert("Correct answer must be one of A, B, C, or D.");
    return;
  }

  const questionObj = {
    type: 'addQuestion',
    subject,
    question: {
      question,
      choiceA,
      choiceB,
      choiceC,
      choiceD,
      correct: correctAnswer,
    },
  };

  ws.send(JSON.stringify(questionObj));
  alert('Question saved successfully.');
});

document.querySelector('.js-reset-question').addEventListener('click', () => {
  const resetData = {
    type: 'resetQuestions',
    subject, // Use the selected subject
  };

  ws.send(JSON.stringify(resetData)); // Send the reset message to the server
  alert(`Questions for ${subject} have been reset.`);
});

let sendButton = document.querySelector('.send-button');
if (sendButton) {
  sendButton.addEventListener('click', () => {
    const selectedStudentId = document.getElementById('student-id').value.toUpperCase(); // Normalize to uppercase
    const selectedSubject = document.getElementById('subject').value;
    const selectedQuestionIndex = document.getElementById('question-no').value;

    const questionBank = JSON.parse(localStorage.getItem('questionBank')) || {};

    if (!studentsList[selectedStudentId]) {
      alert(`Student with ID ${selectedStudentId} not found.`);
      return;
    }

    const capitalizedSubject = selectedSubject.charAt(0).toUpperCase() + selectedSubject.slice(1);
    const questionIndex = parseInt(selectedQuestionIndex.replace('q', '')) - 1;

    if (!questionBank[capitalizedSubject] || !questionBank[capitalizedSubject][questionIndex]) {
      alert(`No question found for subject: ${capitalizedSubject}, question: ${selectedQuestionIndex}`);
      return;
    }

    const questionData = {
      subject: capitalizedSubject,
      questionIndex,
      question: questionBank[capitalizedSubject][questionIndex]
    };

    // Overwrite the previous question for the student
    localStorage.setItem(`questionFor_${selectedStudentId}`, JSON.stringify(questionData));
    alert(`Question sent to student ID: ${selectedStudentId}`);
  });
}
