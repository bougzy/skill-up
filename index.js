const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const PDFDocument = require('pdfkit');

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
  center: { type: String, required: true },
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
      center: req.body.center,
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
    // Get page and limit from query parameters, set default values if not provided
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Calculate the starting index of the documents to fetch
    const startIndex = (page - 1) * limit;

    // Fetch users from the database with pagination
    const users = await User.find().skip(startIndex).limit(limit);

    // Get the total count of users to calculate total pages
    const totalUsers = await User.countDocuments();
    const totalPages = Math.ceil(totalUsers / limit);

    // Generate the HTML response with pagination controls
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
          <a href="/users/download" class="btn btn-primary mb-3">Download as PDF</a>
          <table class="table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Phone Number</th>
                <th>Skill to Learn</th>
                <th>Church/Parish</th>
                <th>Center</th>
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
          <td>${user.center}</td>
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
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>`;
    });

    userListHTML += `
            </tbody>
          </table>
          <nav>
            <ul class="pagination justify-content-center">`;

    // Generate pagination controls
    for (let i = 1; i <= totalPages; i++) {
      userListHTML += `
        <li class="page-item ${i === page ? 'active' : ''}">
          <a class="page-link" href="/users?page=${i}&limit=${limit}">${i}</a>
        </li>`;
    }

    userListHTML += `
            </ul>
          </nav>
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

app.get('/users/download', async (req, res) => {
  try {
    const users = await User.find();

    const doc = new PDFDocument();
    const filePath = path.join(__dirname, 'public', 'downloads', 'users.pdf');

    // Ensure downloads directory exists
    const downloadDir = path.join(__dirname, 'public', 'downloads');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    doc.pipe(fs.createWriteStream(filePath));
    doc.fontSize(16).text('Registered Users', { align: 'center' });
    doc.moveDown();

    users.forEach(user => {
      doc.fontSize(12).text(`Full Name: ${user.fullName}`);
      doc.text(`Email: ${user.email}`);
      doc.text(`Phone Number: ${user.phoneNumber}`);
      doc.text(`Skill to Learn: ${user.skillToLearn}`);
      doc.text(`Church/Parish: ${user.churchOrParish || ''}`);
      doc.text(`Center: ${user.center}`);
      doc.moveDown();
    });

    doc.end();

    doc.on('finish', () => {
      res.download(filePath, 'users.pdf', err => {
        if (err) {
          console.error('Error downloading PDF:', err.message);
          res.status(500).send('Error downloading PDF: ' + err.message);
        } else {
          // Optional: Clean up the file after download
          fs.unlink(filePath, err => {
            if (err) {
              console.error('Error deleting PDF file:', err.message);
            }
          });
        }
      });
    });
  } catch (err) {
    console.error('Error generating PDF:', err.message);
    res.status(500).send('Error generating PDF: ' + err.message);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
