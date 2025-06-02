const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');

const DATA_FILE = './data.json';
const PORT = process.env.PORT || 8080;

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Load existing or initialize data
let { students = {}, teacher = {}, questionBank = {}, answers = {} } =
  fs.existsSync(DATA_FILE)
    ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    : { students: {}, teacher: {}, questionBank: {}, answers: {} };

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ students, teacher, questionBank, answers }, null, 2));
}

let studentSockets = {}; // { studentId: ws }

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON.' }));
      return;
    }

    // Student Registration
    if (data.type === 'register') {
      if (!data.studentName || !data.studentId || !data.studentPassword) {
        ws.send(JSON.stringify({ type: 'register', status: 'error', message: 'All fields are required.' }));
      } else if (students[data.studentId]) {
        ws.send(JSON.stringify({ type: 'register', status: 'error', message: 'Student already registered.' }));
      } else {
        students[data.studentId] = {
          name: data.studentName,
          id: data.studentId,
          password: data.studentPassword
        };
        saveData();
        ws.send(JSON.stringify({ type: 'register', status: 'success', message: 'Registration successful.' }));
      }
      return;
    }

    // Teacher Login (set or check password)
    if (data.type === 'loginTeacher') {
      if (!data.password) {
        ws.send(JSON.stringify({ type: 'loginTeacher', status: 'error', message: 'Password required.' }));
      } else if (!teacher.password) {
        teacher.password = data.password;
        saveData();
        ws.send(JSON.stringify({ type: 'loginTeacher', status: 'success', message: 'Password set. Welcome!' }));
      } else if (teacher.password === data.password) {
        ws.send(JSON.stringify({ type: 'loginTeacher', status: 'success', message: 'Login successful.' }));
      } else {
        ws.send(JSON.stringify({ type: 'loginTeacher', status: 'error', message: 'Incorrect password.' }));
      }
      return;
    }

    // Add Question (by teacher)
    if (data.type === 'addQuestion') {
      if (!data.subject || !data.question) {
        ws.send(JSON.stringify({ type: 'addQuestion', status: 'error', message: 'Subject and question required.' }));
      } else {
        if (!questionBank[data.subject]) questionBank[data.subject] = [];
        questionBank[data.subject].push(data.question);
        saveData();
        ws.send(JSON.stringify({ type: 'addQuestion', status: 'success', message: 'Question added.' }));
      }
      return;
    }

    // Send Question to Student
    if (data.type === 'sendQuestion') {
      const { studentId, subject, questionIndex } = data;
      if (!students[studentId]) {
        ws.send(JSON.stringify({ type: 'sendQuestion', status: 'error', message: 'Student not registered.' }));
        return;
      }
      if (!questionBank[subject] || !questionBank[subject][questionIndex]) {
        ws.send(JSON.stringify({ type: 'sendQuestion', status: 'error', message: 'Question not found.' }));
        return;
      }
      const q = questionBank[subject][questionIndex];
      if (studentSockets[studentId]) {
        studentSockets[studentId].send(JSON.stringify({ type: 'question', subject, question: q, questionIndex }));
        ws.send(JSON.stringify({ type: 'sendQuestion', status: 'success', message: 'Question sent.' }));
      } else {
        ws.send(JSON.stringify({ type: 'sendQuestion', status: 'error', message: 'Student not connected.' }));
      }
      return;
    }

    // Student submits answer
    if (data.type === 'submitAnswer') {
      const { studentId, subject, questionIndex, answer } = data;
      if (!students[studentId]) {
        ws.send(JSON.stringify({ type: 'submitAnswer', status: 'error', message: 'Student not registered.' }));
        return;
      }
      if (!answers[studentId]) answers[studentId] = [];
      answers[studentId].push({ subject, questionIndex, answer });
      saveData();
      ws.send(JSON.stringify({ type: 'submitAnswer', status: 'success', message: 'Answer submitted.' }));
      return;
    }

    // Student login (optional, for session mgmt)
    if (data.type === 'loginStudent') {
      if (!students[data.studentId]) {
        ws.send(JSON.stringify({ type: 'loginStudent', status: 'error', message: 'Student not found.' }));
      } else if (students[data.studentId].password !== data.studentPassword) {
        ws.send(JSON.stringify({ type: 'loginStudent', status: 'error', message: 'Incorrect password.' }));
      } else {
        studentSockets[data.studentId] = ws;
        ws.send(JSON.stringify({ type: 'loginStudent', status: 'success', message: 'Login successful.' }));
      }
      return;
    }

    // List all questions for a subject (teacher or student)
    if (data.type === 'listQuestions') {
      const { subject } = data;
      if (!questionBank[subject]) {
        ws.send(JSON.stringify({ type: 'listQuestions', status: 'error', message: 'Subject not found.' }));
      } else {
        ws.send(JSON.stringify({ type: 'listQuestions', status: 'success', questions: questionBank[subject] }));
      }
      return;
    }

    // List all answers for a student (teacher)
    if (data.type === 'listAnswers') {
      const { studentId } = data;
      ws.send(JSON.stringify({
        type: 'listAnswers',
        status: 'success',
        answers: answers[studentId] || []
      }));
      return;
    }

    // Remove student (teacher)
    if (data.type === 'removeStudent') {
      if (students[data.studentId]) {
        delete students[data.studentId];
        saveData();
        ws.send(JSON.stringify({ type: 'removeStudent', status: 'success', message: 'Student removed.' }));
      } else {
        ws.send(JSON.stringify({ type: 'removeStudent', status: 'error', message: 'Student not found.' }));
      }
      return;
    }

    ws.send(JSON.stringify({ type: 'error', message: 'Unknown or unhandled message type.' }));
  });

  ws.on('close', () => {
    // Remove student socket on disconnect
    for (const [id, socket] of Object.entries(studentSockets)) {
      if (socket === ws) {
        delete studentSockets[id];
        break;
      }
    }
  });
});

server.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
server.on('request', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is live.');
});
