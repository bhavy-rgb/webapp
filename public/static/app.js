(function () {
  const { squareName, sq, rankOf, fileOf, WHITE, BLACK } = window.ChessUtils;

  let game = new window.ChessGame();
  let selectedSquare = null;
  let legalMovesForSelected = [];
  let boardFlipped = false;
  let lastMove = null; // { from, to }
  let pendingPromotion = null; // { from, to }
  const history = []; // stack of cloned games for undo

  const boardEl = document.getElementById('chess-board');
  const rankLabelsEl = document.getElementById('rank-labels');
  const fileLabelsEl = document.getElementById('file-labels');
  const turnTextEl = document.getElementById('turn-text');
  const turnDotEl = document.getElementById('turn-indicator-dot');
  const statusBannerEl = document.getElementById('status-banner');
  const moveListEl = document.getElementById('move-list');
  const capturedByWhiteEl = document.getElementById('captured-by-white');
  const capturedByBlackEl = document.getElementById('captured-by-black');
  const claimRepetitionBtn = document.getElementById('btn-claim-repetition');
  const claimFiftyBtn = document.getElementById('btn-claim-fifty');
  const promotionModal = document.getElementById('promotion-modal');
  const promotionChoicesEl = document.getElementById('promotion-choices');

  const PIECE_IMG = (color, type) => `/static/pieces/${color}${type.toUpperCase()}.svg`;

  function pushHistory() {
    history.push(cloneGameSnapshot(game));
  }

  function cloneGameSnapshot(g) {
    return g.clone();
  }

  function squareToRC(square) {
    return { rank: rankOf(square), file: fileOf(square) };
  }

  // Render coordinate labels according to flip state
  function renderLabels() {
    rankLabelsEl.innerHTML = '';
    fileLabelsEl.innerHTML = '';
    const ranks = boardFlipped ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1];
    const files = boardFlipped ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h'];
    for (const r of ranks) {
      const d = document.createElement('div');
      d.textContent = r;
      d.style.height = '80px';
      d.style.display = 'flex';
      d.style.alignItems = 'center';
      rankLabelsEl.appendChild(d);
    }
    for (const f of files) {
      const d = document.createElement('div');
      d.textContent = f;
      fileLabelsEl.appendChild(d);
    }
  }

  function displayOrderSquares() {
    // Returns array of 64 square indices in the order they should be rendered (row-major, top row first)
    const order = [];
    const ranksDesc = boardFlipped ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
    const filesOrder = boardFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
    for (const r of ranksDesc) {
      for (const f of filesOrder) {
        order.push(sq(r, f));
      }
    }
    return order;
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    const order = displayOrderSquares();
    const inCheckColor = game.status === 'playing' || game.status === 'checkmate' ? game.turn : null;
    const kingInCheckSq = inCheckColor !== null && game.isInCheck(inCheckColor) ? game.findKing(inCheckColor) : -1;

    for (const s of order) {
      const { rank, file } = squareToRC(s);
      const isLight = (rank + file) % 2 === 1;
      const div = document.createElement('div');
      div.className = 'square ' + (isLight ? 'light' : 'dark');
      div.dataset.square = s;

      if (lastMove && (s === lastMove.from || s === lastMove.to)) {
        div.classList.add('last-move');
      }
      if (s === selectedSquare) {
        div.classList.add('selected');
      }
      if (s === kingInCheckSq) {
        div.classList.add('in-check');
      }

      const piece = game.board[s];
      if (piece) {
        const img = document.createElement('img');
        img.className = 'piece';
        img.src = PIECE_IMG(piece.color, piece.type);
        img.alt = piece.color + piece.type;
        div.appendChild(img);
      }

      const moveHint = legalMovesForSelected.find(m => m.to === s);
      if (moveHint) {
        if (moveHint.capture || moveHint.isEnPassant) {
          const ring = document.createElement('div');
          ring.className = 'capture-ring';
          div.appendChild(ring);
        } else {
          const dot = document.createElement('div');
          dot.className = 'move-dot';
          div.appendChild(dot);
        }
      }

      div.classList.add('clickable');
      div.addEventListener('click', () => onSquareClick(s));
      boardEl.appendChild(div);
    }
  }

  function onSquareClick(square) {
    if (game.isGameOver()) return;
    if (pendingPromotion) return;

    const piece = game.board[square];

    if (selectedSquare === null) {
      if (piece && piece.color === game.turn) {
        selectedSquare = square;
        legalMovesForSelected = game.getLegalMovesFrom(square);
        renderBoard();
      }
      return;
    }

    if (square === selectedSquare) {
      selectedSquare = null;
      legalMovesForSelected = [];
      renderBoard();
      return;
    }

    const target = legalMovesForSelected.find(m => m.to === square);
    if (target) {
      if (target.promotion) {
        // Multiple promotion options exist for same from/to; show modal
        pendingPromotion = { from: selectedSquare, to: square };
        showPromotionModal(game.turn);
        return;
      }
      commitMove({ from: selectedSquare, to: square });
      return;
    }

    // Clicked another own piece: reselect
    if (piece && piece.color === game.turn) {
      selectedSquare = square;
      legalMovesForSelected = game.getLegalMovesFrom(square);
      renderBoard();
    } else {
      selectedSquare = null;
      legalMovesForSelected = [];
      renderBoard();
    }
  }

  function showPromotionModal(color) {
    promotionChoicesEl.innerHTML = '';
    for (const type of ['q', 'r', 'b', 'n']) {
      const choice = document.createElement('div');
      choice.className = 'promo-choice';
      const img = document.createElement('img');
      img.src = PIECE_IMG(color, type);
      choice.appendChild(img);
      choice.addEventListener('click', () => {
        const { from, to } = pendingPromotion;
        pendingPromotion = null;
        promotionModal.classList.add('hidden');
        commitMove({ from, to, promotion: type });
      });
      promotionChoicesEl.appendChild(choice);
    }
    promotionModal.classList.remove('hidden');
  }

  function commitMove(moveSpec) {
    pushHistory();
    const result = game.makeMove(moveSpec);
    if (!result.ok) {
      history.pop();
      console.warn('Illegal move attempted:', result.reason);
      return;
    }
    lastMove = { from: result.move.from, to: result.move.to };
    selectedSquare = null;
    legalMovesForSelected = [];
    fullRender();
  }

  function renderTurnBanner() {
    if (game.isGameOver()) {
      turnTextEl.textContent = 'Game over';
    } else {
      turnTextEl.textContent = (game.turn === WHITE ? 'White' : 'Black') + ' to move' + (game.isInCheck(game.turn) ? ' — CHECK!' : '');
      turnDotEl.className = 'turn-dot ' + (game.turn === WHITE ? 'white' : 'black');
    }
  }

  function renderStatusBanner() {
    statusBannerEl.classList.remove('win', 'draw');
    if (game.status === 'playing') {
      statusBannerEl.classList.add('hidden');
      return;
    }
    statusBannerEl.classList.remove('hidden');
    if (game.status === 'checkmate') {
      statusBannerEl.classList.add('win');
      const winnerName = game.winner === WHITE ? 'White' : 'Black';
      statusBannerEl.textContent = `Checkmate! ${winnerName} wins. (Article 5.1a)`;
    } else if (game.status === 'stalemate') {
      statusBannerEl.classList.add('draw');
      statusBannerEl.textContent = 'Draw — Stalemate (Article 5.2a)';
    } else if (game.status === 'draw') {
      statusBannerEl.classList.add('draw');
      statusBannerEl.textContent = `Draw — ${game.drawReason || 'Agreed'}`;
    } else if (game.status === 'resigned') {
      statusBannerEl.classList.add('win');
      const winnerName = game.winner === WHITE ? 'White' : 'Black';
      statusBannerEl.textContent = `${winnerName === 'White' ? 'Black' : 'White'} resigned. ${winnerName} wins.`;
    }
  }

  function renderMoveList() {
    moveListEl.innerHTML = '';
    for (let i = 0; i < game.history.length; i += 2) {
      const li = document.createElement('li');
      const whiteMove = game.history[i];
      const blackMove = game.history[i + 1];
      let text = whiteMove.san;
      if (blackMove) text += '   ' + blackMove.san;
      li.textContent = text;
      moveListEl.appendChild(li);
    }
    moveListEl.scrollTop = moveListEl.scrollHeight;
  }

  function renderCaptured() {
    capturedByWhiteEl.innerHTML = '';
    capturedByBlackEl.innerHTML = '';
    // capturedPieces.b = black pieces captured (by white); capturedPieces.w = white pieces captured (by black)
    const order = { q: 0, r: 1, b: 2, n: 3, p: 4 };
    const capturedByWhite = [...game.capturedPieces.b].sort((a, b) => order[a] - order[b]);
    const capturedByBlack = [...game.capturedPieces.w].sort((a, b) => order[a] - order[b]);
    for (const type of capturedByWhite) {
      const img = document.createElement('img');
      img.src = PIECE_IMG('b', type);
      capturedByWhiteEl.appendChild(img);
    }
    for (const type of capturedByBlack) {
      const img = document.createElement('img');
      img.src = PIECE_IMG('w', type);
      capturedByBlackEl.appendChild(img);
    }
  }

  function renderClaimButtons() {
    claimRepetitionBtn.classList.toggle('hidden', !(game.status === 'playing' && game.canClaimThreefoldRepetition()));
    claimFiftyBtn.classList.toggle('hidden', !(game.status === 'playing' && game.canClaimFiftyMoveRule()));
  }

  function fullRender() {
    renderLabels();
    renderBoard();
    renderTurnBanner();
    renderStatusBanner();
    renderMoveList();
    renderCaptured();
    renderClaimButtons();
  }

  // ---------- Controls ----------
  document.getElementById('btn-new-game').addEventListener('click', () => {
    game = new window.ChessGame();
    selectedSquare = null;
    legalMovesForSelected = [];
    lastMove = null;
    pendingPromotion = null;
    history.length = 0;
    fullRender();
  });

  document.getElementById('btn-flip-board').addEventListener('click', () => {
    boardFlipped = !boardFlipped;
    fullRender();
  });

  document.getElementById('btn-undo').addEventListener('click', () => {
    if (history.length === 0) return;
    game = history.pop();
    selectedSquare = null;
    legalMovesForSelected = [];
    lastMove = game.history.length > 0
      ? { from: game.history[game.history.length - 1].from, to: game.history[game.history.length - 1].to }
      : null;
    fullRender();
  });

  document.getElementById('btn-resign').addEventListener('click', () => {
    if (game.isGameOver()) return;
    if (confirm(`${game.turn === WHITE ? 'White' : 'Black'} resigns — confirm?`)) {
      game.resign(game.turn);
      fullRender();
    }
  });

  document.getElementById('btn-draw-agree').addEventListener('click', () => {
    if (game.isGameOver()) return;
    if (confirm('Both players agree to a draw — confirm?')) {
      game.offerDrawAgreement();
      fullRender();
    }
  });

  claimRepetitionBtn.addEventListener('click', () => {
    game.claimDraw('repetition');
    fullRender();
  });

  claimFiftyBtn.addEventListener('click', () => {
    game.claimDraw('fifty-move');
    fullRender();
  });

  // Initial render
  fullRender();
})();
