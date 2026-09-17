(function () {
  "use strict";

  const GAME_STATES = Object.freeze({
    HOME: "HOME",
    PLAYING: "PLAYING",
    COMPLETED: "COMPLETED"
  });

  function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }
    return result;
  }

  class WorldSearchGame {
    constructor(products, boardGenerator) {
      this.products = products;
      this.boardGenerator = boardGenerator;
      this.listeners = new Set();
      this.resetToHome();
    }

    subscribe(listener) {
      this.listeners.add(listener);
      listener(this, { type: "ready" });
      return () => this.listeners.delete(listener);
    }

    notify(event) {
      this.listeners.forEach((listener) => listener(this, event));
    }

    startGame() {
      this.mode = "easy";
      this.roundProducts = shuffle(this.products).slice(0, 4);
      const generatedBoard = this.boardGenerator.generate(this.roundProducts);

      this.board = generatedBoard.grid;
      this.productPaths = generatedBoard.paths;
      this.foundProducts = new Set();
      this.foundCells = new Set();
      this.selection = [];
      this.selectionText = "";
      this.inputLocked = false;
      this.state = GAME_STATES.PLAYING;
      this.notify({ type: "game-started" });
    }

    playAgain() {
      this.startGame();
    }

    goHome() {
      this.resetToHome();
      this.notify({ type: "home" });
    }

    resetToHome() {
      this.state = GAME_STATES.HOME;
      this.mode = "easy";
      this.roundProducts = [];
      this.board = [];
      this.productPaths = {};
      this.foundProducts = new Set();
      this.foundCells = new Set();
      this.selection = [];
      this.selectionText = "";
      this.inputLocked = false;
    }

    selectCell(row, column) {
      if (this.state !== GAME_STATES.PLAYING || this.inputLocked) {
        return;
      }

      const clickedCell = { row, column };
      const clickedKey = this.cellKey(clickedCell);
      const selectedKeys = new Set(this.selection.map((cell) => this.cellKey(cell)));

      if (selectedKeys.has(clickedKey)) {
        this.failSelection(clickedCell, "同一個單字不能重複使用同一格。");
        return;
      }

      const previousCell = this.selection[this.selection.length - 1];
      if (previousCell && !this.areAdjacent(previousCell, clickedCell)) {
        this.failSelection(clickedCell, "請點擊上一格八方向相鄰的字母。");
        return;
      }

      const nextSelection = [...this.selection, clickedCell];
      const nextText = nextSelection.map((cell) => this.board[cell.row][cell.column]).join("");
      const remainingProducts = this.getRemainingProducts();
      const matchingPrefixes = remainingProducts.filter((product) => product.name.startsWith(nextText));

      if (matchingPrefixes.length === 0) {
        this.failSelection(clickedCell, `${nextText} 不是待尋找產品的開頭。`);
        return;
      }

      this.selection = nextSelection;
      this.selectionText = nextText;

      const completedProduct = matchingPrefixes.find((product) => product.name === nextText);
      if (completedProduct) {
        this.completeProduct(completedProduct);
        return;
      }

      this.notify({ type: "selection-changed" });
    }

    failSelection(clickedCell, message) {
      const invalidPath = [...this.selection, clickedCell];
      this.selection = [];
      this.selectionText = "";
      this.inputLocked = true;
      this.notify({ type: "selection-error", invalidPath, message });

      window.setTimeout(() => {
        this.inputLocked = false;
        if (this.state === GAME_STATES.PLAYING) {
          this.notify({ type: "selection-reset" });
        }
      }, 380);
    }

    completeProduct(product) {
      const completedPath = this.selection.map((cell) => ({ ...cell }));
      this.foundProducts.add(product.name);
      completedPath.forEach((cell) => this.foundCells.add(this.cellKey(cell)));
      this.selection = [];
      this.selectionText = "";

      const isComplete = this.foundProducts.size === this.roundProducts.length;
      if (isComplete) {
        this.state = GAME_STATES.COMPLETED;
      }

      this.notify({ type: "product-found", product, completedPath, isComplete });
    }

    areAdjacent(first, second) {
      const rowDistance = Math.abs(first.row - second.row);
      const columnDistance = Math.abs(first.column - second.column);
      return Math.max(rowDistance, columnDistance) === 1;
    }

    getRemainingProducts() {
      return this.roundProducts.filter((product) => !this.foundProducts.has(product.name));
    }

    cellKey(cell) {
      return `${cell.row},${cell.column}`;
    }
  }

  window.GAME_STATES = GAME_STATES;
  window.WorldSearchGame = WorldSearchGame;
})();
