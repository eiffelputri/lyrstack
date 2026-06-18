// tetris board

export class Board {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.cells = Array.from({ length: rows }, () => new Array(cols).fill(null));
  }

  get(x, y) {
    if (y < 0 || y >= this.rows || x < 0 || x >= this.cols) return null;
    return this.cells[y][x];
  }

  // does the piece fit
  fits(shape, left, top) {
    for (const [dx, dy] of shape.cells) {
      const x = left + dx;
      const y = top + dy;
      if (x < 0 || x >= this.cols || y >= this.rows) return false;
      if (y >= 0 && this.cells[y][x]) return false;
    }
    return true;
  }

  // landing row
  dropRow(shape, left, fromTop = -shape.h) {
    let top = fromTop;
    while (this.fits(shape, left, top + 1)) top++;
    return top;
  }

  // place a piece
  place(shape, left, top, makeBlock) {
    let overflow = false;
    shape.cells.forEach(([dx, dy], i) => {
      const x = left + dx;
      const y = top + dy;
      if (y < 0) {
        overflow = true;
        return;
      }
      if (y < this.rows && x >= 0 && x < this.cols) this.cells[y][x] = makeBlock(i, x, y);
    });
    return overflow;
  }

  fullRows() {
    const out = [];
    for (let y = 0; y < this.rows; y++) {
      if (this.cells[y].every(Boolean)) out.push(y);
    }
    return out;
  }

  // clear full rows
  clearRows(rows) {
    if (!rows.length) return [];
    const doomed = new Set(rows);
    const removed = [];
    for (const y of rows) {
      this.cells[y].forEach((block, x) => removed.push({ block, x, y }));
    }
    const kept = this.cells.filter((_, y) => !doomed.has(y));
    const fresh = Array.from({ length: rows.length }, () => new Array(this.cols).fill(null));
    this.cells = [...fresh, ...kept];
    return removed;
  }

  // column heights
  heights() {
    const out = new Array(this.cols).fill(0);
    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        if (this.cells[y][x]) {
          out[x] = this.rows - y;
          break;
        }
      }
    }
    return out;
  }

  // count holes
  holes() {
    let count = 0;
    for (let x = 0; x < this.cols; x++) {
      let roof = false;
      for (let y = 0; y < this.rows; y++) {
        if (this.cells[y][x]) roof = true;
        else if (roof) count++;
      }
    }
    return count;
  }

  isEmpty() {
    return this.cells.every((row) => row.every((c) => !c));
  }

  clone() {
    const b = new Board(this.cols, this.rows);
    b.cells = this.cells.map((row) => row.slice());
    return b;
  }

  clear() {
    for (const row of this.cells) row.fill(null);
  }
}
