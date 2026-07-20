/*
 * Maia-style human-like chess bot.
 *
 * Inspired by Maia Chess (https://github.com/CSSLab/maia-chess), which trains
 * neural networks to predict *human* moves at specific rating levels (1100-1900)
 * rather than the objectively best move.
 *
 * The real Maia networks require lc0 (Leela Chess Zero) inference and cannot run
 * on Cloudflare Pages / plain browsers. This module reproduces Maia's defining
 * behaviour - "play the move a human of rating X would most likely play" - with
 * a classical evaluation + probability-weighted (softmax) move choice whose
 * sharpness, search depth and blunder rate are calibrated per rating level.
 *
 * Levels mirror the Maia lineup: 600, 900, 1100, 1300, 1500, 1700, 1900.
 */
(function () {
  const PST_PAWN = [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10,-20,-20, 10, 10,  5,
     5, -5,-10,  0,  0,-10, -5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5,  5, 10, 25, 25, 10,  5,  5,
    10, 10, 20, 30, 30, 20, 10, 10,
    50, 50, 50, 50, 50, 50, 50, 50,
     0,  0,  0,  0,  0,  0,  0,  0
  ];
  const PST_KNIGHT = [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50
  ];
  const PST_BISHOP = [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -20,-10,-10,-10,-10,-10,-10,-20
  ];
  const PST_ROOK = [
     0,  0,  0,  5,  5,  0,  0,  0,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     5, 10, 10, 10, 10, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
  ];
  const PST_QUEEN = [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -10,  5,  5,  5,  5,  5,  0,-10,
     0,  0,  5,  5,  5,  5,  0, -5,
    -5,  0,  5,  5,  5,  5,  0, -5,
   -10,  0,  5,  5,  5,  5,  0,-10,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20
  ];
  const PST_KING_MID = [
    20, 30, 10,  0,  0, 10, 30, 20,
    20, 20,  0,  0,  0,  0, 20, 20,
   -10,-20,-20,-20,-20,-20,-20,-10,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30
  ];
  const PST_KING_END = [
   -50,-30,-30,-30,-30,-30,-30,-50,
   -30,-30,  0,  0,  0,  0,-30,-30,
   -30,-10, 20, 30, 30, 20,-10,-30,
   -30,-10, 30, 40, 40, 30,-10,-30,
   -30,-10, 30, 40, 40, 30,-10,-30,
   -30,-10, 20, 30, 30, 20,-10,-30,
   -30,-20,-10,  0,  0,-10,-20,-30,
   -50,-40,-30,-20,-20,-30,-40,-50
  ];
  const PST = { p: PST_PAWN, n: PST_KNIGHT, b: PST_BISHOP, r: PST_ROOK, q: PST_QUEEN };
  const MAT = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

  // Rating-level calibration. Lower ratings: shallower search, flatter (more
  // random) move distribution, higher blunder chance - just like weaker humans.
  const LEVELS = {
    600:  { depth: 1, temperature: 130, blunderChance: 0.22, topWindow: 400 },
    900:  { depth: 1, temperature: 95,  blunderChance: 0.14, topWindow: 320 },
    1100: { depth: 2, temperature: 75,  blunderChance: 0.10, topWindow: 260 },
    1300: { depth: 2, temperature: 55,  blunderChance: 0.06, topWindow: 200 },
    1500: { depth: 3, temperature: 40,  blunderChance: 0.035,topWindow: 150 },
    1700: { depth: 3, temperature: 26,  blunderChance: 0.02, topWindow: 110 },
    1900: { depth: 4, temperature: 15,  blunderChance: 0.008,topWindow: 80  },
  };

  function evaluate(game, board) {
    // Positive = good for white (centipawns)
    let score = 0;
    let phase = 0; // count non-pawn material to detect endgame
    for (let s = 0; s < 64; s++) {
      const p = board[s];
      if (!p) continue;
      if (p.type !== 'p' && p.type !== 'k') phase += MAT[p.type];
    }
    const endgame = phase < 1600;
    for (let s = 0; s < 64; s++) {
      const p = board[s];
      if (!p) continue;
      const idx = p.color === 'w' ? s : (63 - s);
      let val = MAT[p.type];
      if (p.type === 'k') val += (endgame ? PST_KING_END : PST_KING_MID)[idx];
      else val += PST[p.type][idx];
      score += p.color === 'w' ? val : -val;
    }
    return score;
  }

  // Negamax alpha-beta on cloned engine states.
  function search(game, depth, alpha, beta, color) {
    const moves = game.generateLegalMoves(color);
    if (moves.length === 0) {
      if (game.isInCheck(color)) return -100000 - depth; // mated (prefer later mates)
      return 0; // stalemate
    }
    if (depth === 0) return (color === 'w' ? 1 : -1) * evaluate(game, game.board);

    // Move ordering: captures first
    moves.sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));

    let best = -Infinity;
    for (const move of moves) {
      const { board, castling, epSquare } = game._simulateMove(move, game.board, game.castling, game.epSquare);
      const child = Object.create(Object.getPrototypeOf(game));
      Object.assign(child, game);
      child.board = board; child.castling = castling; child.epSquare = epSquare;
      const score = -search(child, depth - 1, -beta, -alpha, color === 'w' ? 'b' : 'w');
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function scoreMoves(game, color, depth) {
    const moves = game.generateLegalMoves(color);
    const scored = [];
    for (const move of moves) {
      const { board, castling, epSquare } = game._simulateMove(move, game.board, game.castling, game.epSquare);
      const child = Object.create(Object.getPrototypeOf(game));
      Object.assign(child, game);
      child.board = board; child.castling = castling; child.epSquare = epSquare;
      const score = -search(child, depth - 1, -Infinity, Infinity, color === 'w' ? 'b' : 'w');
      scored.push({ move, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  // Softmax pick: humans don't always play the top engine move.
  function humanPick(scored, level) {
    if (scored.length === 0) return null;
    if (scored.length === 1) return scored[0].move;

    // Occasional outright blunder: pick from the weaker half of the move list.
    if (Math.random() < level.blunderChance && scored.length > 2) {
      const weakHalf = scored.slice(Math.floor(scored.length / 2));
      return weakHalf[Math.floor(Math.random() * weakHalf.length)].move;
    }

    // Only consider moves within `topWindow` centipawns of the best (humans
    // discard obviously losing moves), then softmax-sample by temperature.
    const best = scored[0].score;
    const candidates = scored.filter(s => best - s.score <= level.topWindow);
    const weights = candidates.map(s => Math.exp((s.score - best) / level.temperature));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i].move;
    }
    return candidates[candidates.length - 1].move;
  }

  /**
   * Choose the move a "Maia <rating>" player would make in the given position.
   * @param {ChessGame} game  live game instance (not mutated)
   * @param {number} rating   one of 600,900,1100,1300,1500,1700,1900
   * @returns {{from,to,promotion?}|null}
   */
  function chooseMove(game, rating) {
    const level = LEVELS[rating] || LEVELS[1100];
    const scored = scoreMoves(game, game.turn, level.depth);
    const move = humanPick(scored, level);
    if (!move) return null;
    return { from: move.from, to: move.to, promotion: move.promotion || undefined };
  }

  /** Human-like thinking delay (ms) for the given rating & mode. */
  function thinkTime(rating, mode) {
    if (mode === 'instant') return 80;
    // Weaker players move faster on average; add natural variance.
    const base = 600 + (rating - 600) * 0.9;
    return Math.round(base + Math.random() * base);
  }

  window.MaiaBot = { chooseMove, thinkTime, LEVELS: Object.keys(LEVELS).map(Number) };
})();
