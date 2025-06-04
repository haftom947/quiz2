const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');

// Create an HTTP server
const server = http.createServer();
const wss = new WebSocket.Server({ server });

const DATA_FILE = './data.json';

// Load saved data
let { students: savedStudents, questionBank, teacherPassword } = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  : { students: {}, questionBank: {}, teacherPassword: "teacher123" };

let students = {}; // studentId -> ws
let lastQuestionsForStudent = {}; // studentId -> lastQuestion
let teachers = []; // teacher WebSocket connections

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ students: savedStudents, questionBank, teacherPassword }, null, 2));
}

wss.on('connection', (ws, req) => {
  console.log('New client connected');
  ws.role = 'unknown';

  ws.on('message', (message) => {
    const msgStr = message.toString();
    console.log('Received message:', msgStr);
    const data = JSON.parse(msgStr);

    switch (data.type) {
      case 'registerTeacher':
        ws.role = 'teacher';
        teachers.push(ws);
        console.log('Registered a teacher. Total teachers:', teachers.length);
        break;

      case 'register':
        ws.role = 'student';

        if (savedStudents[data.studentId]) {
          ws.send(JSON.stringify({
            type: 'register',
            status: 'error',
            message: 'Student ID already registered.'
          }));
          return;
        }

        if (!data.studentName || !data.studentId || !data.studentPassword) {
          ws.send(JSON.stringify({
            type: 'register',
            status: 'error',
            message: 'All fields are required.'
          }));
          return;
        }

        students[data.studentId] = ws;

        savedStudents[data.studentId] = {
          name: data.studentName,
          id: data.studentId,
          password: data.studentPassword
        };

        saveData();
        ws.send(JSON.stringify({ type: 'register', status: 'success' }));
        console.log(`Student registered: ${data.studentId}`);
        break;

      case 'sendQuestion':
        const subjectKey = data.subject;
        const questionIndex = data.questionIndex;
        const qArr = questionBank[subjectKey] || [];
        const questionToSend = qArr[questionIndex];
        const targetStudent = students[data.studentId];

       if (targetStudent && questionToSend) {
  const message = {
    type: 'question',
    question: questionToSend,
  };
  targetStudent.send(JSON.stringify(message));
  lastQuestionsForStudent[data.studentId] = questionToSend;

  // Send question details to the teacher too
  ws.send(JSON.stringify({
    type: 'sentQuestionToTeacher',
    studentId: data.studentId,
    question: questionToSend.question,
    choiceA: questionToSend.choiceA,
    choiceB: questionToSend.choiceB,
    choiceC: questionToSend.choiceC,
    choiceD: questionToSend.choiceD
  }));

  ws.send(JSON.stringify({ type: 'sendQuestion', status: 'success' }));
  console.log(`Question sent to student: ${data.studentId}`);
} else {
          ws.send(JSON.stringify({
            type: 'sendQuestion',
            status: 'error',
            message: 'Student not connected or question not found',
          }));
        }
        break;

      case 'submitAnswer':
        const lastQuestion = lastQuestionsForStudent[data.studentId];
        let feedback = '';

        if (lastQuestion && lastQuestion.correct === data.answer) {
          feedback = 'Correct!';
        } else {
          feedback = 'Incorrect!';
        }

        ws.send(JSON.stringify({
          type: 'submitAnswer',
          status: 'received'
        }));

        const answerMsg = {
  type: 'studentAnswered',
  studentId: data.studentId,
  question: lastQuestion ? lastQuestion.question : '',
  choiceA: lastQuestion ? lastQuestion.choiceA : '',
  choiceB: lastQuestion ? lastQuestion.choiceB : '',
  choiceC: lastQuestion ? lastQuestion.choiceC : '',
  choiceD: lastQuestion ? lastQuestion.choiceD : '',
  answer: data.answer,
  feedback: feedback
};

        teachers = teachers.filter(sock => sock.readyState === WebSocket.OPEN);
        teachers.forEach(teacherWs => {
          if (teacherWs.readyState === WebSocket.OPEN && teacherWs.role === 'teacher') {
            try {
              teacherWs.send(JSON.stringify(answerMsg));
            } catch (e) {
              console.log('Error sending to teacher:', e.message);
            }
          }
        });
        break;

      case 'addQuestion':
        if (!questionBank[data.subject]) {
          questionBank[data.subject] = [];
        }
        questionBank[data.subject].push(data.question);
        saveData();
        console.log(`Question added to ${data.subject}:`, data.question);
        break;

      case 'resetQuestions':
        if (data.subject && questionBank[data.subject]) {
          questionBank[data.subject] = [];
          saveData();
          console.log(`Questions for subject "${data.subject}" have been reset.`);
        }
        break;

      case 'resetSystem':
        savedStudents = {};
        saveData();
        console.log('System reset: All students cleared.');
        break;

      case 'resetStudents':
        savedStudents = {};
        saveData();
        console.log('All student data has been reset.');
        break;

      case 'login':
        const student = savedStudents[data.id];
        if (student && student.name === data.name && student.password === data.password) {
          students[data.id] = ws;
          ws.role = 'student';
          ws.send(JSON.stringify({ type: 'login', status: 'success', studentId: data.id }));
          console.log(`Student logged in: ${data.id}`);
        } else {
          ws.send(JSON.stringify({
            type: 'login',
            status: 'error',
            message: 'Invalid credentials'
          }));
          console.log(`Failed login for ID: ${data.id}`);
        }
        break;

      case 'getTeacherPassword':
        ws.send(JSON.stringify({
          type: 'getTeacherPassword',
          password: teacherPassword || "teacher123"
        }));
        break;

      case 'setTeacherPassword':
        if (data.currentPassword !== teacherPassword) {
          ws.send(JSON.stringify({
            type: 'setTeacherPassword',
            status: 'error',
            message: 'Current password is incorrect.'
          }));
        } else if (!data.newPassword || data.newPassword.length < 4) {
          ws.send(JSON.stringify({
            type: 'setTeacherPassword',
            status: 'error',
            message: 'New password must be at least 4 characters.'
          }));
        } else {
          teacherPassword = data.newPassword;
          saveData();
          ws.send(JSON.stringify({ type: 'setTeacherPassword', status: 'success' }));
        }
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');

    // Remove from students
    for (const [id, socket] of Object.entries(students)) {
      if (socket === ws) {
        delete students[id];
        console.log(`Student disconnected: ${id}`);
        break;
      }
    }

    // Remove from teachers
    teachers = teachers.filter(sock => sock !== ws);
  });
});

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Minimal HTTP response to satisfy Render port scanner
server.on('request', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is live.');
});
