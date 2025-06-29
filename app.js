const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth - 40;
canvas.height = window.innerHeight - 100;

let drawing = false;
let prev = { x: 0, y: 0 };

// Start drawing
canvas.addEventListener('mousedown', (e) => {
  drawing = true;
  prev = { x: e.offsetX, y: e.offsetY };
});

// Stop drawing
canvas.addEventListener('mouseup', () => {
  drawing = false;
});

// Drawing logic
canvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;
  const current = { x: e.offsetX, y: e.offsetY };
  drawLine(prev.x, prev.y, current.x, current.y, '#000');
  sendStroke(prev.x, prev.y, current.x, current.y, '#000');
  prev = current;
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

// Write to Firebase
function sendStroke(x1, y1, x2, y2, color) {
  firebase.database().ref('strokes').push({ x1, y1, x2, y2, color });
}

// Listen for others' strokes
firebase.database().ref('strokes').on('child_added', (snapshot) => {
  const s = snapshot.val();
  drawLine(s.x1, s.y1, s.x2, s.y2, s.color);
});

const clearBtn = document.getElementById('clearBtn');

// Local clear
clearBtn.addEventListener('click', () => {
  firebase.database().ref('strokes').remove(); // Clear Firebase strokes
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas locally
});