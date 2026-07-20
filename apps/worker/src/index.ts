import dotenv from 'dotenv';
import { createDb } from '@vitrinos/db';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vitrinos';

console.log('Worker is starting...');

// DB test amaçlı oluşturuluyor
const db = createDb(DATABASE_URL);

async function workLoop() {
  try {
    // Burada gelecekte outbox_jobs veya cleanup_queue tabloları FOR UPDATE SKIP LOCKED ile taranacaktır.
    console.log('Checking for outbox jobs...');
  } catch (error) {
    console.error('Error in work loop:', error);
  } finally {
    // Her 5 saniyede bir çalışır
    setTimeout(workLoop, 5000);
  }
}

workLoop();
