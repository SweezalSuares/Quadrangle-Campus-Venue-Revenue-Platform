const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
const imageExtensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, callback) => {
      callback(null, `${crypto.randomUUID()}${imageExtensions[file.mimetype]}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!imageExtensions[file.mimetype]) {
      callback(new Error('Upload a JPEG, PNG, WebP, or GIF image.'));
      return;
    }
    callback(null, true);
  },
}).single('image');

function uploadVenueImage(req, res, next) {
  upload(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ message: 'Image must be 10 MB or smaller.' });
      return;
    }
    res.status(400).json({ message: err.message || 'Image upload failed.' });
  });
}

module.exports = { uploadDir, uploadVenueImage };
