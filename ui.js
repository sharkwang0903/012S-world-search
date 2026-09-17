(function () {
  "use strict";

  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "red"];

  class GameUI {
    constructor(game) {
      this.game = game;
      this.errorCells = new Set();
      this.pendingTimers = [];

      this.elements = {
        homeScreen: document.querySelector("#home-screen"),
        gameScreen: document.querySelector("#game-screen"),
        startButton: document.querySelector("#start-button"),
        playingHomeButton: document.querySelector("#playing-home-button"),
        completedHomeButton: document.querySelector("#completed-home-button"),
        replayButton: document.querySelector("#replay-button"),
        board: document.querySelector("#board"),
        currentSelection: document.querySelector("#current-selection"),
        productList: document.querySelector("#product-list"),
        remainingCount: document.querySelector("#remaining-count"),
        feedback: document.querySelector("#game-feedback"),
        completionPanel: document.querySelector("#completion-panel")
      };

      this.bindEvents();
      this.game.subscribe((state, event) => this.render(state, event));
    }

    bindEvents() {
      this.elements.startButton.addEventListener("click", () => this.game.startGame());
      this.elements.replayButton.addEventListener("click", () => this.game.playAgain());
      this.elements.playingHomeButton.addEventListener("click", () => this.game.goHome());
      this.elements.completedHomeButton.addEventListener("click", () => this.game.goHome());

      this.elements.board.addEventListener("click", (event) => {
        const cell = event.target.closest(".cell");
        if (!cell) {
          return;
        }
        this.game.selectCell(Number(cell.dataset.row), Number(cell.dataset.column));
      });
    }

    render(state, event) {
      if (state.state === window.GAME_STATES.HOME) {
        this.renderHome(event);
        return;
      }

      this.elements.homeScreen.hidden = true;
      this.elements.gameScreen.hidden = false;
      this.renderSelection(state);

      if (event.type === "game-started") {
        this.clearTimers();
        this.errorCells.clear();
        this.elements.completionPanel.hidden = true;
        this.renderBoard(state);
        this.renderProductList(state.roundProducts);
        this.updateRemainingCount(state);
        this.elements.feedback.textContent = "新一局開始。";
        window.requestAnimationFrame(() => this.elements.board.querySelector(".cell")?.focus());
        return;
      }

      if (event.type === "selection-error") {
        this.errorCells = new Set(event.invalidPath.map((cell) => state.cellKey(cell)));
        this.elements.feedback.textContent = event.message;
        this.renderBoard(state, true);
        return;
      }

      if (event.type === "selection-reset") {
        this.errorCells.clear();
        this.renderBoard(state);
        return;
      }

      if (event.type === "product-found") {
        this.errorCells.clear();
        this.renderBoard(state, false, event.product.name);
        this.elements.feedback.textContent = `找到 ${event.product.name}！`;
        this.animateFoundProduct(event.product.name, event.isComplete);
        return;
      }

      this.renderBoard(state);
      this.updateRemainingCount(state);

      if (state.state === window.GAME_STATES.COMPLETED) {
        this.showCompletion();
      }
    }

    renderHome(event) {
      this.clearTimers();
      this.elements.homeScreen.hidden = false;
      this.elements.gameScreen.hidden = true;
      this.elements.completionPanel.hidden = true;
      this.elements.board.replaceChildren();
      this.elements.productList.replaceChildren();
      this.elements.feedback.textContent = "";

      if (event.type === "home") {
        window.requestAnimationFrame(() => this.elements.startButton.focus());
      }
    }

    renderBoard(state, hasError = false, newestProductName = "") {
      const selectedKeys = new Set(state.selection.map((cell) => state.cellKey(cell)));
      const fragment = document.createDocumentFragment();

      state.board.forEach((row, rowIndex) => {
        row.forEach((letter, columnIndex) => {
          const key = `${rowIndex},${columnIndex}`;
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "cell";
          cell.dataset.row = rowIndex;
          cell.dataset.column = columnIndex;
          cell.setAttribute("role", "gridcell");
          cell.setAttribute("aria-label", `第 ${rowIndex + 1} 列，第 ${columnIndex + 1} 欄，字母 ${letter}`);
          const letterLabel = document.createElement("span");
          letterLabel.className = "cell-letter";
          letterLabel.textContent = letter;
          cell.appendChild(letterLabel);

          if (selectedKeys.has(key)) {
            cell.classList.add("is-selected");
          }
          if (this.errorCells.has(key)) {
            cell.classList.add("is-error");
          }

          fragment.appendChild(cell);
        });
      });

      const focusedCell = document.activeElement?.classList.contains("cell")
        ? { row: document.activeElement.dataset.row, column: document.activeElement.dataset.column }
        : null;

      this.elements.board.replaceChildren(fragment);
      this.elements.board.classList.toggle("has-error", hasError);
      this.renderCompletedHighlights(state, newestProductName);

      if (focusedCell) {
        this.elements.board.querySelector(
          `[data-row="${focusedCell.row}"][data-column="${focusedCell.column}"]`
        )?.focus({ preventScroll: true });
      }
    }

    renderCompletedHighlights(state, newestProductName) {
      if (state.completedPaths.length === 0) {
        return;
      }

      const boardBounds = this.elements.board.getBoundingClientRect();
      const highlightLayer = document.createElementNS(SVG_NAMESPACE, "svg");
      highlightLayer.classList.add("highlight-layer");
      highlightLayer.setAttribute("viewBox", `0 0 ${boardBounds.width} ${boardBounds.height}`);
      highlightLayer.setAttribute("aria-hidden", "true");

      state.completedPaths.forEach((completed, foundIndex) => {
        const start = completed.path[0];
        const end = completed.path[completed.path.length - 1];
        const startElement = this.elements.board.querySelector(
          `[data-row="${start.row}"][data-column="${start.column}"]`
        );
        const endElement = this.elements.board.querySelector(
          `[data-row="${end.row}"][data-column="${end.column}"]`
        );

        if (!startElement || !endElement) {
          return;
        }

        const startBounds = startElement.getBoundingClientRect();
        const endBounds = endElement.getBoundingClientRect();
        const line = document.createElementNS(SVG_NAMESPACE, "line");
        const color = HIGHLIGHT_COLORS[foundIndex % HIGHLIGHT_COLORS.length];
        const bandWidth = Math.min(startBounds.width, startBounds.height) * 0.5;

        line.classList.add("word-highlight", `word-highlight-${color}`);
        if (completed.productName === newestProductName) {
          line.classList.add("is-new");
        }
        line.setAttribute("x1", startBounds.left + startBounds.width / 2 - boardBounds.left);
        line.setAttribute("y1", startBounds.top + startBounds.height / 2 - boardBounds.top);
        line.setAttribute("x2", endBounds.left + endBounds.width / 2 - boardBounds.left);
        line.setAttribute("y2", endBounds.top + endBounds.height / 2 - boardBounds.top);
        line.setAttribute("stroke-width", bandWidth);
        highlightLayer.appendChild(line);
      });

      this.elements.board.appendChild(highlightLayer);
    }

    renderSelection(state) {
      this.elements.currentSelection.textContent = state.selectionText
        ? state.selectionText.split("").join(" → ")
        : "—";
    }

    renderProductList(products) {
      const fragment = document.createDocumentFragment();

      products.forEach((product) => {
        const item = document.createElement("li");
        item.className = "product-item";
        item.dataset.product = product.name;
        item.textContent = product.name;
        item.title = product.description || product.name;
        fragment.appendChild(item);
      });

      this.elements.productList.replaceChildren(fragment);
    }

    animateFoundProduct(productName, isComplete) {
      const item = this.elements.productList.querySelector(`[data-product="${productName}"]`);
      const state = this.game;

      if (!item) {
        if (isComplete) {
          this.showCompletion();
        }
        return;
      }

      item.classList.add("is-found");
      this.updateRemainingCount(state);

      const leaveTimer = window.setTimeout(() => item.classList.add("is-leaving"), 340);
      const removeTimer = window.setTimeout(() => {
        item.remove();
        if (isComplete && state.state === window.GAME_STATES.COMPLETED) {
          this.showCompletion();
        }
      }, 720);

      this.pendingTimers.push(leaveTimer, removeTimer);
    }

    updateRemainingCount(state) {
      const count = state.getRemainingProducts().length;
      this.elements.remainingCount.textContent = String(count);
      this.elements.remainingCount.setAttribute("aria-label", `剩餘 ${count} 個產品`);
    }

    showCompletion() {
      this.elements.completionPanel.hidden = false;
      this.elements.feedback.textContent = "全部找到！你成功找到了本局所有產品。";
      this.elements.completionPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      window.requestAnimationFrame(() => this.elements.replayButton.focus());
    }

    clearTimers() {
      this.pendingTimers.forEach((timer) => window.clearTimeout(timer));
      this.pendingTimers = [];
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const boardGenerator = new window.BoardGenerator(5);
    const game = new window.WorldSearchGame(window.PRODUCTS, boardGenerator);
    window.worldSearchGame = game;
    window.worldSearchUI = new GameUI(game);
  });
})();
