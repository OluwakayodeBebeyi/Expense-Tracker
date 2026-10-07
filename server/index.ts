import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prisma } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

const uploadDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    cb(null, allowed.includes(file.mimetype));
  },
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'School finance system is running' });
});

app.get('/api/dashboard', async (_req, res) => {
  const income = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { type: 'INCOME', status: { not: 'VOIDED' } },
  });

  const expenditure = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { type: 'EXPENDITURE', status: { not: 'VOIDED' } },
  });

  const totalIncome = Number(income._sum.amount ?? 0);
  const totalExpenditure = Number(expenditure._sum.amount ?? 0);

  res.json({
    summary: {
      totalIncome,
      totalExpenditure,
      currentBalance: totalIncome - totalExpenditure,
      transactionCount: await prisma.transaction.count(),
    },
  });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = await prisma.user.findUnique({
    where: { email: String(email) },
    include: { role: true },
  });

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const ok = await import('bcryptjs').then(({ compareSync }) => compareSync(String(password), user.passwordHash));
  if (!ok) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  return res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
    },
  });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  res.json({
    fileName: req.file.filename,
    originalName: req.file.originalname,
    path: `/uploads/${req.file.filename}`,
  });
});

app.listen(port, () => {
  console.log(`School finance API listening on http://localhost:${port}`);
});
