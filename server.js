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
          ws.send(JSON.stringify({ type: 'sendQuestion', statu
