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

const firebaseConfig = {
  apiKey: "AIzaSyCpl0fFxzLJECFMShAnnJ0ZHijPQbfhY9c",
  authDomain: "linn-ghd-whiteboard.firebaseapp.com",
  databaseURL: "https://linn-ghd-whiteboard-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "linn-ghd-whiteboard",
  storageBucket: "linn-ghd-whiteboard.appspot.com",
  messagingSenderId: "72958491305",
  appId: "1:72958491305:web:6349741acf608f1817c7b8"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const strokesRef = ref(db, "strokes");

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");

  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  let isDrawing = false;
  let isErasing = false;
  let prev = {};
  let strokes = {};
  const threshold = 30;
  let mouseX = 0;
  let mouseY = 0;

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
    const newStroke = push(strokesRef);
    set(newStroke, { x1, y1, x2, y2, color });
  }

  function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of Object.values(strokes)) {
      drawLine(s.x1, s.y1, s.x2, s.y2, s.color);
    }
  }

  function drawEraserCursor() {
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, threshold, 0, 2 * Math.PI);
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  canvas.addEventListener("mousemove", (e) => {
    mouseX = e.offsetX;
    mouseY = e.offsetY;

    if (isErasing && !isDrawing) {
      redrawAll();
      drawEraserCursor();
    }

    if (!isDrawing || isErasing) return;

    const current = { x: mouseX, y: mouseY };
    drawLine(prev.x, prev.y, current.x, current.y, "#000");
    sendStroke(prev.x, prev.y, current.x, current.y, "#000");
    prev = current;
  });

  canvas.addEventListener("mousedown", (e) => {
    if (isErasing) {
      eraseStrokeAt(e.offsetX, e.offsetY);
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

  function eraseStrokeAt(x, y) {
    for (const [key, s] of Object.entries(strokes)) {
      const dist = pointToSegmentDistance(x, y, s.x1, s.y1, s.x2, s.y2);
      if (dist < threshold) {
        remove(ref(db, `strokes/${key}`));
        delete strokes[key];
        anyErased = true;
      }
    }

    if (anyErased) {
      redrawAll();
      }
    }

  function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = dot / lenSq;
    if (param < 0) param = 0;
    if (param > 1) param = 1;
    const xx = x1 + param * C;
    const yy = y1 + param * D;
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  onChildAdded(strokesRef, (snap) => {
    const s = snap.val();
    strokes[snap.key] = s;
    drawLine(s.x1, s.y1, s.x2, s.y2, s.color);
  });

  onValue(strokesRef, (snap) => {
    if (!snap.exists()) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      strokes = {};
    }
  });

  document.getElementById("clearBtn").addEventListener("click", () => {
    remove(strokesRef);
  });

  document.getElementById("eraserBtn").addEventListener("click", () => {
    isErasing = !isErasing;
    isDrawing = false;
    canvas.style.cursor = isErasing ? "none" : "crosshair";
    if (!isErasing) {
      redrawAll();
    }
  });
});
