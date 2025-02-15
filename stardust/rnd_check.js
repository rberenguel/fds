import { seededRnd } from "./rnd.js";

const rnd = seededRnd(42);

function createCanvas() {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  resizeCanvas(canvas)(); // Initial resize
  return canvas;
}

const resizeCanvas = (canvas) => () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  plotRandomNumbers(canvas); // Redraw plot after resize
};

const canvas = createCanvas();

// Event listener for window resize
window.addEventListener("resize", () => resizeCanvas(canvas));

// Your custom random number generator (replace with your actual implementation)

function plotRandomNumbers(canvas) {
  const numPoints = 1500;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Use canvas.width/height

  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);

  for (let i = 0; i < numPoints; i++) {
    const n = rnd();
    const x = (i / (numPoints - 1)) * canvas.width;
    const y = (1 - n) * canvas.height;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.strokeStyle = "blue";
  ctx.stroke();
}
