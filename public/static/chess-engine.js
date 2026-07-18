/*
 * FIDE Laws of Chess — Rules Engine
 * Implements Articles 1–5 and 9 of the FIDE Laws of Chess:
 *  - Article 2: initial position
 *  - Article 3: moves of the pieces (incl. castling 3.8, en passant 3.7d, promotion 3.7e)
 *  - Article 4: legality / move completion
 *  - Article 5: completion of the game (checkmate, stalemate, dead position)
 *  - Article 9: the drawn game (threefold repetition 9.2, 50-move rule 9.3, dead position 9.6)
 */

const WHITE = 'w';
const BLACK = 'b';

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function opponent(color) { return color === WHITE ? BLACK : WHITE; }

function inBounds(r, f) { return r >= 0 && r < 8 && f >= 0 && f < 8; }

// Square helpers: square index 0..63, rank 0 = rank1 (white back rank), file 0 = 'a'
function sq(rank, file) { return rank * 8 + file; }
function rankOf(square) { return Math.floor(square / 8); }
function fileOf(square) { return square % 8; }
function squareName(square) {
  return 'abcdefgh'[fileOf(square)] + (rankOf(square) + 1);
}
function nameToSquare(name) {
  const file = 'abcdefgh'.indexOf(name[0]);
  const rank = parseInt(name[1], 10) - 1;
  return sq(rank, file);
}

class ChessGame {
  constructor() {
    this.reset();
  }

  reset() {
    // board[square] = { type: 'p'|'n'|'b'|'r'|'q'|'k', color: 'w'|'b' } or null
    this.board = new Array(64).fill(null);
    this.setupInitialPosition();
    this.turn = WHITE;
    // Castling rights
    this.castling = { wK: true, wQ: true, bK: true, bQ: true };
    this.epSquare = null; // en passant target square (square that can be captured to)
    this.halfmoveClock = 0; // for 50-move rule (Article 9.3) - resets on pawn move or capture
    this.fullmoveNumber = 1;
    this.history = []; // list of move objects (for move list / algebraic notation)
    this.positionCounts = new Map(); // for threefold repetition (Article 9.2)
    this.status = 'playing'; // 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resigned'
    this.winner = null; // 'w' | 'b' | null
    this.drawReason = null;
    this.capturedPieces = { w: [], b: [] }; // pieces captured, keyed by color that was captured
    this.recordPosition();
  }

  setupInitialPosition() {
    const backRank = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    for (let f = 0; f < 8; f++) {
      this.board[sq(0, f)] = { type: backRank[f], color: WHITE };
      this.board[sq(1, f)] = { type: 'p', color: WHITE };
      this.board[sq(6, f)] = { type: 'p', color: BLACK };
      this.board[sq(7, f)] = { type: backRank[f], color: BLACK };
    }
  }

  clone() {
    const g = new ChessGame();
    g.board = this.board.map(p => p ? { ...p } : null);
    g.turn = this.turn;
    g.castling = { ...this.castling };
    g.epSquare = this.epSquare;
    g.halfmoveClock = this.halfmoveClock;
    g.fullmoveNumber = this.fullmoveNumber;
    g.history = [...this.history];
    g.positionCounts = new Map(this.positionCounts);
    g.status = this.status;
    g.winner = this.winner;
    g.drawReason = this.drawReason;
    g.capturedPieces = { w: [...this.capturedPieces.w], b: [...this.capturedPieces.b] };
    return g;
  }

  // ---------- Position key for repetition detection (Article 9.2) ----------
  // Must include: piece placement, side to move, castling rights, en passant possibility
  positionKey() {
    let key = this.board.map(p => p ? p.color + p.type : '-').join('');
    key += '|' + this.turn;
    key += '|' + (this.castling.wK ? 'K' : '') + (this.castling.wQ ? 'Q' : '') +
                 (this.castling.bK ? 'k' : '') + (this.castling.bQ ? 'q' : '');
    key += '|' + (this.epSquare !== null ? this.epSquare : '-');
    return key;
  }

  recordPosition() {
    const key = this.positionKey();
    this.positionCounts.set(key, (this.positionCounts.get(key) || 0) + 1);
  }

  repetitionCount() {
    return this.positionCounts.get(this.positionKey()) || 0;
  }

  // ---------- Attack detection ----------
  findKing(color, board = this.board) {
    for (let s = 0; s < 64; s++) {
      const p = board[s];
      if (p && p.type === 'k' && p.color === color) return s;
    }
    return -1;
  }

  // Is `square` attacked by any piece of `byColor`? (ignores king safety of mover)
  isSquareAttacked(square, byColor, board = this.board) {
    const r0 = rankOf(square), f0 = fileOf(square);

    // Pawn attacks
    const pawnDir = byColor === WHITE ? 1 : -1;
    for (const df of [-1, 1]) {
      const r = r0 - pawnDir, f = f0 + df;
      if (inBounds(r, f)) {
        const p = board[sq(r, f)];
        if (p && p.color === byColor && p.type === 'p') return true;
      }
    }
    // Knight attacks
    const knightDeltas = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
    for (const [dr, df] of knightDeltas) {
      const r = r0 + dr, f = f0 + df;
      if (inBounds(r, f)) {
        const p = board[sq(r, f)];
        if (p && p.color === byColor && p.type === 'n') return true;
      }
    }
    // King attacks (adjacent)
    for (let dr = -1; dr <= 1; dr++) {
      for (let df = -1; df <= 1; df++) {
        if (dr === 0 && df === 0) continue;
        const r = r0 + dr, f = f0 + df;
        if (inBounds(r, f)) {
          const p = board[sq(r, f)];
          if (p && p.color === byColor && p.type === 'k') return true;
        }
      }
    }
    // Sliding: bishop/queen diagonals
    const diagDirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [dr, df] of diagDirs) {
      let r = r0 + dr, f = f0 + df;
      while (inBounds(r, f)) {
        const p = board[sq(r, f)];
        if (p) {
          if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true;
          break;
        }
        r += dr; f += df;
      }
    }
    // Sliding: rook/queen straight lines
    const straightDirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dr, df] of straightDirs) {
      let r = r0 + dr, f = f0 + df;
      while (inBounds(r, f)) {
        const p = board[sq(r, f)];
        if (p) {
          if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true;
          break;
        }
        r += dr; f += df;
      }
    }
    return false;
  }

  isInCheck(color, board = this.board) {
    const kingSq = this.findKing(color, board);
    if (kingSq === -1) return false;
    return this.isSquareAttacked(kingSq, opponent(color), board);
  }

  // ---------- Pseudo-legal move generation (Article 3) ----------
  // Returns list of { from, to, piece, capture, promotion, isEnPassant, isCastle, castleSide }
  generatePseudoMoves(color, board = this.board, castling = this.castling, epSquare = this.epSquare) {
    const moves = [];
    for (let s = 0; s < 64; s++) {
      const p = board[s];
      if (!p || p.color !== color) continue;
      const r = rankOf(s), f = fileOf(s);

      if (p.type === 'p') {
        const dir = color === WHITE ? 1 : -1;
        const startRank = color === WHITE ? 1 : 6;
        const promoRank = color === WHITE ? 7 : 0;
        // forward one
        const oneR = r + dir;
        if (inBounds(oneR, f) && !board[sq(oneR, f)]) {
          this._addPawnMove(moves, s, sq(oneR, f), promoRank, oneR);
          // forward two from start
          if (r === startRank) {
            const twoR = r + 2 * dir;
            if (!board[sq(twoR, f)]) {
              moves.push({ from: s, to: sq(twoR, f), piece: 'p', capture: false, doublePush: true });
            }
          }
        }
        // captures diagonally (3.7c)
        for (const df of [-1, 1]) {
          const cr = r + dir, cf = f + df;
          if (inBounds(cr, cf)) {
            const target = board[sq(cr, cf)];
            if (target && target.color !== color) {
              this._addPawnMove(moves, s, sq(cr, cf), promoRank, cr, true);
            } else if (epSquare === sq(cr, cf)) {
              // en passant (3.7d)
              moves.push({ from: s, to: sq(cr, cf), piece: 'p', capture: true, isEnPassant: true });
            }
          }
        }
      } else if (p.type === 'n') {
        const knightDeltas = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
        for (const [dr, df] of knightDeltas) {
          const nr = r + dr, nf = f + df;
          if (inBounds(nr, nf)) {
            const target = board[sq(nr, nf)];
            if (!target || target.color !== color) {
              moves.push({ from: s, to: sq(nr, nf), piece: 'n', capture: !!target });
            }
          }
        }
      } else if (p.type === 'b' || p.type === 'r' || p.type === 'q') {
        const dirs = p.type === 'b'
          ? [[1,1],[1,-1],[-1,1],[-1,-1]]
          : p.type === 'r'
          ? [[1,0],[-1,0],[0,1],[0,-1]]
          : [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
        for (const [dr, df] of dirs) {
          let nr = r + dr, nf = f + df;
          while (inBounds(nr, nf)) {
            const target = board[sq(nr, nf)];
            if (!target) {
              moves.push({ from: s, to: sq(nr, nf), piece: p.type, capture: false });
            } else {
              if (target.color !== color) {
                moves.push({ from: s, to: sq(nr, nf), piece: p.type, capture: true });
              }
              break; // 3.5 cannot move over intervening pieces
            }
            nr += dr; nf += df;
          }
        }
      } else if (p.type === 'k') {
        for (let dr = -1; dr <= 1; dr++) {
          for (let df = -1; df <= 1; df++) {
            if (dr === 0 && df === 0) continue;
            const nr = r + dr, nf = f + df;
            if (inBounds(nr, nf)) {
              const target = board[sq(nr, nf)];
              if (!target || target.color !== color) {
                moves.push({ from: s, to: sq(nr, nf), piece: 'k', capture: !!target });
              }
            }
          }
        }
        // Castling (Article 3.8b)
        this._addCastlingMoves(moves, s, color, board, castling);
      }
    }
    return moves;
  }

  _addPawnMove(moves, from, to, promoRank, destRank, capture = false) {
    if (destRank === promoRank) {
      for (const promo of ['q', 'r', 'b', 'n']) {
        moves.push({ from, to, piece: 'p', capture, promotion: promo });
      }
    } else {
      moves.push({ from, to, piece: 'p', capture });
    }
  }

  _addCastlingMoves(moves, kingSq, color, board, castling) {
    const rank = color === WHITE ? 0 : 7;
    if (kingSq !== sq(rank, 4)) return; // king must be on original square
    const oppColor = opponent(color);

    // King-side (short) castling
    const canK = color === WHITE ? castling.wK : castling.bK;
    if (canK) {
      const rookSq = sq(rank, 7);
      const rook = board[rookSq];
      if (rook && rook.type === 'r' && rook.color === color &&
          !board[sq(rank, 5)] && !board[sq(rank, 6)]) {
        // King's square, crossed square, and destination must not be attacked (3.8b)
        if (!this.isSquareAttacked(sq(rank, 4), oppColor, board) &&
            !this.isSquareAttacked(sq(rank, 5), oppColor, board) &&
            !this.isSquareAttacked(sq(rank, 6), oppColor, board)) {
          moves.push({ from: kingSq, to: sq(rank, 6), piece: 'k', capture: false, isCastle: true, castleSide: 'K' });
        }
      }
    }
    // Queen-side (long) castling
    const canQ = color === WHITE ? castling.wQ : castling.bQ;
    if (canQ) {
      const rookSq = sq(rank, 0);
      const rook = board[rookSq];
      if (rook && rook.type === 'r' && rook.color === color &&
          !board[sq(rank, 1)] && !board[sq(rank, 2)] && !board[sq(rank, 3)]) {
        if (!this.isSquareAttacked(sq(rank, 4), oppColor, board) &&
            !this.isSquareAttacked(sq(rank, 3), oppColor, board) &&
            !this.isSquareAttacked(sq(rank, 2), oppColor, board)) {
          moves.push({ from: kingSq, to: sq(rank, 2), piece: 'k', capture: false, isCastle: true, castleSide: 'Q' });
        }
      }
    }
  }

  // Apply a move to a board copy, returns new board + updated castling/ep (does not mutate game state)
  _simulateMove(move, board, castling, epSquare) {
    const newBoard = board.map(p => p ? { ...p } : null);
    const newCastling = { ...castling };
    let newEp = null;
    const piece = newBoard[move.from];

    if (move.isEnPassant) {
      const dir = piece.color === WHITE ? -1 : 1;
      const capturedPawnSq = sq(rankOf(move.to) + dir, fileOf(move.to));
      newBoard[capturedPawnSq] = null;
    }

    newBoard[move.to] = move.promotion ? { type: move.promotion, color: piece.color } : piece;
    newBoard[move.from] = null;

    if (move.isCastle) {
      const rank = rankOf(move.from);
      if (move.castleSide === 'K') {
        newBoard[sq(rank, 5)] = newBoard[sq(rank, 7)];
        newBoard[sq(rank, 7)] = null;
      } else {
        newBoard[sq(rank, 3)] = newBoard[sq(rank, 0)];
        newBoard[sq(rank, 0)] = null;
      }
    }

    // Update castling rights: moving king or rook, or rook captured
    if (piece.type === 'k') {
      if (piece.color === WHITE) { newCastling.wK = false; newCastling.wQ = false; }
      else { newCastling.bK = false; newCastling.bQ = false; }
    }
    if (piece.type === 'r') {
      if (move.from === sq(0, 0)) newCastling.wQ = false;
      if (move.from === sq(0, 7)) newCastling.wK = false;
      if (move.from === sq(7, 0)) newCastling.bQ = false;
      if (move.from === sq(7, 7)) newCastling.bK = false;
    }
    if (move.to === sq(0, 0)) newCastling.wQ = false;
    if (move.to === sq(0, 7)) newCastling.wK = false;
    if (move.to === sq(7, 0)) newCastling.bQ = false;
    if (move.to === sq(7, 7)) newCastling.bK = false;

    // Set new en passant target if double pawn push
    if (move.doublePush) {
      const dir = piece.color === WHITE ? 1 : -1;
      newEp = sq(rankOf(move.from) + dir, fileOf(move.from));
    }

    return { board: newBoard, castling: newCastling, epSquare: newEp };
  }

  // ---------- Legal move generation ----------
  // A move is legal only if, after making it, the mover's own king is not left in check.
  generateLegalMoves(color) {
    const pseudo = this.generatePseudoMoves(color, this.board, this.castling, this.epSquare);
    const legal = [];
    for (const move of pseudo) {
      const { board: nb } = this._simulateMove(move, this.board, this.castling, this.epSquare);
      if (!this.isInCheck(color, nb)) legal.push(move);
    }
    return legal;
  }

  getLegalMovesFrom(square) {
    const piece = this.board[square];
    if (!piece || piece.color !== this.turn) return [];
    return this.generateLegalMoves(this.turn).filter(m => m.from === square);
  }

  // ---------- Move execution ----------
  makeMove(move) {
    if (this.status !== 'playing') return { ok: false, reason: 'Game is over' };
    const legal = this.generateLegalMoves(this.turn);
    const match = legal.find(m => m.from === move.from && m.to === move.to &&
      (m.promotion || null) === (move.promotion || null));
    if (!match) return { ok: false, reason: 'Illegal move' };

    const piece = this.board[match.from];
    const capturedPiece = match.isEnPassant
      ? this.board[sq(rankOf(match.to) + (piece.color === WHITE ? -1 : 1), fileOf(match.to))]
      : this.board[match.to];

    const { board, castling, epSquare } = this._simulateMove(match, this.board, this.castling, this.epSquare);
    this.board = board;
    this.castling = castling;
    this.epSquare = epSquare;

    if (capturedPiece) this.capturedPieces[capturedPiece.color].push(capturedPiece.type);

    // 50-move rule counter (Article 9.3): reset on pawn move or capture
    if (piece.type === 'p' || match.capture) this.halfmoveClock = 0;
    else this.halfmoveClock++;

    const moveColor = this.turn;
    this.turn = opponent(this.turn);
    if (moveColor === BLACK) this.fullmoveNumber++;

    this.recordPosition();

    const record = {
      ...match,
      color: moveColor,
      san: null, // filled below
      capturedType: capturedPiece ? capturedPiece.type : null,
    };
    record.san = this._toSAN(match, moveColor, capturedPiece);
    this.history.push(record);

    this._updateGameStatus();

    return { ok: true, move: record };
  }

  _toSAN(move, color, capturedPiece) {
    if (move.isCastle) return move.castleSide === 'K' ? 'O-O' : 'O-O-O';
    const pieceLetters = { p: '', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };
    let san = '';
    const capture = move.capture;
    if (move.piece === 'p') {
      if (capture) san += 'abcdefgh'[fileOf(move.from)] + 'x';
      san += squareName(move.to);
      if (move.promotion) san += '=' + move.promotion.toUpperCase();
    } else {
      san += pieceLetters[move.piece];
      // (disambiguation omitted for simplicity; UI shows from-to too)
      if (capture) san += 'x';
      san += squareName(move.to);
    }
    // Check/checkmate suffix determined after status update by caller if needed
    return san;
  }

  _updateGameStatus() {
    const color = this.turn; // player to move now
    const legalMoves = this.generateLegalMoves(color);
    const inCheck = this.isInCheck(color);

    // Append + or # to the last move's SAN
    if (this.history.length > 0) {
      const last = this.history[this.history.length - 1];
      if (legalMoves.length === 0 && inCheck) last.san += '#';
      else if (inCheck) last.san += '+';
    }

    if (legalMoves.length === 0) {
      if (inCheck) {
        // Checkmate (Article 5.1a / 5.2a)
        this.status = 'checkmate';
        this.winner = opponent(color);
      } else {
        // Stalemate (Article 5.2a)
        this.status = 'stalemate';
        this.winner = null;
        this.drawReason = 'Stalemate';
      }
      return;
    }

    // Dead position / insufficient material (Article 5.2b, 9.6)
    if (this._isDeadPosition()) {
      this.status = 'draw';
      this.winner = null;
      this.drawReason = 'Dead position (insufficient material)';
      return;
    }

    // Automatic draw is NOT applied for threefold repetition / 50-move —
    // per Article 9.2/9.3 these must be CLAIMED by a player. UI exposes claim buttons.
  }

  // Article 5.2b / 9.6: dead position — neither side can checkmate by any sequence of legal moves.
  _isDeadPosition() {
    const pieces = this.board.filter(p => p);
    const nonKings = pieces.filter(p => p.type !== 'k');
    if (nonKings.length === 0) return true; // K vs K
    if (nonKings.length === 1 && (nonKings[0].type === 'n' || nonKings[0].type === 'b')) {
      return true; // K+N vs K, or K+B vs K
    }
    if (nonKings.length === 2 && nonKings.every(p => p.type === 'b')) {
      // K+B vs K+B with bishops on same color squares -> dead position
      const bishops = [];
      for (let s = 0; s < 64; s++) {
        const p = this.board[s];
        if (p && p.type === 'b') bishops.push(s);
      }
      if (bishops.length === 2) {
        const colorOf = s => (rankOf(s) + fileOf(s)) % 2;
        if (colorOf(bishops[0]) === colorOf(bishops[1]) && this.board[bishops[0]].color !== this.board[bishops[1]].color) {
          return true;
        }
      }
    }
    return false;
  }

  // ---------- Draw claims (player-initiated, Article 9.2 / 9.3) ----------
  canClaimThreefoldRepetition() {
    return this.repetitionCount() >= 3;
  }

  canClaimFiftyMoveRule() {
    return this.halfmoveClock >= 100; // 100 half-moves = 50 full moves by each player
  }

  claimDraw(reason) {
    if (reason === 'repetition' && this.canClaimThreefoldRepetition()) {
      this.status = 'draw';
      this.drawReason = 'Threefold repetition (Article 9.2)';
      this.winner = null;
      return true;
    }
    if (reason === 'fifty-move' && this.canClaimFiftyMoveRule()) {
      this.status = 'draw';
      this.drawReason = '50-move rule (Article 9.3)';
      this.winner = null;
      return true;
    }
    return false;
  }

  resign(color) {
    if (this.status !== 'playing') return false;
    this.status = 'resigned';
    this.winner = opponent(color);
    this.drawReason = null;
    return true;
  }

  offerDrawAgreement() {
    if (this.status !== 'playing') return false;
    this.status = 'draw';
    this.drawReason = 'Agreement between players (Article 5.2c)';
    this.winner = null;
    return true;
  }

  isGameOver() {
    return this.status !== 'playing';
  }
}

// Export for browser (attach to window) and for potential module use
if (typeof window !== 'undefined') {
  window.ChessGame = ChessGame;
  window.ChessUtils = { squareName, nameToSquare, sq, rankOf, fileOf, WHITE, BLACK, PIECE_VALUES };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChessGame, squareName, nameToSquare, sq, rankOf, fileOf, WHITE, BLACK };
}
