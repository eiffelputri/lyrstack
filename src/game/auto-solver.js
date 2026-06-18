// tetris math for AUTO mode
// tries every column on a copy of the board

const W_LINES = 0.76;
const W_HEIGHT = -0.51;
const W_HOLES = -0.36;
const W_BUMP = -0.18;
const TIE_EPSILON = 1e-6;

export function evaluate(board) {
  const heights = board.heights();
  let aggregate = 0;
  let bump = 0;
  for (let x = 0; x < heights.length; x++) {
    aggregate += heights[x];
    if (x > 0) bump += Math.abs(heights[x] - heights[x - 1]);
  }
  return W_HEIGHT * aggregate + W_HOLES * board.holes() + W_BUMP * bump;
}

export function pickAutoColumn(board, shape, seed = 0) {
  const maxLeft = board.cols - shape.w;
  let best = -Infinity;
  let candidates = [];
  let leastOverflow = { left: 0, top: -Infinity };

  for (let left = 0; left <= maxLeft; left++) {
    const top = board.dropRow(shape, left);
    if (top < 0) {
      // used when every column overflows
      if (top > leastOverflow.top) leastOverflow = { left, top };
      continue;
    }
    const sim = board.clone();
    sim.place(shape, left, top, () => true);
    const lines = sim.fullRows();
    sim.clearRows(lines);
    const score = W_LINES * lines.length + evaluate(sim);

    if (score > best + TIE_EPSILON) {
      best = score;
      candidates = [left];
    } else if (Math.abs(score - best) <= TIE_EPSILON) {
      candidates.push(left);
    }
  }

  if (!candidates.length) return leastOverflow.left;
  return candidates[Math.abs(Math.floor(seed)) % candidates.length];
}
