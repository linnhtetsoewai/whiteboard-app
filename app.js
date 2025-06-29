import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  onChildAdded,
  remove,
  onValue
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCpl0fFxzLJECFMShAnnJ0ZHijPQbfhY9c",
  authDomain: "linn-ghd-whiteboard.firebaseapp.com",
  databaseURL: "https://linn-ghd-whiteboard-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "linn-ghd-whiteboard",
  storageBucket: "linn-ghd-whiteboard.firebasestorage.app",
  messagingSenderId: "72958491305",
  appId: "1:72958491305:web:6349741acf608f1817c7b8"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const strokesRef = ref(database, "strokes");

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");

  // Set canvas resolution to match visual size
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  let drawing = false;
  let prev = { x: 0, y: 0 };

  canvas.addEventListener("mousedown", (e) => {
    drawing = true;
    prev = { x: e.offsetX, y: e.offsetY };
  });

  canvas.addEventListener("mouseup", () => {
    drawing = false;
  });

  canvas.addEventListener("mouseleave", () => {
    drawing = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!drawing) return;
    const current = { x: e.offsetX, y: e.offsetY };
    drawLine(prev.x, prev.y, current.x, current.y, "#000");
    sendStroke(prev.x, prev.y, current.x, current.y, "#000");
    prev = current;
  });

  function drawLine(x1, y1, x2, y2, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.closePath();
  }

  function sendStroke(x1, y1, x2, y2, color) {
    const strokeData = { x1, y1, x2, y2, color };
    const newStrokeRef = push(strokesRef);
    set(newStrokeRef, strokeData);
  }

  // Listen to strokes from others
  onChildAdded(strokesRef, (snapshot) => {
    const s = snapshot.val();
    drawLine(s.x1, s.y1, s.x2, s.y2, s.color);
  });

  // Clear button
  document.getElementById("clearBtn").addEventListener("click", () => {
    remove(strokesRef);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  // Auto clear for others
  onValue(strokesRef, (snapshot) => {
    if (!snapshot.exists()) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  });
});