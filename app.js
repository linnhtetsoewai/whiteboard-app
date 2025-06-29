
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

  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  let isDrawing = false;
  let isErasing = false;
  let prev = {};
  let strokes = {};
  let scale = 1;
  let origin = { x: 0, y: 0 };
  let pan = { x: 0, y: 0 };
  const threshold = 30;
  let erasedThisDrag = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let spacePressed = false;
  let isPanning = false;
  let panStart = {};

  function toWorld(x, y) {
    return {
      x: (x - pan.x) / scale,
      y: (y - pan.y) / scale
    };
  }

  function drawLine(x1, y1, x2, y2, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 / scale;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function sendStroke(x1, y1, x2, y2, color) {
    const newStroke = push(strokesRef);
    set(newStroke, { x1, y1, x2, y2, color });
  }

  function redrawAll() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, pan.x, pan.y);
    for (const s of Object.values(strokes)) {
      drawLine(s.x1, s.y1, s.x2, s.y2, s.color);
    }
  }

  function drawEraserCursor() {
    const world = toWorld(mouseX, mouseY);
    ctx.beginPath();
    ctx.arc(world.x, world.y, threshold, 0, 2 * Math.PI);
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 1 / scale;
    ctx.stroke();
  }

  function eraseStrokeAt(x, y) {
    const world = toWorld(x, y);
    const keysToDelete = Object.entries(strokes)
      .filter(([key, s]) => {
        const dist = pointToSegmentDistance(world.x, world.y, s.x1, s.y1, s.x2, s.y2);
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
      redrawAll();
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
    param = Math.max(0, Math.min(1, param));
    const xx = x1 + param * C;
    const yy = y1 + param * D;
    return Math.hypot(px - xx, py - yy);
  }

  canvas.addEventListener("mousedown", (e) => {
    if (spacePressed) {
      isPanning = true;
      panStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    isDrawing = true;
    if (isErasing) {
      erasedThisDrag.clear();
      eraseStrokeAt(e.offsetX, e.offsetY);
    } else {
      const world = toWorld(e.offsetX, e.offsetY);
      prev = { x: world.x, y: world.y };
    }
  });

  canvas.addEventListener("mouseup", () => {
    isDrawing = false;
    isPanning = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    mouseX = e.offsetX;
    mouseY = e.offsetY;

    if (isPanning) {
      pan.x = e.clientX - panStart.x;
      pan.y = e.clientY - panStart.y;
      redrawAll();
      return;
    }

    if (isErasing) {
      if (isDrawing) eraseStrokeAt(mouseX, mouseY);
      redrawAll();
      drawEraserCursor();
      return;
    }

    if (!isDrawing) return;

    const current = toWorld(mouseX, mouseY);
    drawLine(prev.x, prev.y, current.x, current.y, "#000");
    sendStroke(prev.x, prev.y, current.x, current.y, "#000");
    prev = current;
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoom = e.deltaY < 0 ? 1.1 : 0.9;
    const world = toWorld(e.offsetX, e.offsetY);
    scale *= zoom;
    pan.x = e.offsetX - world.x * scale;
    pan.y = e.offsetY - world.y * scale;
    redrawAll();
  });

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      spacePressed = true;
      canvas.style.cursor = "grab";
    }
  });

  document.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      spacePressed = false;
      canvas.style.cursor = isErasing ? "none" : "crosshair";
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

  onChildAdded(strokesRef, (snap) => {
    const s = snap.val();
    strokes[snap.key] = s;
    redrawAll();
  });

  onValue(strokesRef, (snap) => {
    if (!snap.exists()) {
      strokes = {};
      redrawAll();
    }
  });
});
