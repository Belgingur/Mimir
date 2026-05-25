export const reshape = (
  data: Float32Array,
  width: number,
  height: number,
): number[][] => {
  const rows: number[][] = new Array(height);
  for (let y = 0; y < height; y += 1) {
    const row: number[] = new Array(width);
    const rowOffset = y * width;
    for (let x = 0; x < width; x += 1) {
      const value = data[rowOffset + x];
      row[x] = Number.isFinite(value) ? value : 0;
    }
    rows[y] = row;
  }
  return rows;
};
