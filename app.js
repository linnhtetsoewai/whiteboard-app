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

// Firebase config
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

  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  let isDrawing = false;
  let isErasing = false;
  let prev = { x: 0, y: 0 };
  let strokes = {};
  const threshold = 30;

  // Custom eraser circle rendering
  let mouseX = 0, mouseY = 0;

  // Toggle eraser mode
  document.getElementById("eraserBtn").addEventListener("click", () => {
    isErasing = !isErasing;
    isDrawing = false;
    if (isErasing) {
      canvas.style.cursor = "none";
    } else {
      canvas.style.cursor = "crosshair";
      redrawStrokes();
    }
  });

  // Draw line
  function drawLine(x1, y1, x2, y2, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.closePath();
  }

  // Save stroke to Firebase
  function sendStroke(x1, y1, x2, y2, color) {
    const strokeData = { x1, y1, x2, y2, color };
    const newStrokeRef = push(strokesRef);
    set(newStrokeRef, strokeData);
  }

  // Eraser cursor overlay
  canvas.addEventListener("mousemove", (e) => {
    mouseX = e.offsetX;
    mouseY = e.offsetY;

    if (!isDrawing && isErasing) {
      redrawStrokes(); // clear + redraw strokes
      drawEraserCursor();
    }

    if (!isDrawing || isErasing) return;
    const current = { x: e.offsetX, y: e.offsetY };
    drawLine(prev.x, prev.y, current.x, current.y, "#000");
    sendStroke(prev.x, prev.y, current.x, current.y, "#000");
    prev = current;
  });

  function drawEraserCursor() {
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, threshold, 0, 2 * Math.PI);
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  canvas.addEventListener("mousedown", (e) => {
    if (isErasing) {
      tryEraseStroke(e.offsetX, e.offsetY);
      return;
    }
    isDrawing = true;
    prev = { x: e.offsetX, y: e.offsetY };
  });

  canvas.addEventListener("mouseup", () => {
    isDrawing = false;
  });

  canvas.addEventListener("mouseleave", () => {
    isDrawing = false;
  });

  function tryEraseStroke(x, y) {
    for (const [key, s] of Object.entries(strokes)) {
      const dist = pointToSegmentDistance(x, y, s.x1, s.y1, s.x2, s.y2);
      if (dist < threshold) {
        remove(ref(database, `strokes/${key}`));
        delete strokes[key];
        return;
      }
    }
  }

  function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;

    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function redrawStrokes() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of Object.values(strokes)) {
      drawLine(s.x1, s.y1, s.x2, s.y2, s.color);
    }
  }

  // Draw strokes from DB
  onChildAdded(strokesRef, (snapshot) => {
    const s = snapshot.val();
    strokes[snapshot.key] = s;
    drawLine(s.x1, s.y1, s.x2, s.y2, s.color);
  });

  // Clear canvas
  document.getElementById("clearBtn").addEventListener("click", () => {
    remove(strokesRef);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  onValue(strokesRef, (snapshot) => {
    if (!snapshot.exists()) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      strokes = {};
    }
  });
});
