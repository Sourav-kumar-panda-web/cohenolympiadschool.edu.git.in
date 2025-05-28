// ---------- DEPENDENCIES ----------
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require("path");
const app = express();
const PORT = 3000;

// ---------- DATABASE PATH ----------
const dbPath = path.join(__dirname, "database", "students.db");

// ---------- MIDDLEWARE ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
}));
app.use(express.static(path.join(__dirname, 'views')));
app.use('/css', express.static(path.join(__dirname, 'assets', 'css')));
app.use('/js', express.static(path.join(__dirname, 'assets', 'js')));

// ---------- DATABASE CONNECTION ----------
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) return console.error('❌ DB error:', err.message);
  console.log('✅ Connected to SQLite database');
});
db.configure("busyTimeout", 5000);

// ---------- CREATE TABLES ----------
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      username TEXT,
      password TEXT,
      address TEXT,
      phone TEXT UNIQUE,
      school TEXT,
      class TEXT,
      division TEXT,
      percentage REAL,
      subjects TEXT,
      hobbies TEXT,
      parent_phone TEXT UNIQUE,
      math_progress INTEGER DEFAULT 0,
      science_progress INTEGER DEFAULT 0,
      english_progress INTEGER DEFAULT 0,
      lastLogin TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_phone TEXT,
      title TEXT,
      status TEXT DEFAULT 'Pending'
    )
  `);
});

// ---------- DEFAULT ADMIN CREATION ----------
const defaultAdminEmail = "admin@school.com";
const defaultAdminPassword = "admin123";

bcrypt.hash(defaultAdminPassword, 10, (err, hash) => {
  if (!err) {
    db.run(`INSERT OR IGNORE INTO admins (email, password) VALUES (?, ?)`, [defaultAdminEmail, hash]);
  }
});

// ---------- AUTH MIDDLEWARE ----------
function adminAuthMiddleware(req, res, next) {
  if (req.session && req.session.adminId) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

function studentAuthMiddleware(req, res, next) {
  if (req.session && req.session.studentId) return next();
  res.status(401).json({ error: 'Unauthorized student' });
}

// ---------- PAGE ROUTES ----------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "register.html"));
});

app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-portal', 'adminLogin.html'));
});

// ---------- STUDENT REGISTRATION ----------
app.post('/register-student', async (req, res) => {
  const {
    name, email, username, password, address, phone,
    school, studentClass, division, percentage,
    subjects, hobbies, parent_phone,
    progress_math, progress_science, progress_english
  } = req.body;

  if (!name || !email || !username || !password) {
    return res.status(400).send("Required fields are missing.");
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare(`
      INSERT INTO students (
        name, email, username, password, address, phone,
        school, class, division, percentage, subjects,
        hobbies, parent_phone, math_progress, science_progress, english_progress
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      name, email, username, hashedPassword, address, phone,
      school, studentClass, division, percentage, subjects,
      hobbies, parent_phone, progress_math, progress_science, progress_english
    ], function (err) {
      if (err) {
        console.error("Registration error:", err.message);
        return res.status(500).send("Error registering student.");
      }
      res.status(200).send("Student registered successfully.");
    });
  } catch (err) {
    console.error("Hashing error:", err.message);
    res.status(500).send("Server error");
  }
});

// ---------- STUDENT LOGIN ----------
app.post('/login-student', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM students WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, message: 'Internal error' });
    }
    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    // If using bcrypt:
    bcrypt.compare(password, user.password, (err, result) => {
      if (result) {
        req.session.userId = user.id;
        return res.json({ success: true });
      } else {
        return res.json({ success: false, message: 'Invalid credentials' });
      }
    });

    // If plain text (not recommended):
    // if (password === user.password) {
    //   req.session.userId = user.id;
    //   return res.json({ success: true });
    // } else {
    //   return res.json({ success: false, message: 'Invalid credentials' });
    // }
  });
});


// ---------- STUDENT DASHBOARD ----------
app.get("/index.html", studentAuthMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get('/student-dashboard-data', studentAuthMiddleware, (req, res) => {
  db.get('SELECT * FROM students WHERE id = ?', [req.session.studentId], (err, student) => {
    if (err || !student) return res.json({ success: false });

    db.all('SELECT * FROM assignments WHERE student_phone = ?', [student.phone], (err2, assignments) => {
      if (err2) return res.json({ success: false });

      res.json({
        success: true,
        student,
        assignments,
        progress: {
          math: student.math_progress || 0,
          science: student.science_progress || 0,
          english: student.english_progress || 0
        },
        examScores: [60, 70, 80]
      });
    });
  });
});

// ---------- PROGRESS UPDATE ----------
app.post('/update-progress', studentAuthMiddleware, (req, res) => {
  const { math, science, english } = req.body;

  db.run(
    `UPDATE students SET math_progress = ?, science_progress = ?, english_progress = ? WHERE id = ?`,
    [math, science, english, req.session.studentId],
    (err) => {
      if (err) return res.json({ success: false, message: 'Database error' });
      res.json({ success: true, message: 'Progress updated' });
    }
  );
});

// ---------- ADMIN LOGIN ----------
app.post('/admin-login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM admins WHERE email = ?', [email], (err, admin) => {
    if (err || !admin) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    bcrypt.compare(password, admin.password, (err, result) => {
      if (result) {
        req.session.adminId = admin.id;
        res.json({ success: true });
      } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    });
  });
});

// ---------- ADMIN DASHBOARD ----------
app.get('/admin-users', adminAuthMiddleware, (req, res) => {
  db.all(`SELECT id, name, school, phone FROM students`, [], (err, rows) => {
    if (err) return res.status(500).send('Error loading users');
    res.json(rows);
  });
});

app.get('/admin-dashboard-data', adminAuthMiddleware, (req, res) => {
  db.all('SELECT id, name, school, phone FROM students', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to load students' });
    res.json(rows);
  });
});

// ---------- ASSIGNMENT ROUTES ----------
app.post('/assign-task', adminAuthMiddleware, (req, res) => {
  const { student_phone, title } = req.body;
  db.run(`INSERT INTO assignments (student_phone, title) VALUES (?, ?)`, [student_phone, title], (err) => {
    if (err) return res.json({ success: false, message: 'DB Error' });
    res.json({ success: true, message: 'Task assigned' });
  });
});

app.get('/all-assignments', adminAuthMiddleware, (req, res) => {
  db.all(`SELECT * FROM assignments`, (err, rows) => {
    if (err) return res.json([]);
    res.json(rows);
  });
});

app.post('/edit-assignment', adminAuthMiddleware, (req, res) => {
  const { id, title } = req.body;
  db.run(`UPDATE assignments SET title = ? WHERE id = ?`, [title, id], (err) => {
    if (err) return res.json({ success: false, message: 'Error updating' });
    res.json({ success: true, message: 'Updated successfully' });
  });
});

app.post('/delete-assignment', adminAuthMiddleware, (req, res) => {
  const { id } = req.body;
  db.run(`DELETE FROM assignments WHERE id = ?`, [id], (err) => {
    if (err) return res.json({ success: false, message: 'Error deleting' });
    res.json({ success: true, message: 'Deleted successfully' });
  });
});

// ---------- DELETE STUDENT ----------
app.delete('/admin/users/:id', adminAuthMiddleware, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM students WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: 'Delete Error' });
    res.json({ success: true });
  });
});

// ---------- STUDENT DETAIL ----------
app.get('/student-details/:id', (req, res) => {
  const studentId = req.params.id;
  db.get('SELECT * FROM students WHERE id = ?', [studentId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Failed to get details' });
    res.json(row);
  });
});

// ---------- LOGOUT ----------
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});



