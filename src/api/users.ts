import { Router } from 'express';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

router.get('/', async (req, res) => {
  const allUsers = await db.select().from(users);
  res.json(allUsers);
});

router.post('/', async (req, res) => {
  const { email, password } = req.body;
  await db.insert(users).values({ email, password: password || 'default_password' });
  res.status(201).json({ message: 'User created' });
});

export default router;
