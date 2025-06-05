const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');

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
let studentScores = {}; // studentId -> { correct, wrong, total }
let globalTimerValue = 180; // Default timer in seconds

function saveData() {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ students: savedStudents, questionBank, teacherPassword, studentScores, globalTimerValue }, null, 2)
  );
}

// Load scores and timer if available
if (fs.existsSync(DATA_FILE)) {
  try {
    const { studentScores: loadedScores, globalTimerValue: loadedTimer } = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (loadedScores) studentScores = loadedScores;
    if (loadedTimer) globalTimerValue = loadedTimer;
  } catch (e) {}
}

wss.on('connection', (ws, req) => {
  ws.role = 'unknown';

  ws.on('message', (message) => {
    const msgStr = message.toString();
    const data = JSON.parse(msgStr);

    switch (data.type) {
      case 'registerTeacher':
        ws.role = 'teacher';
        teachers.push(ws);
        // Send current timer value to teacher
        ws.send(JSON.stringify({ type: 'currentTimerValue', value: globalTimerValue }));
        break;

      case 'setGlobalTimer':
        if (ws.role === 'teacher' && typeof data.value === 'number') {
          globalTimerValue = data.value;
          saveData();
          // Notify all connected teachers of the update
          teachers.forEach(tws => {
            if (tws.readyState === WebSocket.OPEN) {
              tws.send(JSON.stringify({ type: 'currentTimerValue', value: globalTimerValue }));
            }
          });
        }
        break;

      case 'getQuestionsForSubject':
        if (ws.role === 'teacher') {
          const subject = data.subject;
          ws.send(JSON.stringify({
            type: 'questionsForSubject',
            subject: subject,
            questions: questionBank[subject] || []
          }));
        }
        break;

      case 'getAllStudents':
        if (ws.role === 'teacher') {
          ws.send(JSON.stringify({
            type: 'allStudents',
            students: Object.values(savedStudents)
          }));
        }
        break;

      case 'getAllStudentPasswords':
        if (ws.role === 'teacher') {
          ws.send(JSON.stringify({
            type: 'allStudentPasswords',
            students: Object.values(savedStudents)
          }));
        }
        break;

      case 'getAllStudentScores':
        if (ws.role === 'teacher') {
          const studentData = Object.values(savedStudents).map(std => ({
            ...std,
            score: studentScores[std.id] || { correct: 0, wrong: 0, total: 0 }
          }));
          ws.send(JSON.stringify({ type: 'allStudentScores', students: studentData }));
        }
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
        studentScores[data.studentId] = { correct: 0, wrong: 0, total: 0 };
        saveData();
        ws.send(JSON.stringify({ type: 'register', status: 'success' }));
        break;

      case 'sendQuestion':
        const subjectKey = data.subject;
        const questionIndex = data.questionIndex;
        const qArr = questionBank[subjectKey] || [];
        const questionToSend = qArr[questionIndex];
        const targetStudent = students[data.studentId];
        const countdown = globalTimerValue; // Always use global value

        if (targetStudent && questionToSend) {
          const message = {
            type: 'question',
            question: questionToSend,
            countdown
          };
          targetStudent.send(JSON.stringify(message));
          lastQuestionsForStudent[data.studentId] = questionToSend;
          ws.send(JSON.stringify({
            type: 'sentQuestionToTeacher',
            studentId: data.studentId,
            question: questionToSend.question,
            choiceA: questionToSend.choiceA,
            choiceB: questionToSend.choiceB,
            choiceC: questionToSend.choiceC,
            choiceD: questionToSend.choiceD,
            countdown
          }));
          ws.send(JSON.stringify({ type: 'sendQuestion', status: 'success' }));
        } else {
          ws.send(JSON.stringify({
            type: 'sendQuestion',
            status: 'error',
            message: 'Student not connected or question not found'
          }));
        }
        break;

      case 'submitAnswer':
        const lastQuestion = lastQuestionsForStudent[data.studentId];
        let feedback = '';
        let isCorrect = false;
        if (lastQuestion && lastQuestion.correct === data.answer) {
          feedback = 'Correct!';
          isCorrect = true;
        } else {
          feedback = 'Incorrect!';
        }
        if (!studentScores[data.studentId]) {
          studentScores[data.studentId] = { correct: 0, wrong: 0, total: 0 };
        }
        studentScores[data.studentId].total += 1;
        if (isCorrect) {
          studentScores[data.studentId].correct += 1;
        } else {
          studentScores[data.studentId].wrong += 1;
        }
        saveData();

        ws.send(JSON.stringify({
          type: 'submitAnswer',
          status: 'received',
          feedback
        }));

        const answerMsg = {
          type: 'studentAnswered',
          studentId: data.studentId,
          name: savedStudents[data.studentId]?.name,
          question: lastQuestion ? lastQuestion.question : '',
          choiceA: lastQuestion ? lastQuestion.choiceA : '',
          choiceB: lastQuestion ? lastQuestion.choiceB : '',
          choiceC: lastQuestion ? lastQuestion.choiceC : '',
          choiceD: lastQuestion ? lastQuestion.choiceD : '',
          answer: data.answer,
          feedback: feedback,
          score: studentScores[data.studentId]
        };
        teachers = teachers.filter(sock => sock.readyState === WebSocket.OPEN);
        teachers.forEach(teacherWs => {
          if (teacherWs.readyState === WebSocket.OPEN && teacherWs.role === 'teacher') {
            try {
              teacherWs.send(JSON.stringify(answerMsg));
            } catch (e) {}
          }
        });
        break;

      case 'addQuestion':
        if (!questionBank[data.subject]) {
          questionBank[data.subject] = [];
        }
        questionBank[data.subject].push(data.question);
        saveData();
        break;

      case 'resetQuestions':
        if (data.subject && questionBank[data.subject]) {
          questionBank[data.subject] = [];
          saveData();
        }
        break;

      case 'resetSystem':
        savedStudents = {};
        studentScores = {};
        saveData();
        break;

      case 'resetStudents':
        savedStudents = {};
        studentScores = {};
        saveData();
        break;

      case 'login':
        const student = savedStudents[data.id];
        if (student && student.name === data.name && student.password === data.password) {
          students[data.id] = ws;
          ws.role = 'student';
          ws.send(JSON.stringify({
            type: 'login',
            status: 'success',
            studentId: data.id
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'login',
            status: 'error',
            message: 'Invalid credentials'
          }));
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
    }
  });

  ws.on('close', () => {
    for (const [id, socket] of Object.entries(students)) {
      if (socket === ws) {
        delete students[id];
        break;
      }
    }
    teachers = teachers.filter(sock => sock !== ws);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

server.on('request', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is live.');
});
