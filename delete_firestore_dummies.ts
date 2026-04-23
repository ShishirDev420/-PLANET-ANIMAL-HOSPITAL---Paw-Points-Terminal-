import { initializeApp } from 'firebase/app';
import { getFirestore, doc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAXomgRp-qyZGvIgNxJ--IemDnEvciNz1s",
  authDomain: "gen-lang-client-0402186605.firebaseapp.com",
  projectId: "gen-lang-client-0402186605",
  storageBucket: "gen-lang-client-0402186605.firebasestorage.app",
  messagingSenderId: "165874223382",
  appId: "1:165874223382:web:890feca1cf9b59d1d2e837"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-aa984190-a2cb-4039-9f1a-ec67f3d1594b");

const uidsToDelete = [
  '9TrziezRHHRN2o9B8zbvQrGCmGf2', // planetanimalhospital@gmail.com
  '9wXXPdN6X4eoM2WDo7W5h4Yksft2', // planetanimalhospital2@gmail.com
  'ApDclxz7G5ZrPWQvMjaBYDrld5R2', // tester.paws@example.com
  'BhHdMcugxVUsERQuq4TNK11fb4m2', // dermatvet@gmail.com
  'R667iRi8rSW66blTt9YZYkVMlvE3', // theodora.pawparent@testpet.com
  'T958FgGLOfZA3c5NRWLv0EZ1trJ2', // sarojineekamble@yahoo.in
  'V5CXtMd9mmRXvT7x2NSItk73MK22', // p_2@example.com
  'ZLweZXdQVQWHTU3feYTmbC7VH482', // email@123.com
  'a26m0rheCCaYeMmoVa00UVOw1EE3', // testemail@gmail.com
  'aFfA0TWGVOWhdHV1dLR2xqjjTbM2', // username@gmail.com
  'fwcrr4Xdp4h1dy0FYoSw6NwrYVN2', // shishirkamble@outlook.com
  'icWKX2fj3tTokZSbANfCAdLNChS2', // dermatvet1@gmail.com
  'p5wlWJEMSWb73w6wUev5XH7f9hJ2'  // kambleshishir07@gmail.com
];

async function cleanup() {
  console.log('Starting Firestore cleanup...');
  for (const uid of uidsToDelete) {
    try {
      await deleteDoc(doc(db, 'users', uid));
      console.log(`Deleted Firestore doc: ${uid}`);
    } catch (e) {
      console.error(`Failed to delete Firestore doc ${uid}:`, e.message);
    }
  }
  console.log('Firestore cleanup complete.');
}

cleanup();
