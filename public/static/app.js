(function () {
  const { squareName, sq, rankOf, fileOf, WHITE, BLACK } = window.ChessUtils;

  // ---------------------------------------------------------------------
  // App state
  // ---------------------------------------------------------------------
  let game = new window.ChessGame();
  let selectedSquare = null;
  let legalMovesForSelected = [];
  let boardFlipped = false;
  let lastMove = null;               // { from, to }
  let pendingPromotion = null;       // { from, to }
  const undoStack = [];              // cloned games (local & maia modes)

  // Mode: 'local' | 'maia' | 'online'
  let mode = 'local';

  // Maia settings
  let maia = { level: 1100, think: 'human', playerColor: 'w', thinking: false };

  // Online settings
  let online = {
    code: null, token: null, color: 'w',
    pollTimer: null, syncing: false, lastResult: null,
  };

  // Clock state (used by maia + online modes)
  let clock = {
    enabled: false, timeMinutes: 0, incrementSeconds: 0,
    whiteMs: 0, blackMs: 0, tickTimer: null, lastTick: 0, running: false,
  };

  // ---------------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const boardEl = $('chess-board');
  const rankLabelsEl = $('rank-labels');
  const fileLabelsEl = $('file-labels');
  const turnTextEl = $('turn-text');
  const turnDotEl = $('turn-indicator-dot');
  const statusBannerEl = $('status-banner');
  const moveListEl = $('move-list');
  const capturedByWhiteEl = $('captured-by-white');
  const capturedByBlackEl = $('captured-by-black');
  const claimRepetitionBtn = $('btn-claim-repetition');
  const claimFiftyBtn = $('btn-claim-fifty');
  const promotionModal = $('promotion-modal');
  const promotionChoicesEl = $('promotion-choices');
  const modeMenuEl = $('mode-hero');
  const mainLayoutEl = $('main-layout');
  const shareBannerEl = $('share-banner');
  const shareCodeEl = $('share-code');
  const drawOfferBannerEl = $('draw-offer-banner');
  const opponentNameEl = $('opponent-name');
  const playerNameEl = $('player-name');
  const clockTopEl = $('clock-top');
  const clockBottomEl = $('clock-bottom');

  const PIECE_IMG = (color, type) => `/static/pieces/${color}${type.toUpperCase()}.svg`;

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  function myColor() {
    if (mode === 'maia') return maia.playerColor;
    if (mode === 'online') return online.color;
    return game.turn; // local: whoever is to move
  }

  function isMyTurn() {
    if (mode === 'local') return true;
    return game.turn === myColor();
  }

  function fmtClock(ms) {
    if (ms === null || ms === undefined) return '--:--';
    ms = Math.max(0, ms);
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (ms < 20000) {
      const tenths = Math.floor((ms % 1000) / 100);
      return `${m}:${String(s).padStart(2, '0')}.${tenths}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------
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
    const order = [];
    const ranksDesc = boardFlipped ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
    const filesOrder = boardFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
    for (const r of ranksDesc) for (const f of filesOrder) order.push(sq(r, f));
    return order;
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    const order = displayOrderSquares();
    const inCheckColor = game.status === 'playing' || game.status === 'checkmate' ? game.turn : null;
    const kingInCheckSq = inCheckColor !== null && game.isInCheck(inCheckColor) ? game.findKing(inCheckColor) : -1;

    for (const s of order) {
      const rank = rankOf(s), file = fileOf(s);
      const isLight = (rank + file) % 2 === 1;
      const div = document.createElement('div');
      div.className = 'square ' + (isLight ? 'light' : 'dark');
      div.dataset.square = s;

      if (lastMove && (s === lastMove.from || s === lastMove.to)) div.classList.add('last-move');
      if (s === selectedSquare) div.classList.add('selected');
      if (s === kingInCheckSq) div.classList.add('in-check');

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
        const el = document.createElement('div');
        el.className = (moveHint.capture || moveHint.isEnPassant) ? 'capture-ring' : 'move-dot';
        div.appendChild(el);
      }

      div.classList.add('clickable');
      div.addEventListener('click', () => onSquareClick(s));
      boardEl.appendChild(div);
    }
  }

  function renderTurnBanner() {
    if (game.isGameOver() || (mode === 'online' && online.lastResult)) {
      turnTextEl.textContent = 'Game over';
      return;
    }
    let who = game.turn === WHITE ? 'White' : 'Black';
    if (mode === 'maia' && game.turn !== maia.playerColor) who = `Maia ${maia.level}`;
    if (mode === 'maia' && game.turn === maia.playerColor) who = 'You';
    if (mode === 'online') who = game.turn === online.color ? 'You' : 'Opponent';
    const suffix = mode === 'local' ? ' to move' : (isMyTurn() ? ' — your move' : (maia.thinking ? ' — thinking…' : ' to move'));
    turnTextEl.textContent = who + suffix + (game.isInCheck(game.turn) ? ' — CHECK!' : '');
    turnDotEl.className = 'turn-dot ' + (game.turn === WHITE ? 'white' : 'black');
  }

  function describeOnlineResult(result) {
    const [kind, side] = (result || '').split(':');
    const name = side === 'w' ? 'White' : 'Black';
    const meWon = side === online.color;
    switch (kind) {
      case 'checkmate': return { text: `Checkmate! ${name} wins${meWon ? ' — you win!' : '.'} (Article 5.1a)`, cls: 'win' };
      case 'resign': return { text: `${side === 'w' ? 'Black' : 'White'} resigned. ${name} wins${meWon ? ' — you win!' : '.'}`, cls: 'win' };
      case 'timeout': return { text: `${side === 'w' ? 'Black' : 'White'} ran out of time. ${name} wins${meWon ? ' — you win!' : '.'}`, cls: 'win' };
      case 'stalemate': return { text: 'Draw — Stalemate (Article 5.2a)', cls: 'draw' };
      case 'draw': {
        const reasons = { agreement: 'Agreement (Article 5.2c)', repetition: 'Threefold repetition (Article 9.2)', 'fifty-move': '50-move rule (Article 9.3)', dead: 'Dead position (Article 5.2b/9.6)' };
        return { text: 'Draw — ' + (reasons[side] || side), cls: 'draw' };
      }
      default: return { text: result, cls: 'draw' };
    }
  }

  function renderStatusBanner() {
    statusBannerEl.classList.remove('win', 'draw');

    // Online result takes precedence (covers resignation/timeout by opponent)
    if (mode === 'online' && online.lastResult) {
      const { text, cls } = describeOnlineResult(online.lastResult);
      statusBannerEl.classList.remove('hidden');
      statusBannerEl.classList.add(cls);
      statusBannerEl.textContent = text;
      return;
    }

    if (game.status === 'playing') {
      statusBannerEl.classList.add('hidden');
      return;
    }
    statusBannerEl.classList.remove('hidden');
    if (game.status === 'checkmate') {
      statusBannerEl.classList.add('win');
      const winnerName = game.winner === WHITE ? 'White' : 'Black';
      let extra = '';
      if (mode === 'maia') extra = game.winner === maia.playerColor ? ' You beat Maia!' : ` Maia ${maia.level} wins.`;
      statusBannerEl.textContent = `Checkmate! ${winnerName} wins.${extra} (Article 5.1a)`;
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
    } else if (game.status === 'timeout') {
      statusBannerEl.classList.add('win');
      const winnerName = game.winner === WHITE ? 'White' : 'Black';
      statusBannerEl.textContent = `${winnerName === 'White' ? 'Black' : 'White'} ran out of time. ${winnerName} wins.`;
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
    const active = game.status === 'playing' && !(mode === 'online' && online.lastResult);
    const canClaim = mode === 'local' || isMyTurn();
    claimRepetitionBtn.classList.toggle('hidden', !(active && canClaim && game.canClaimThreefoldRepetition()));
    claimFiftyBtn.classList.toggle('hidden', !(active && canClaim && game.canClaimFiftyMoveRule()));
  }

  function renderPlayerBars() {
    const showBars = mode !== 'local';
    $('opponent-bar').classList.toggle('hidden', !showBars && !clock.enabled);
    $('player-bar-bottom').classList.toggle('hidden', !showBars && !clock.enabled);

    let opp = '', me = '';
    if (mode === 'maia') { opp = `🤖 Maia ${maia.level}`; me = 'You'; }
    else if (mode === 'online') { opp = '🌐 Opponent'; me = 'You'; }
    else { opp = 'Black'; me = 'White'; }
    // Bottom bar = my side; top = opponent. Attach clocks to actual colors.
    opponentNameEl.textContent = opp;
    playerNameEl.textContent = me;

    clockTopEl.classList.toggle('hidden', !clock.enabled);
    clockBottomEl.classList.toggle('hidden', !clock.enabled);
    if (clock.enabled) {
      const my = myColor();
      const myMs = my === WHITE ? clock.whiteMs : clock.blackMs;
      const oppMs = my === WHITE ? clock.blackMs : clock.whiteMs;
      clockBottomEl.textContent = fmtClock(myMs);
      clockTopEl.textContent = fmtClock(oppMs);
      clockBottomEl.classList.toggle('clock-active', clock.running && game.turn === my);
      clockTopEl.classList.toggle('clock-active', clock.running && game.turn !== my);
      clockBottomEl.classList.toggle('clock-low', myMs < 20000 && myMs > 0);
      clockTopEl.classList.toggle('clock-low', oppMs < 20000 && oppMs > 0);
    }
  }

  function renderModeButtons() {
    $('btn-undo').classList.toggle('hidden', mode === 'online');
    $('btn-flip-board').classList.toggle('hidden', mode === 'online');
    $('btn-new-game').classList.toggle('hidden', mode === 'online');
    $('btn-draw-agree').textContent = mode === 'local' ? 'Offer / Agree Draw' : 'Offer Draw';
    $('btn-draw-agree').classList.toggle('hidden', mode === 'maia'); // Maia declines all draws :)
  }

  function fullRender() {
    renderLabels();
    renderBoard();
    renderTurnBanner();
    renderStatusBanner();
    renderMoveList();
    renderCaptured();
    renderClaimButtons();
    renderPlayerBars();
    renderModeButtons();
  }

  // ---------------------------------------------------------------------
  // Clock handling (maia + online local ticking; online is server-authoritative)
  // ---------------------------------------------------------------------
  function startClockTicking() {
    stopClockTicking();
    if (!clock.enabled) return;
    clock.lastTick = Date.now();
    clock.running = true;
    clock.tickTimer = setInterval(() => {
      const now = Date.now();
      const dt = now - clock.lastTick;
      clock.lastTick = now;
      if (game.isGameOver() || (mode === 'online' && online.lastResult)) { stopClockTicking(); return; }
      if (mode === 'online' && game.history.length === 0 && online.lastStatus !== 'active') return; // waiting
      if (game.turn === WHITE) clock.whiteMs -= dt; else clock.blackMs -= dt;
      if (clock.whiteMs <= 0 || clock.blackMs <= 0) {
        clock.whiteMs = Math.max(0, clock.whiteMs);
        clock.blackMs = Math.max(0, clock.blackMs);
        if (mode === 'maia' || mode === 'local') {
          const flagged = clock.whiteMs <= 0 ? WHITE : BLACK;
          game.status = 'timeout';
          game.winner = flagged === WHITE ? BLACK : WHITE;
          stopClockTicking();
          fullRender();
          return;
        }
        // online: server will confirm timeout on next poll
      }
      renderPlayerBars();
    }, 100);
  }

  function stopClockTicking() {
    if (clock.tickTimer) clearInterval(clock.tickTimer);
    clock.tickTimer = null;
    clock.running = false;
  }

  function applyIncrement(moverColor) {
    if (!clock.enabled) return;
    if (moverColor === WHITE) clock.whiteMs += clock.incrementSeconds * 1000;
    else clock.blackMs += clock.incrementSeconds * 1000;
  }

  // ---------------------------------------------------------------------
  // Move interaction
  // ---------------------------------------------------------------------
  function onSquareClick(square) {
    if (game.isGameOver() || (mode === 'online' && online.lastResult)) return;
    if (pendingPromotion) return;
    if (!isMyTurn()) return;
    if (mode === 'maia' && maia.thinking) return;

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
        pendingPromotion = { from: selectedSquare, to: square };
        showPromotionModal(game.turn);
        return;
      }
      commitMove({ from: selectedSquare, to: square });
      return;
    }

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

  // Detect a game-end string for the online API after a move is applied
  function detectResultString() {
    if (game.status === 'checkmate') return `checkmate:${game.winner}`;
    if (game.status === 'stalemate') return 'stalemate:-';
    if (game.status === 'draw') return 'draw:dead';
    return null;
  }

  function commitMove(moveSpec) {
    if (mode !== 'online') undoStack.push(game.clone());
    const moverColor = game.turn;
    const result = game.makeMove(moveSpec);
    if (!result.ok) {
      if (mode !== 'online') undoStack.pop();
      console.warn('Illegal move attempted:', result.reason);
      return;
    }
    lastMove = { from: result.move.from, to: result.move.to };
    selectedSquare = null;
    legalMovesForSelected = [];
    applyIncrement(moverColor);
    if (clock.enabled && !clock.running && !game.isGameOver()) startClockTicking();
    fullRender();

    if (mode === 'maia' && !game.isGameOver() && game.turn !== maia.playerColor) {
      scheduleMaiaMove();
    }
    if (mode === 'online') {
      pushOnlineMove({ from: result.move.from, to: result.move.to, promotion: moveSpec.promotion || null });
    }
  }

  // ---------------------------------------------------------------------
  // Maia bot
  // ---------------------------------------------------------------------
  function scheduleMaiaMove() {
    maia.thinking = true;
    renderTurnBanner();
    const delay = window.MaiaBot.thinkTime(maia.level, maia.think === 'instant' ? 'instant' : 'human');
    setTimeout(() => {
      if (mode !== 'maia' || game.isGameOver()) { maia.thinking = false; return; }
      const move = window.MaiaBot.chooseMove(game, maia.level);
      maia.thinking = false;
      if (!move) return;
      const moverColor = game.turn;
      const result = game.makeMove(move);
      if (result.ok) {
        lastMove = { from: result.move.from, to: result.move.to };
        applyIncrement(moverColor);
        if (clock.enabled && !clock.running && !game.isGameOver()) startClockTicking();
      }
      fullRender();
    }, delay);
  }

  function startMaiaGame(opts) {
    mode = 'maia';
    maia.level = opts.level;
    maia.think = opts.think;
    maia.playerColor = opts.color === 'random' ? (Math.random() < 0.5 ? WHITE : BLACK) : opts.color;

    game = new window.ChessGame();
    if (opts.fen) {
      if (!game.loadFEN(opts.fen)) {
        alert('Invalid FEN position — starting from the standard initial position instead.');
        game = new window.ChessGame();
      }
    }
    selectedSquare = null; legalMovesForSelected = []; lastMove = null;
    pendingPromotion = null; undoStack.length = 0;
    boardFlipped = maia.playerColor === BLACK;

    setupClock(opts.timeMinutes, opts.incrementSeconds);
    showGame();
    fullRender();

    if (!game.isGameOver() && game.turn !== maia.playerColor) scheduleMaiaMove();
  }

  function setupClock(minutes, inc) {
    stopClockTicking();
    clock.enabled = minutes > 0;
    clock.timeMinutes = minutes;
    clock.incrementSeconds = inc || 0;
    clock.whiteMs = minutes * 60000;
    clock.blackMs = minutes * 60000;
  }

  // ---------------------------------------------------------------------
  // Online friend games
  // ---------------------------------------------------------------------
  async function api(path, opts) {
    const res = await fetch(path, {
      method: opts && opts.body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function friendError(msg) {
    const el = $('friend-error');
    el.textContent = msg;
    el.classList.toggle('hidden', !msg);
  }

  async function createFriendGame(opts) {
    const data = await api('/api/games', { body: {
      color: opts.color, timeMinutes: opts.timeMinutes, incrementSeconds: opts.incrementSeconds,
    }});
    beginOnlineGame(data);
    // Show share banner until opponent joins
    shareCodeEl.textContent = data.code;
    shareBannerEl.classList.remove('hidden');
  }

  async function joinFriendGame(code) {
    const data = await api(`/api/games/${encodeURIComponent(code)}/join`, { body: {} });
    beginOnlineGame(data);
  }

  function beginOnlineGame(data) {
    mode = 'online';
    online.code = data.code;
    online.token = data.token;
    online.color = data.color;
    online.lastResult = null;
    online.lastStatus = null;
    online.syncing = false;

    game = new window.ChessGame();
    selectedSquare = null; legalMovesForSelected = []; lastMove = null;
    pendingPromotion = null; undoStack.length = 0;
    boardFlipped = online.color === BLACK;

    setupClock(data.timeMinutes || 0, data.incrementSeconds || 0);

    // Reflect join in URL so refresh/back keeps context
    try { history.replaceState(null, '', `?game=${data.code}`); } catch (e) {}

    showGame();
    fullRender();
    startPolling();
  }

  function startPolling() {
    stopPolling();
    online.pollTimer = setInterval(pollOnlineState, 2000);
    pollOnlineState();
  }

  function stopPolling() {
    if (online.pollTimer) clearInterval(online.pollTimer);
    online.pollTimer = null;
  }

  async function pollOnlineState() {
    if (mode !== 'online' || !online.code || online.syncing) return;
    let state;
    try {
      state = await api(`/api/games/${online.code}/state`);
    } catch (e) { return; }
    if (mode !== 'online') return;

    online.lastStatus = state.status;

    // Hide share banner once both players joined
    if (state.whiteJoined && state.blackJoined) shareBannerEl.classList.add('hidden');

    // Sync clocks from server (authoritative)
    if (clock.enabled && state.whiteMs !== null) {
      clock.whiteMs = state.whiteMs;
      clock.blackMs = state.blackMs;
      if (state.status === 'active' && !clock.running && state.moves.length > 0) startClockTicking();
    }

    // Apply any moves we don't have yet
    if (state.moves.length > game.history.length) {
      for (let i = game.history.length; i < state.moves.length; i++) {
        const m = state.moves[i];
        const r = game.makeMove({ from: m.from, to: m.to, promotion: m.promotion || undefined });
        if (!r.ok) { console.error('Failed to apply remote move', m); break; }
        lastMove = { from: m.from, to: m.to };
      }
      selectedSquare = null; legalMovesForSelected = [];
      fullRender();
    }

    // Game-over from server (resign, timeout, draw, checkmate)
    if (state.status === 'finished' && state.result && !online.lastResult) {
      online.lastResult = state.result;
      stopClockTicking();
      stopPolling();
      fullRender();
    }

    // Draw offer from opponent
    const offerFromOpp = state.drawOffer && state.drawOffer !== online.color;
    drawOfferBannerEl.classList.toggle('hidden', !offerFromOpp || state.status !== 'active');

    renderTurnBanner();
  }

  async function pushOnlineMove(move) {
    online.syncing = true;
    try {
      const result = detectResultString();
      await api(`/api/games/${online.code}/move`, { body: {
        token: online.token, move, moveIndex: game.history.length - 1, result,
      }});
      if (result) { online.lastResult = result; stopPolling(); stopClockTicking(); fullRender(); }
    } catch (e) {
      console.error('Move sync failed:', e.message);
      alert('Could not sync your move: ' + e.message + '\nReloading game state…');
      // Re-sync from server
      game = new window.ChessGame();
      lastMove = null;
      online.syncing = false;
      await pollOnlineState();
      return;
    }
    online.syncing = false;
  }

  // ---------------------------------------------------------------------
  // Mode menu / navigation
  // ---------------------------------------------------------------------
  function showMenu() {
    stopPolling();
    stopClockTicking();
    mode = 'local';
    online.code = null; online.token = null; online.lastResult = null;
    shareBannerEl.classList.add('hidden');
    drawOfferBannerEl.classList.add('hidden');
    modeMenuEl.classList.remove('hidden');
    mainLayoutEl.classList.add('hidden');
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
  }

  function showGame() {
    modeMenuEl.classList.add('hidden');
    mainLayoutEl.classList.remove('hidden');
    shareBannerEl.classList.add('hidden');
    drawOfferBannerEl.classList.add('hidden');
  }

  function startLocalGame() {
    mode = 'local';
    game = new window.ChessGame();
    selectedSquare = null; legalMovesForSelected = []; lastMove = null;
    pendingPromotion = null; undoStack.length = 0;
    boardFlipped = false;
    setupClock(0, 0);
    showGame();
    fullRender();
  }

  // ---------------------------------------------------------------------
  // Modal helpers (time-control presets, sliders, color pick)
  // ---------------------------------------------------------------------
  function wireTimeControls(prefix) {
    const presets = $(`${prefix}-tc-presets`);
    const timeSlider = $(`${prefix}-time-slider`);
    const incSlider = $(`${prefix}-inc-slider`);
    const timeValue = $(`${prefix}-time-value`);
    const incValue = $(`${prefix}-inc-value`);

    function syncFromSliders() {
      timeValue.textContent = timeSlider.value;
      incValue.textContent = incSlider.value;
      // Highlight matching preset if any
      let matched = false;
      presets.querySelectorAll('.tc-btn').forEach(btn => {
        const isMatch = btn.dataset.min === timeSlider.value && btn.dataset.inc === incSlider.value;
        btn.classList.toggle('active', isMatch);
        if (isMatch) matched = true;
      });
      if (!matched) presets.querySelectorAll('.tc-btn').forEach(b => b.classList.remove('active'));
    }

    presets.querySelectorAll('.tc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        timeSlider.value = btn.dataset.min;
        incSlider.value = btn.dataset.inc;
        syncFromSliders();
      });
    });
    timeSlider.addEventListener('input', syncFromSliders);
    incSlider.addEventListener('input', syncFromSliders);
    syncFromSliders();

    return () => ({
      timeMinutes: parseInt(timeSlider.value, 10) || 0,
      incrementSeconds: parseInt(incSlider.value, 10) || 0,
    });
  }

  function wireColorChoices(containerId) {
    const container = $(containerId);
    container.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
    return () => container.querySelector('.color-btn.selected').dataset.color;
  }

  const getMaiaTC = wireTimeControls('maia');
  const getFriendTC = wireTimeControls('friend');
  const getMaiaColor = wireColorChoices('maia-color-choices');
  const getFriendColor = wireColorChoices('friend-color-choices');

  // Maia thinking-time toggle
  $('maia-think-toggle').querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $('maia-think-toggle').querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Custom position toggle
  $('maia-custom-pos').addEventListener('change', (e) => {
    $('maia-fen-input').classList.toggle('hidden', !e.target.checked);
  });

  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => $(btn.dataset.close).classList.add('hidden'));
  });

  // Friend modal tabs
  $('tab-create').addEventListener('click', () => {
    $('tab-create').classList.add('active');
    $('tab-join').classList.remove('active');
    $('friend-create-panel').classList.remove('hidden');
    $('friend-join-panel').classList.add('hidden');
    friendError('');
  });
  $('tab-join').addEventListener('click', () => {
    $('tab-join').classList.add('active');
    $('tab-create').classList.remove('active');
    $('friend-join-panel').classList.remove('hidden');
    $('friend-create-panel').classList.add('hidden');
    friendError('');
  });

  // ---------------------------------------------------------------------
  // Menu cards
  // ---------------------------------------------------------------------
  $('mode-local').addEventListener('click', startLocalGame);
  $('mode-maia').addEventListener('click', () => $('maia-modal').classList.remove('hidden'));
  $('mode-friend').addEventListener('click', () => {
    friendError('');
    $('friend-modal').classList.remove('hidden');
  });

  $('btn-start-maia').addEventListener('click', () => {
    const tc = getMaiaTC();
    const think = $('maia-think-toggle').querySelector('.toggle-btn.active').dataset.think;
    const fen = $('maia-custom-pos').checked ? $('maia-fen-input').value.trim() : null;
    $('maia-modal').classList.add('hidden');
    startMaiaGame({
      level: parseInt($('maia-level').value, 10),
      think,
      color: getMaiaColor(),
      timeMinutes: tc.timeMinutes,
      incrementSeconds: tc.incrementSeconds,
      fen: fen || null,
    });
  });

  $('btn-create-friend').addEventListener('click', async () => {
    friendError('');
    const tc = getFriendTC();
    try {
      $('btn-create-friend').disabled = true;
      await createFriendGame({ color: getFriendColor(), ...tc });
      $('friend-modal').classList.add('hidden');
    } catch (e) {
      friendError(e.message);
    } finally {
      $('btn-create-friend').disabled = false;
    }
  });

  $('btn-join-friend').addEventListener('click', async () => {
    friendError('');
    const code = $('join-code-input').value.trim().toUpperCase();
    if (code.length !== 6) { friendError('Enter the 6-character game code.'); return; }
    try {
      $('btn-join-friend').disabled = true;
      await joinFriendGame(code);
      $('friend-modal').classList.add('hidden');
    } catch (e) {
      friendError(e.message);
    } finally {
      $('btn-join-friend').disabled = false;
    }
  });

  // ---------------------------------------------------------------------
  // Game controls
  // ---------------------------------------------------------------------
  $('btn-back-menu').addEventListener('click', () => {
    if (mode === 'online' && !online.lastResult && game.history.length > 0 && !game.isGameOver()) {
      if (!confirm('Leave this online game? (You can rejoin with the same link while it lasts.)')) return;
    }
    showMenu();
  });

  $('btn-new-game').addEventListener('click', () => {
    if (mode === 'maia') {
      startMaiaGame({
        level: maia.level, think: maia.think, color: maia.playerColor,
        timeMinutes: clock.timeMinutes, incrementSeconds: clock.incrementSeconds, fen: null,
      });
      return;
    }
    startLocalGame();
  });

  $('btn-flip-board').addEventListener('click', () => {
    boardFlipped = !boardFlipped;
    fullRender();
  });

  $('btn-undo').addEventListener('click', () => {
    if (mode === 'online') return;
    if (undoStack.length === 0) return;
    if (mode === 'maia') {
      // Undo pair: bot's reply + my move, so it's my turn again
      let g = undoStack.pop();
      if (g.turn !== maia.playerColor && undoStack.length > 0) g = undoStack.pop();
      game = g;
    } else {
      game = undoStack.pop();
    }
    selectedSquare = null;
    legalMovesForSelected = [];
    maia.thinking = false;
    lastMove = game.history.length > 0
      ? { from: game.history[game.history.length - 1].from, to: game.history[game.history.length - 1].to }
      : null;
    fullRender();
  });

  $('btn-resign').addEventListener('click', async () => {
    if (game.isGameOver() || (mode === 'online' && online.lastResult)) return;
    if (mode === 'online') {
      if (!confirm('Resign this game?')) return;
      try {
        const r = await api(`/api/games/${online.code}/resign`, { body: { token: online.token } });
        online.lastResult = r.result;
        stopPolling(); stopClockTicking();
        fullRender();
      } catch (e) { alert(e.message); }
      return;
    }
    const resigner = mode === 'maia' ? maia.playerColor : game.turn;
    if (confirm(`${resigner === WHITE ? 'White' : 'Black'} resigns — confirm?`)) {
      game.resign(resigner);
      stopClockTicking();
      fullRender();
    }
  });

  $('btn-draw-agree').addEventListener('click', async () => {
    if (game.isGameOver() || (mode === 'online' && online.lastResult)) return;
    if (mode === 'online') {
      try {
        await api(`/api/games/${online.code}/draw`, { body: { token: online.token, action: 'offer' } });
        alert('Draw offer sent. Your opponent can accept or decline.');
      } catch (e) { alert(e.message); }
      return;
    }
    if (confirm('Both players agree to a draw — confirm?')) {
      game.offerDrawAgreement();
      stopClockTicking();
      fullRender();
    }
  });

  $('btn-draw-accept').addEventListener('click', async () => {
    try {
      const r = await api(`/api/games/${online.code}/draw`, { body: { token: online.token, action: 'accept' } });
      online.lastResult = r.result;
      drawOfferBannerEl.classList.add('hidden');
      stopPolling(); stopClockTicking();
      fullRender();
    } catch (e) { alert(e.message); }
  });

  $('btn-draw-decline').addEventListener('click', async () => {
    try {
      await api(`/api/games/${online.code}/draw`, { body: { token: online.token, action: 'decline' } });
      drawOfferBannerEl.classList.add('hidden');
    } catch (e) { alert(e.message); }
  });

  async function claimOnlineDraw(reason) {
    try {
      const r = await api(`/api/games/${online.code}/draw`, { body: { token: online.token, action: 'claim', reason } });
      online.lastResult = r.result;
      stopPolling(); stopClockTicking();
      fullRender();
    } catch (e) { alert(e.message); }
  }

  claimRepetitionBtn.addEventListener('click', () => {
    if (!game.canClaimThreefoldRepetition()) return;
    if (mode === 'online') { claimOnlineDraw('repetition'); return; }
    game.claimDraw('repetition');
    stopClockTicking();
    fullRender();
  });

  claimFiftyBtn.addEventListener('click', () => {
    if (!game.canClaimFiftyMoveRule()) return;
    if (mode === 'online') { claimOnlineDraw('fifty-move'); return; }
    game.claimDraw('fifty-move');
    stopClockTicking();
    fullRender();
  });

  $('btn-copy-link').addEventListener('click', () => {
    const url = `${location.origin}${location.pathname}?game=${online.code}`;
    navigator.clipboard.writeText(url).then(() => {
      $('btn-copy-link').textContent = 'Copied!';
      setTimeout(() => { $('btn-copy-link').textContent = 'Copy invite link'; }, 1500);
    }).catch(() => prompt('Copy this invite link:', url));
  });

  // ---------------------------------------------------------------------
  // Boot: auto-join if ?game=CODE is present
  // ---------------------------------------------------------------------
  (async function boot() {
    const params = new URLSearchParams(location.search);
    const code = (params.get('game') || '').trim().toUpperCase();
    if (code && code.length === 6) {
      try {
        await joinFriendGame(code);
        return;
      } catch (e) {
        alert('Could not join game ' + code + ': ' + e.message);
        try { history.replaceState(null, '', location.pathname); } catch (_) {}
      }
    }
    showMenu();
    fullRender();
  })();
})();
