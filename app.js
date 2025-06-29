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
const imagesRef = ref(db, "images");

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");

  let isDrawing = false;
  let isErasing = false;
  let prev = {};
  let strokes = {};
  let panOffset = { x: 0, y: 0 };
  let isPanning = false;
  let panStart = {};
  let threshold = 30;
  let erasedThisDrag = new Set();
  let spacePressed = false;
  let zoomLevel = 1.0;

  let selectedImageId = null;
  let isResizing = false;
  let resizeStart = null;
  const imageObjects = {}; // id -> { image, x, y, width, height, data }

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    redrawAll();
  }

  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    return {
      x: (e.clientX - rect.left) * ratio,
      y: (e.clientY - rect.top) * ratio
    };
  }

  function worldToScreen(x, y) {
    return {
      x: (x + panOffset.x) * zoomLevel,
      y: (y + panOffset.y) * zoomLevel
    };
  }

  function screenToWorld(x, y) {
    return {
      x: x / zoomLevel - panOffset.x,
      y: y / zoomLevel - panOffset.y
    };
  }

  function drawLine(x1, y1, x2, y2, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 / zoomLevel;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function sendStroke(x1, y1, x2, y2, color) {
    const newStroke = push(strokesRef);
    set(newStroke, { x1, y1, x2, y2, color });
  }

  function drawAllImages() {
    for (const [id, imgObj] of Object.entries(imageObjects)) {
      const img = imgObj.image;
      ctx.drawImage(img, imgObj.x, imgObj.y, imgObj.width, imgObj.height);
      if (id === selectedImageId) {
        ctx.strokeStyle = "#00f";
        ctx.lineWidth = 1 / zoomLevel;
        ctx.strokeRect(imgObj.x, imgObj.y, imgObj.width, imgObj.height);
        ctx.fillStyle = "#00f";
        ctx.fillRect(
          imgObj.x + imgObj.width - 10 / zoomLevel,
          imgObj.y + imgObj.height - 10 / zoomLevel,
          10 / zoomLevel,
          10 / zoomLevel
        );
      }
    }
  }

  function redrawAll() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(zoomLevel, 0, 0, zoomLevel, panOffset.x * zoomLevel, panOffset.y * zoomLevel);
    for (const s of Object.values(strokes)) {
      drawLine(s.x1, s.y1, s.x2, s.y2, s.color);
    }
    drawAllImages();
  }

  function drawEraserCursor(x, y) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.arc(x, y, threshold, 0, 2 * Math.PI);
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 1;
    ctx.stroke();
    redrawAll();
  }

  function eraseStrokeAt(screenX, screenY) {
    const { x, y } = screenToWorld(screenX, screenY);
    const keysToDelete = Object.entries(strokes)
      .filter(([key, s]) => {
        const dist = pointToSegmentDistance(x, y, s.x1, s.y1, s.x2, s.y2);
        return dist < threshold / zoomLevel && !erasedThisDrag.has(key);
      })
      .map(([key]) => key);

    if (keysToDelete.length === 0) return;

    Promise.all(
      keysToDelete.map(key => {
        erasedThisDrag.add(key);
        return remove(ref(db, `strokes/${key}`));
      })
    ).then(() => {
      for (const key of keysToDelete) delete strokes[key];
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

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  canvas.addEventListener("mousedown", (e) => {
    const { x, y } = screenToWorld(...Object.values(getMousePos(e)));
    selectedImageId = null;

    for (const [id, imgObj] of Object.entries(imageObjects)) {
      const { x: ix, y: iy, width, height } = imgObj;
      if (x >= ix && x <= ix + width && y >= iy && y <= iy + height) {
        selectedImageId = id;
        const corner = 10 / zoomLevel;
        if (x >= ix + width - corner && y >= iy + height - corner) {
          isResizing = true;
          resizeStart = { x, y, width, height };
        }
        break;
      }
    }

    if (!selectedImageId && !isResizing) {
      if (spacePressed) {
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
        return;
      }
      isDrawing = true;
      if (isErasing) {
        erasedThisDrag.clear();
        eraseStrokeAt(...Object.values(getMousePos(e)));
      } else {
        prev = screenToWorld(...Object.values(getMousePos(e)));
      }
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    const { x, y } = getMousePos(e);

    if (isPanning) {
      panOffset.x += (e.clientX - panStart.x) / zoomLevel;
      panOffset.y += (e.clientY - panStart.y) / zoomLevel;
      panStart = { x: e.clientX, y: e.clientY };
      redrawAll();
      return;
    }

    if (isResizing && selectedImageId) {
      const world = screenToWorld(x, y);
      const dx = world.x - resizeStart.x;
      const dy = world.y - resizeStart.y;

      const imgObj = imageObjects[selectedImageId];
      imgObj.width = Math.max(10, resizeStart.width + dx);
      imgObj.height = Math.max(10, resizeStart.height + dy);

      const imageRef = ref(db, "images/" + selectedImageId);
      set(imageRef, {
        ...imgObj,
        data: imgObj.data,
        timestamp: Date.now()
      });

      redrawAll();
      return;
    }

    if (isErasing && isDrawing) {
      eraseStrokeAt(x, y);
      redrawAll();
      drawEraserCursor(x, y);
    }

    if (!isDrawing || isErasing) return;

    const current = screenToWorld(x, y);
    drawLine(prev.x, prev.y, current.x, current.y, "#000");
    sendStroke(prev.x, prev.y, current.x, current.y, "#000");
    prev = current;
  });

  canvas.addEventListener("mouseup", () => {
    isDrawing = false;
    isPanning = false;
    isResizing = false;
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX / zoomLevel - panOffset.x);
    const worldY = (mouseY / zoomLevel - panOffset.y);
    const zoomIntensity = 0.1;
    const factor = 1 + (e.deltaY < 0 ? zoomIntensity : -zoomIntensity);
    zoomLevel = Math.max(0.2, Math.min(zoomLevel * factor, 5));
    panOffset.x = (mouseX / zoomLevel) - worldX;
    panOffset.y = (mouseY / zoomLevel) - worldY;
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
    if (!isErasing) redrawAll();
  });

  document.getElementById("zoomToFitBtn").addEventListener("click", () => {
    if (Object.keys(strokes).length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of Object.values(strokes)) {
      minX = Math.min(minX, s.x1, s.x2);
      minY = Math.min(minY, s.y1, s.y2);
      maxX = Math.max(maxX, s.x1, s.x2);
      maxY = Math.max(maxY, s.y1, s.y2);
    }
    const margin = 40;
    const canvasW = canvas.width / (window.devicePixelRatio || 1);
    const canvasH = canvas.height / (window.devicePixelRatio || 1);
    const contentW = maxX - minX + margin;
    const contentH = maxY - minY + margin;
    const scaleX = canvasW / contentW;
    const scaleY = canvasH / contentH;
    zoomLevel = Math.min(scaleX, scaleY);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    panOffset.x = canvasW / (2 * zoomLevel) - centerX;
    panOffset.y = canvasH / (2 * zoomLevel) - centerY;
    redrawAll();
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

  onChildAdded(imagesRef, (snap) => {
    const key = snap.key;
    const image = snap.val();
    const img = new Image();
    img.src = image.data;
    img.onload = () => {
      imageObjects[key] = {
        image: img,
        data: image.data,
        x: image.x,
        y: image.y,
        width: image.width || img.width / zoomLevel,
        height: image.height || img.height / zoomLevel
      };
      redrawAll();
    };
  });

  document.addEventListener("paste", async (e) => {
    const items = (e.clipboardData || window.clipboardData).items;
    for (const item of items) {
      if (item.type.indexOf("image") === 0) {
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageData = event.target.result;
          const imageRef = push(imagesRef);
          set(imageRef, {
            data: imageData,
            x: panOffset.x,
            y: panOffset.y,
            width: 300,
            height: 300,
            timestamp: Date.now()
          });
        };
        reader.readAsDataURL(blob);
      }
    }
  });
});