import { Router } from 'express';
import { db } from '../db/index';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

router.get('/', async (req, res) => {
  const allUsers = await db.select().from(users);
  res.json(allUsers);
});

router.post('/', async (req, res) => {
  const { name, email } = req.body;
  await db.insert(users).values({ name, email });
  res.status(201).json({ message: 'User created' });
});

export default router;
