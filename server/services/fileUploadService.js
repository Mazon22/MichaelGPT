const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const multer = require('multer');

const MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 5;
const MAX_FILE_TEXT_CHARS = 8000;
const TEMP_UPLOAD_DIR = path.join(__dirname, '..', '.tmp_uploads');

const SUPPORTED_FILE_TYPES = {
  pdf: {
    label: 'PDF',
    extensions: new Set(['.pdf']),
    mimeTypes: new Set(['application/pdf']),
  },
  txt: {
    label: 'TXT',
    extensions: new Set(['.txt']),
    mimeTypes: new Set(['text/plain']),
  },
  docx: {
    label: 'DOCX',
    extensions: new Set(['.docx']),
    mimeTypes: new Set([
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream',
    ]),
  },
  csv: {
    label: 'CSV',
    extensions: new Set(['.csv']),
    mimeTypes: new Set(['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain']),
  },
  json: {
    label: 'JSON',
    extensions: new Set(['.json']),
    mimeTypes: new Set(['application/json', 'text/json', 'text/plain']),
  },
  image: {
    label: 'Image',
    extensions: new Set(['.png', '.jpg', '.jpeg']),
    mimeTypes: new Set(['image/png', 'image/jpeg']),
  },
};

function ensureTempUploadDir() {
  fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
}

function sanitizeFileName(value) {
  return String(value || 'file')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function detectSupportedFileType(fileName, mimeType = '') {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  const normalizedMime = String(mimeType || '').toLowerCase();

  for (const [kind, config] of Object.entries(SUPPORTED_FILE_TYPES)) {
    if (config.extensions.has(ext)) {
      if (!normalizedMime || config.mimeTypes.has(normalizedMime) || normalizedMime === 'application/octet-stream') {
        return { kind, extension: ext, label: config.label };
      }
    }
  }

  return null;
}

function sanitizeExtractedText(value) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncateExtractedText(value) {
  const normalized = sanitizeExtractedText(value);
  if (normalized.length <= MAX_FILE_TEXT_CHARS) {
    return {
      content: normalized,
      truncated: false,
      originalLength: normalized.length,
    };
  }

  return {
    content: `${normalized.slice(0, MAX_FILE_TEXT_CHARS).trimEnd()}\n...[truncated]`,
    truncated: true,
    originalLength: normalized.length,
  };
}

async function extractPdfText(filePath) {
  const pdfParse = require('pdf-parse');
  const buffer = await fsp.readFile(filePath);
  const result = await pdfParse(buffer);
  return result?.text || '';
}

async function extractDocxText(filePath) {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return result?.value || '';
}

async function extractTxtText(filePath) {
  return fsp.readFile(filePath, 'utf8');
}

async function extractJsonText(filePath) {
  const raw = await fsp.readFile(filePath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch (_error) {
    return raw;
  }
}

async function extractCsvText(filePath) {
  const csvParser = require('csv-parser');
  return new Promise((resolve, reject) => {
    const rows = [];

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        rows.push(JSON.stringify(row));
      })
      .on('end', () => {
        resolve(rows.join('\n'));
      })
      .on('error', reject);
  });
}

async function extractImageText(filePath) {
  try {
    const Tesseract = require('tesseract.js');
    const result = await Tesseract.recognize(filePath, 'eng+rus');
    return result?.data?.text || '';
  } catch (_error) {
    return '';
  }
}

async function extractTextFromFile(file, detectedType) {
  if (detectedType.kind === 'pdf') return extractPdfText(file.path);
  if (detectedType.kind === 'docx') return extractDocxText(file.path);
  if (detectedType.kind === 'txt') return extractTxtText(file.path);
  if (detectedType.kind === 'json') return extractJsonText(file.path);
  if (detectedType.kind === 'csv') return extractCsvText(file.path);
  if (detectedType.kind === 'image') return extractImageText(file.path);
  return '';
}

async function parseUploadedFile(file) {
  const detectedType = detectSupportedFileType(file.originalname, file.mimetype);
  if (!detectedType) {
    throw new Error('Unsupported file type');
  }

  const buffer = await fsp.readFile(file.path);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const extractedText = await extractTextFromFile(file, detectedType);
  const truncatedText = truncateExtractedText(extractedText);

  return {
    id: sha256.slice(0, 16),
    sha256,
    filename: sanitizeFileName(file.originalname),
    mimeType: file.mimetype || 'application/octet-stream',
    size: file.size,
    kind: detectedType.kind,
    content: truncatedText.content,
    truncated: truncatedText.truncated,
    originalLength: truncatedText.originalLength,
  };
}

ensureTempUploadDir();

const upload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, callback) {
      callback(null, TEMP_UPLOAD_DIR);
    },
    filename(_req, file, callback) {
      const safeName = sanitizeFileName(file.originalname || 'upload');
      callback(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeName}`);
    },
  }),
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE,
    files: MAX_FILES_PER_UPLOAD,
  },
  fileFilter(_req, file, callback) {
    const detectedType = detectSupportedFileType(file.originalname, file.mimetype);
    if (!detectedType) {
      callback(new Error('Unsupported file type'));
      return;
    }

    callback(null, true);
  },
});

async function processUploadedFiles(files = []) {
  const results = [];
  const seenHashes = new Set();

  for (const file of files) {
    try {
      const parsedFile = await parseUploadedFile(file);
      if (seenHashes.has(parsedFile.sha256)) {
        continue;
      }

      seenHashes.add(parsedFile.sha256);
      results.push(parsedFile);
    } finally {
      await fsp.unlink(file.path).catch(() => {});
    }
  }

  return results;
}

module.exports = {
  MAX_FILE_TEXT_CHARS,
  MAX_FILES_PER_UPLOAD,
  MAX_UPLOAD_FILE_SIZE,
  SUPPORTED_FILE_TYPES,
  TEMP_UPLOAD_DIR,
  detectSupportedFileType,
  processUploadedFiles,
  sanitizeFileName,
  upload,
};
