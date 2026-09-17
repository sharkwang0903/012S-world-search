(function () {
  "use strict";

  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

  class GameUI {
    constructor(game) {
      this.game = game;
      this.errorCells = new Set();
      this.pendingTimers = [];
      this.hasShownProductLinkHint = false;
      this.selectedMode = this.game.currentMode;

      this.elements = {
        homeScreen: document.querySelector("#home-screen"),
        gameScreen: document.querySelector("#game-screen"),
        modeOptions: document.querySelector("#mode-options"),
        startButton: document.querySelector("#start-button"),
        playingHomeButton: document.querySelector("#playing-home-button"),
        completedHomeButton: document.querySelector("#completed-home-button"),
        replayButton: document.querySelector("#replay-button"),
        board: document.querySelector("#board"),
        gameModeLabel: document.querySelector("#game-mode-label"),
        currentSelection: document.querySelector("#current-selection"),
        productList: document.querySelector("#product-list"),
        productLinkHint: document.querySelector("#product-link-hint"),
        remainingCount: document.querySelector("#remaining-count"),
        feedback: document.querySelector("#game-feedback"),
        completionPanel: document.querySelector("#completion-panel")
      };

      this.renderModeOptions();
      this.bindEvents();
      this.game.subscribe((state, event) => this.render(state, event));
    }

    bindEvents() {
      this.elements.modeOptions.addEventListener("change", (event) => {
        if (event.target.matches('input[name="mode"]')) {
          this.selectedMode = event.target.value;
        }
      });
      this.elements.startButton.addEventListener("click", () => {
        this.game.startGame(this.selectedMode);
      });
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

    renderModeOptions() {
      const fragment = document.createDocumentFragment();

      Object.values(window.GAME_MODES).forEach((mode) => {
        const card = document.createElement("label");
        card.className = "mode-card";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = "mode";
        input.value = mode.key;
        input.checked = mode.key === this.selectedMode;

        const check = document.createElement("span");
        check.className = "mode-check";
        check.setAttribute("aria-hidden", "true");

        const copy = document.createElement("span");
        copy.className = "mode-copy";

        const name = document.createElement("strong");
        name.textContent = mode.label;

        const details = document.createElement("span");
        details.textContent = `${mode.boardSize} × ${mode.boardSize} 字母棋盤 · 每局 ${mode.targetCount} 個產品 · 不限時間`;

        copy.append(name, details);
        card.append(input, check, copy);
        fragment.appendChild(card);
      });

      this.elements.modeOptions.replaceChildren(fragment);
    }

    render(state, event) {
      if (state.state === window.GAME_STATES.HOME) {
        this.renderHome(state, event);
        return;
      }

      this.elements.homeScreen.hidden = true;
      this.elements.gameScreen.hidden = false;
      this.renderSelection(state);

      if (event.type === "game-started") {
        this.clearTimers();
        this.errorCells.clear();
        this.resetProductLinkHint();
        this.elements.completionPanel.hidden = true;
        this.renderModeHeading(state);
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
        this.showProductLinkHint();
        this.animateFoundProduct(event.product.name, event.highlightColor, event.isComplete);
        return;
      }

      this.renderBoard(state);
      this.updateRemainingCount(state);

      if (state.state === window.GAME_STATES.COMPLETED) {
        this.showCompletion();
      }
    }

    renderHome(state, event) {
      this.clearTimers();
      this.elements.homeScreen.hidden = false;
      this.elements.gameScreen.hidden = true;
      this.elements.completionPanel.hidden = true;
      this.elements.board.replaceChildren();
      this.elements.productList.replaceChildren();
      this.resetProductLinkHint();
      this.elements.feedback.textContent = "";

      this.selectedMode = state.currentMode;
      const defaultModeInput = this.elements.modeOptions.querySelector(
        `input[value="${this.selectedMode}"]`
      );
      if (defaultModeInput) {
        defaultModeInput.checked = true;
      }

      if (event.type === "home") {
        window.requestAnimationFrame(() => this.elements.startButton.focus());
      }
    }

    renderBoard(state, hasError = false, newestProductName = "") {
      const selectedKeys = new Set(state.selection.map((cell) => state.cellKey(cell)));
      const fragment = document.createDocumentFragment();

      this.elements.board.style.setProperty("--board-size", state.boardSize);
      this.elements.board.dataset.size = state.boardSize;
      this.elements.board.setAttribute(
        "aria-label",
        `${state.boardSize} 乘 ${state.boardSize} 字母棋盤`
      );

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

      state.completedPaths.forEach((completed) => {
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
        const color = state.productHighlightMap.get(completed.productName);
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

    renderModeHeading(state) {
      const mode = state.getCurrentModeConfig();
      this.elements.gameModeLabel.textContent = (
        `${mode.englishLabel} · ${mode.boardSize} × ${mode.boardSize}`
      );
    }

    renderProductList(products) {
      const fragment = document.createDocumentFragment();

      products.forEach((product) => {
        fragment.appendChild(this.createProductItem(product, false));
      });

      this.elements.productList.replaceChildren(fragment);
      this.elements.productList.classList.toggle("is-dense", products.length > 4);
      this.elements.productList.dataset.count = products.length;
    }

    createProductItem(product, isFound) {
      const item = document.createElement("li");
      item.className = `product-item ${isFound ? "is-found" : "is-unfound"}`;
      item.dataset.product = product.name;
      item.dataset.state = isFound ? "FOUND" : "UNFOUND";

      const label = this.createProductLabel(product, isFound);
      item.appendChild(label);
      return item;
    }

    createProductLabel(product, isFound) {
      const productUrl = typeof product.url === "string" ? product.url.trim() : "";

      if (isFound && productUrl) {
        const link = document.createElement("a");
        link.className = "product-label product-link";
        link.href = productUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = product.name;
        link.title = product.description || `查看 ${product.name} 產品資訊`;
        link.setAttribute("aria-label", `查看 ${product.name} 產品資訊（開新分頁）`);
        return link;
      }

      const label = document.createElement("span");
      label.className = "product-label product-name";
      label.textContent = product.name;
      label.title = product.description || (
        isFound ? `${product.name} 已找到，目前尚無產品連結` : product.name
      );
      return label;
    }

    animateFoundProduct(productName, highlightColor, isComplete) {
      const item = this.elements.productList.querySelector(`[data-product="${productName}"]`);
      const state = this.game;

      if (!item) {
        if (isComplete) {
          this.showCompletion();
        }
        return;
      }

      const product = state.roundProducts.find((entry) => entry.name === productName);
      item.classList.remove("is-unfound");
      item.classList.add(
        "is-found",
        "is-celebrating",
        `product-highlight-${highlightColor}`
      );
      item.dataset.state = "FOUND";
      item.replaceChildren(this.createProductLabel(product, true));
      this.updateRemainingCount(state);

      const settleTimer = window.setTimeout(() => {
        item.classList.remove("is-celebrating");
        if (isComplete && state.state === window.GAME_STATES.COMPLETED) {
          this.showCompletion();
        }
      }, 520);

      this.pendingTimers.push(settleTimer);
    }

    showProductLinkHint() {
      if (this.hasShownProductLinkHint) {
        return;
      }

      this.hasShownProductLinkHint = true;
      this.elements.productLinkHint.hidden = false;
      this.elements.productLinkHint.classList.add("is-visible");
    }

    resetProductLinkHint() {
      this.hasShownProductLinkHint = false;
      this.elements.productLinkHint.hidden = true;
      this.elements.productLinkHint.classList.remove("is-visible");
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
    const boardGenerator = new window.BoardGenerator();
    const game = new window.WorldSearchGame(window.PRODUCTS, boardGenerator);
    window.worldSearchGame = game;
    window.worldSearchUI = new GameUI(game);
  });
})();
