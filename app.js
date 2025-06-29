// Initialize Firebase
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

  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  let isDrawing = false;
  let isErasing = false;
  let prev = {};
  let strokes = {};
  const threshold = 30;
  let erasedThisDrag = new Set();

  function getRelativeCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

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

  function drawEraserCursor(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, threshold, 0, 2 * Math.PI);
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  canvas.addEventListener("mousedown", (e) => {
    isDrawing = true;
    const { x, y } = getRelativeCoords(e);
    if (isErasing) {
      erasedThisDrag.clear();
      eraseStrokeAt(x, y);
    } else {
      prev = { x, y };
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    const { x, y } = getRelativeCoords(e);
    if (isErasing) {
      if (isDrawing) eraseStrokeAt(x, y);
      redrawAll();
      drawEraserCursor(x, y);
      return;
    }
    if (!isDrawing) return;
    const current = { x, y };
    drawLine(prev.x, prev.y, current.x, current.y, "#000");
    sendStroke(prev.x, prev.y, current.x, current.y, "#000");
    prev = current;
  });

  canvas.addEventListener("mouseup", () => isDrawing = false);
  canvas.addEventListener("mouseleave", () => isDrawing = false);

  function eraseStrokeAt(x, y) {
    const keysToDelete = Object.entries(strokes)
      .filter(([key, s]) => {
        const dist = pointToSegmentDistance(x, y, s.x1, s.y1, s.x2, s.y2);
        return dist < threshold && !erasedThisDrag.has(key);
      })
      .map(([key]) => key);

    if (keysToDelete.length === 0) return;

    Promise.all(
      keysToDelete.map(key => {
        erasedThisDrag.add(key);
        return remove(ref(db, `strokes/${key}`));
      })
    ).then(() => {
      for (const key of keysToDelete) {
        delete strokes[key];
      }
    });
  }

  function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    if (lenSq === 0) return Math.sqrt(A * A + B * B);

    let param = dot / lenSq;
    if (param < 0) param = 0;
    else if (param > 1) param = 1;

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
    if (!isErasing) redrawAll();
  });
});