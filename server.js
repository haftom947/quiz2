const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');

// Create an HTTP server
const server = http.createServer();
const wss = new WebSocket.Server({ server });

const DATA_FILE = './data.json';

// Load data from file
let { students: savedStudents, questionBank, teacherPassword } = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  : { students: {}, questionBank: {}, teacherPassword: "teacher123" };

// In-memory WebSocket connections
let students = {};
let lastQuestionsForStudent = {}; 
let teachers = []; // To store teacher sockets
// { studentId: questionObj }


// Save data to file
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ students: savedStudents, questionBank, teacherPassword 
  }, null, 2));
}
wss.on('connection', (ws, req) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    const msgStr = message.toString();
    console.log('Received message:', msgStr);
    const data = JSON.parse(msgStr);

    switch (data.type) {
        case 'registerTeacher':
          teachers.push(ws);
          break;
      case 'register':
        if (savedStudents[data.studentId]) {
    ws.send(JSON.stringify({
      type: 'register',
      status: 'error',
      message: 'Student ID already registered.'
    }));
    console.log(`Duplicate registration attempt for student ID: ${data.studentId}`);
    return; // Stop further processing
  }

  // Validate required fields (name, ID, password)
  if (!data.studentName || !data.studentId || !data.studentPassword) {
    ws.send(JSON.stringify({
      type: 'register',
      status: 'error',
      message: 'All fields are required.'
    }));
    console.log('Registration failed: Missing fields.');
    return;
  }

        // Store the WebSocket connection in memory
        students[data.studentId] = ws;
        console.log('Student WebSocket registered:', data.studentId);

        // Add the student to savedStudents if not already present
        if (!savedStudents[data.studentId]) {
          savedStudents[data.studentId] = {
            name: data.studentName,
            id: data.studentId,
            password: data.studentPassword,
          };
          saveData();
          console.log(`Student registered: ${data.studentId}`);
        }
        ws.send(JSON.stringify({ type: 'register', status: 'success' }));
        break;

      case 'sendQuestion':
        let questionToSend = null;
        if (data.subject && typeof data.questionIndex === 'number') {
          const subjectKey = data.subject;
          const qArr = questionBank[subjectKey] || [];
          questionToSend = qArr[data.questionIndex];
          console.log('Looking for question:', subjectKey, 'Found:', !!questionToSend);
          console.log('Looking for question:',data.questionIndex, 'Found:', !!questionToSend);
        }
        const targetStudent = students[data.studentId];
        console.log('Looking for student:', data.studentId, 'Found:', !!targetStudent);
        if (targetStudent && questionToSend) {
          const message = {
            type: 'question',
            question: questionToSend,
          };
          console.log('Sending to student:', data.studentId, message);
          targetStudent.send(JSON.stringify(message));
          lastQuestionsForStudent[data.studentId] = questionToSend;
          ws.send(JSON.stringify({ type: 'sendQuestion', status: 'success' }));
          console.log(`Question sent to student: ${data.studentId}`);
        } else {
          ws.send(
            JSON.stringify({
              type: 'sendQuestion',
              status: 'error',
              message: 'Student not connected or question not found',
            
            })
          );
          if (!targetStudent) {
            console.log('Student not connected:', data.studentId);
          }
          if (!questionToSend) {
            console.log('Question not found for subject/index:', data.subject, data.questionIndex);
          }
        }
        break;
       

  case 'getTeacherPassword':
    ws.send(JSON.stringify({
      type: 'getTeacherPassword',
      password: teacherPassword || "teacher123" // For checking password
    }));
    break;

  case 'setTeacherPassword':
    // Optionally, you can check the current password for security
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
      ws.send(JSON.stringify({
        type: 'setTeacherPassword',
        status: 'success'
      }));
    }
    break;

  // ... rest of your cases ...


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
        status: 'received',
    }));

    // Send to all teachers
    const answerMsg = {
        type: 'studentAnswered',
        studentId: data.studentId,
        question: lastQuestion ? lastQuestion.question : '',
        answer: data.answer,
        feedback: feedback
    };
    teachers.forEach(teacherWs => {
        try { teacherWs.send(JSON.stringify(answerMsg)); } catch {}
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
        } else {
          console.log(`Invalid subject or subject not found: ${data.subject}`);
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
        console.log('Login attempt:', data);
        const student = savedStudents[data.id];
        console.log('Student from DB:', student);
        if (
          student &&
          student.name === data.name &&
          student.password === data.password
        ) {
          students[data.id] = ws; // Register the WebSocket on login
          ws.send(
            JSON.stringify({
              type: 'login',
              status: 'success',
              studentId: data.id,
            })
          );
          console.log(`Student logged in: ${data.id}`);
        } else {
          ws.send(
            JSON.stringify({
              type: 'login',
              status: 'error',
              message: 'Invalid credentials',
            })
          );
          console.log(`Failed login attempt for student ID: ${data.id}`);
        }
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    for (const [id, socket] of Object.entries(students)) {
      if (socket === ws) {
        delete students[id];
        console.log(`Student disconnected: ${id}`);
        break;
      }
    }
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
