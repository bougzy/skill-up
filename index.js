// index.js
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const port = 5000;

// Connect to MongoDB
mongoose.connect('mongodb+srv://wek:wek@wek.1vzyud9.mongodb.net/wek', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected...'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define the User schema and model
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  skillToLearn: { type: String, required: true },
  churchOrParish: { type: String },
  proofOfPayment: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/register', upload.single('proofOfPayment'), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('Proof of Payment file is required');
    }

    const newUser = new User({
      fullName: req.body.fullName,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
      skillToLearn: req.body.skillToLearn,
      churchOrParish: req.body.churchOrParish,
      proofOfPayment: '/uploads/' + req.file.filename
    });

    await newUser.save();
    res.redirect('/success');
  } catch (err) {
    console.error('Error registering user:', err.message);
    res.status(500).send('Error registering user: ' + err.message);
  }
});

app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    let userListHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registered Users</title>
        <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css">
      </head>
      <body>
        <div class="container mt-5">
          <h2>Registered Users</h2>
          <table class="table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Phone Number</th>
                <th>Skill to Learn</th>
                <th>Church/Parish</th>
                <th>Proof of Payment</th>
              </tr>
            </thead>
            <tbody>`;
    users.forEach((user, index) => {
      userListHTML += `
        <tr>
          <td>${user.fullName}</td>
          <td>${user.email}</td>
          <td>${user.phoneNumber}</td>
          <td>${user.skillToLearn}</td>
          <td>${user.churchOrParish || ''}</td>
          <td>
            <img src="${user.proofOfPayment}" alt="Proof of Payment" style="max-width: 100px;" data-toggle="modal" data-target="#modal-${index}">
          </td>
        </tr>
        <!-- Modal -->
        <div class="modal fade" id="modal-${index}" tabindex="-1" role="dialog" aria-labelledby="modalLabel-${index}" aria-hidden="true">
          <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="modalLabel-${index}">Proof of Payment</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <div class="modal-body">
                <img src="${user.proofOfPayment}" alt="Proof of Payment" class="img-fluid">
              </div>
            </div>
          </div>
        </div>`;
    });
    userListHTML += `
            </tbody>
          </table>
        </div>
        <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.5.4/dist/umd/popper.min.js"></script>
        <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/js/bootstrap.min.js"></script>
      </body>
      </html>`;
    res.send(userListHTML);
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).send('Error fetching users: ' + err.message);
  }
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
