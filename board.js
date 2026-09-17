(function () {
  "use strict";

  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],            [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];

  function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }
    return result;
  }

  class BoardGenerator {
    constructor(size = 5) {
      this.size = size;
    }

    generate(products) {
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const grid = Array.from({ length: this.size }, () => Array(this.size).fill(null));
        const paths = {};

        if (this.placeProducts(products, 0, grid, paths)) {
          this.fillEmptyCells(grid);
          return { grid, paths };
        }
      }

      throw new Error("無法建立合法棋盤，請檢查產品名稱長度或棋盤設定。");
    }

    placeProducts(products, productIndex, grid, paths) {
      if (productIndex >= products.length) {
        return true;
      }

      const product = products[productIndex];
      const candidates = this.findCandidatePaths(product.name, grid);

      for (const path of candidates) {
        const changedCells = [];

        path.forEach((cell, letterIndex) => {
          if (grid[cell.row][cell.column] === null) {
            grid[cell.row][cell.column] = product.name[letterIndex];
            changedCells.push(cell);
          }
        });

        paths[product.name] = path.map((cell) => ({ ...cell }));

        if (this.placeProducts(products, productIndex + 1, grid, paths)) {
          return true;
        }

        changedCells.forEach((cell) => {
          grid[cell.row][cell.column] = null;
        });
        delete paths[product.name];
      }

      return false;
    }

    findCandidatePaths(word, grid) {
      const starts = shuffle(
        Array.from({ length: this.size * this.size }, (_, index) => ({
          row: Math.floor(index / this.size),
          column: index % this.size
        }))
      );
      const candidates = [];

      for (const start of starts) {
        for (const [rowDirection, columnDirection] of shuffle(DIRECTIONS)) {
          const path = Array.from({ length: word.length }, (_, letterIndex) => ({
            row: start.row + letterIndex * rowDirection,
            column: start.column + letterIndex * columnDirection
          }));

          const isValidPath = path.every((cell, letterIndex) => (
            this.isInside(cell.row, cell.column) &&
            this.cellCanHold(grid, cell.row, cell.column, word[letterIndex])
          ));

          if (isValidPath) {
            candidates.push(path);
          }
        }
      }

      return shuffle(candidates);
    }

    cellCanHold(grid, row, column, letter) {
      return grid[row][column] === null || grid[row][column] === letter;
    }

    isInside(row, column) {
      return row >= 0 && row < this.size && column >= 0 && column < this.size;
    }

    fillEmptyCells(grid) {
      grid.forEach((row) => {
        row.forEach((letter, columnIndex) => {
          if (letter === null) {
            row[columnIndex] = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
          }
        });
      });
    }
  }

  window.BoardGenerator = BoardGenerator;
})();
