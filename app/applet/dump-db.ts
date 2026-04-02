
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function dump() {
  const articlesSnap = await getDocs(collection(db, 'articles'));
  const articles = articlesSnap.docs.map(d => {
    const data = d.data();
    // Convert Timestamps to ISO strings for JSON
    Object.keys(data).forEach(key => {
      if (data[key] && typeof data[key].toDate === 'function') {
        data[key] = data[key].toDate().toISOString();
      }
    });
    return { id: d.id, ...data };
  });
  
  const categoriesSnap = await getDocs(collection(db, 'categories'));
  const categories = categoriesSnap.docs.map(d => d.data().name);

  console.log(JSON.stringify({ articles, categories }));
}

dump().catch(err => {
  console.error(err);
  process.exit(1);
});
