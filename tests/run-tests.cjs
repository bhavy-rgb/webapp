// Test runner for the chess engine (Article 1-5, 9 compliance).
// The engine file public/static/chess-engine.js is plain browser JS; since this
// project's package.json has "type":"module", we copy it to a temp .cjs file
// so Node's CommonJS `require()` can load it directly for testing.
const fs = require('fs');
const path = require('path');
const os = require('os');

const enginePath = path.join(__dirname, '..', 'public', 'static', 'chess-engine.js');
const tmpPath = path.join(os.tmpdir(), 'chess-engine-test.cjs');
fs.copyFileSync(enginePath, tmpPath);

const { ChessGame, nameToSquare, squareName } = require(tmpPath);

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); failed++; }
  else { console.log('PASS:', msg); passed++; }
}

function mv(g, from, to, promotion) {
  return g.makeMove({ from: nameToSquare(from), to: nameToSquare(to), promotion });
}

// ===== Test: Castling (kingside + queenside) =====
(function testCastling() {
  let g = new ChessGame();
  const seq = [
    ['e2','e4'], ['e7','e5'],
    ['g1','f3'], ['g8','f6'],
    ['f1','c4'], ['f8','c5'],
  ];
  for (const [f,t] of seq) assert(mv(g,f,t).ok, `castling-setup ${f}-${t}`);
  const r1 = mv(g, 'e1', 'g1'); // white king-side castle
  assert(r1.ok && r1.move.isCastle && r1.move.castleSide === 'K', 'White can castle king-side');
  assert(g.board[nameToSquare('g1')].type === 'k', 'King on g1 after O-O');
  assert(g.board[nameToSquare('f1')].type === 'r', 'Rook on f1 after O-O');
  const r2 = mv(g, 'e8', 'g8'); // black king-side castle
  assert(r2.ok && r2.move.isCastle, 'Black can castle king-side');

  let g3 = new ChessGame();
  const seq3 = [
    ['d2','d4'], ['d7','d5'],
    ['b1','c3'], ['b8','c6'],
    ['c1','f4'], ['c8','f5'],
    ['d1','d3'], ['d8','d6'],
  ];
  for (const [f,t] of seq3) assert(mv(g3,f,t).ok, `qcastling-setup ${f}-${t}`);
  const r3 = mv(g3, 'e1', 'c1');
  assert(r3.ok && r3.move.isCastle && r3.move.castleSide === 'Q', 'White can castle queen-side');
  assert(g3.board[nameToSquare('c1')].type === 'k', 'King on c1 after O-O-O');
  assert(g3.board[nameToSquare('d1')].type === 'r', 'Rook on d1 after O-O-O');
})();

// ===== Test: Castling forbidden after rook moves =====
(function testCastlingForbiddenAfterRookMove() {
  let g2 = new ChessGame();
  const seq2 = [['g1','f3'],['g8','f6'],['g2','g3'],['g7','g6'],['f1','g2'],['f8','g7'],['h1','f1']];
  for (const [f,t] of seq2) assert(mv(g2,f,t).ok, `rook-move-setup ${f}-${t}`);
  const legalKingMoves = g2.getLegalMovesFrom(nameToSquare('e1'));
  assert(!legalKingMoves.some(m => m.isCastle), 'Castling king-side forbidden after rook h1 moved');
})();

// ===== Test: En Passant =====
(function testEnPassant() {
  let g = new ChessGame();
  const seq = [
    ['e2','e4'], ['a7','a6'],
    ['e4','e5'], ['d7','d5'],
  ];
  for (const [f,t] of seq) assert(mv(g,f,t).ok, `ep-setup ${f}-${t}`);
  const epMoves = g.getLegalMovesFrom(nameToSquare('e5'));
  const epMove = epMoves.find(m => m.isEnPassant);
  assert(!!epMove, 'En passant capture available for white pawn e5xd6');
  const r = mv(g, 'e5', 'd6');
  assert(r.ok, 'En passant move executes');
  assert(g.board[nameToSquare('d5')] === null, 'Captured black pawn removed from d5');
  assert(g.board[nameToSquare('d6')].type === 'p' && g.board[nameToSquare('d6')].color === 'w', 'White pawn now on d6');
})();

// ===== Test: En passant expires after intervening move =====
(function testEnPassantExpiry() {
  let g = new ChessGame();
  const seq = [
    ['e2','e4'], ['a7','a6'],
    ['e4','e5'], ['d7','d5'],
    ['a2','a3'],
    ['a6','a5'],
  ];
  for (const [f,t] of seq) assert(mv(g,f,t).ok, `ep-expiry-setup ${f}-${t}`);
  const epMoves = g.getLegalMovesFrom(nameToSquare('e5'));
  assert(!epMoves.some(m => m.isEnPassant), 'En passant right expired after intervening move');
})();

// ===== Test: Pawn promotion =====
(function testPromotion() {
  let g = new ChessGame();
  g.board = new Array(64).fill(null);
  g.board[nameToSquare('a7')] = { type: 'p', color: 'w' };
  g.board[nameToSquare('a1')] = { type: 'k', color: 'w' };
  g.board[nameToSquare('h8')] = { type: 'k', color: 'b' };
  g.turn = 'w';
  g.castling = { wK:false, wQ:false, bK:false, bQ:false };
  const moves = g.getLegalMovesFrom(nameToSquare('a7'));
  assert(moves.length === 4, 'Pawn promotion offers 4 choices (Q,R,B,N)');
  const r = mv(g, 'a7', 'a8', 'q');
  assert(r.ok, 'Promotion move to queen executes');
  assert(g.board[nameToSquare('a8')].type === 'q', 'Pawn promoted to queen on a8');
})();

// ===== Test: Stalemate detection =====
(function testStalemate() {
  let g = new ChessGame();
  g.board = new Array(64).fill(null);
  g.board[nameToSquare('a1')] = { type: 'k', color: 'w' };
  g.board[nameToSquare('c2')] = { type: 'k', color: 'b' };
  g.board[nameToSquare('b3')] = { type: 'q', color: 'b' };
  g.turn = 'w';
  g.castling = { wK:false, wQ:false, bK:false, bQ:false };
  const inCheck = g.isInCheck('w');
  const legal = g.generateLegalMoves('w');
  assert(!inCheck, 'King not in check in stalemate position');
  assert(legal.length === 0, 'White has no legal moves in stalemate position (found ' + legal.length + ')');
})();

// ===== Test: Insufficient material / dead position =====
(function testDeadPosition() {
  let g = new ChessGame();
  g.board = new Array(64).fill(null);
  g.board[nameToSquare('a1')] = { type: 'k', color: 'w' };
  g.board[nameToSquare('h8')] = { type: 'k', color: 'b' };
  assert(g._isDeadPosition(), 'K vs K is dead position');
  g.board[nameToSquare('b1')] = { type: 'n', color: 'w' };
  assert(g._isDeadPosition(), 'K+N vs K is dead position');
})();

// ===== Test: Fifty-move rule claimability =====
(function testFiftyMove() {
  let g = new ChessGame();
  g.halfmoveClock = 100;
  assert(g.canClaimFiftyMoveRule(), '50-move rule claimable at halfmoveClock=100');
  const claimed = g.claimDraw('fifty-move');
  assert(claimed && g.status === 'draw', '50-move rule claim results in draw');
})();

// ===== Test: Threefold repetition detection =====
(function testThreefold() {
  let g = new ChessGame();
  const seq = [
    ['g1','f3'], ['g8','f6'],
    ['f3','g1'], ['f6','g8'],
    ['g1','f3'], ['g8','f6'],
    ['f3','g1'], ['f6','g8'],
  ];
  for (const [f,t] of seq) assert(mv(g,f,t).ok, `repetition-setup ${f}-${t}`);
  assert(g.canClaimThreefoldRepetition(), 'Threefold repetition claimable after knight shuffle');
})();

// ===== Test: Cannot move into / stay in check =====
(function testCannotMoveIntoCheck() {
  let g = new ChessGame();
  g.board = new Array(64).fill(null);
  g.board[nameToSquare('e1')] = { type: 'k', color: 'w' };
  g.board[nameToSquare('e8')] = { type: 'r', color: 'b' };
  g.board[nameToSquare('a1')] = { type: 'k', color: 'b' };
  g.turn = 'w';
  g.castling = { wK:false, wQ:false, bK:false, bQ:false };
  const legal = g.getLegalMovesFrom(nameToSquare('e1'));
  assert(!legal.some(m => squareName(m.to) === 'e2'), 'King cannot move to e2 (still in check from rook on e-file)');
  assert(legal.some(m => squareName(m.to) === 'd2' || squareName(m.to) === 'f2'), 'King can move sideways out of check');
})();

// ===== Test: Pinned piece restricted to pin line =====
(function testPinnedPiece() {
  let g = new ChessGame();
  g.board = new Array(64).fill(null);
  g.board[nameToSquare('e1')] = { type: 'k', color: 'w' };
  g.board[nameToSquare('e8')] = { type: 'r', color: 'b' };
  g.board[nameToSquare('e2')] = { type: 'r', color: 'w' };
  g.board[nameToSquare('a8')] = { type: 'k', color: 'b' };
  g.turn = 'w';
  g.castling = { wK:false, wQ:false, bK:false, bQ:false };
  const legal = g.getLegalMovesFrom(nameToSquare('e2'));
  const allOnEFile = legal.every(m => squareName(m.to)[0] === 'e');
  assert(legal.length > 0 && allOnEFile, 'Pinned rook can only move along the e-file, got: ' + legal.map(m=>squareName(m.to)).join(','));
})();

// ===== Test: Fool's Mate full checkmate sequence =====
(function testFoolsMate() {
  let g = new ChessGame();
  const seq = [['f2','f3'], ['e7','e5'], ['g2','g4'], ['d8','h4']];
  for (const [f,t] of seq) assert(mv(g,f,t).ok, `foolsmate ${f}-${t}`);
  assert(g.status === 'checkmate', 'Fools mate results in checkmate');
  assert(g.winner === 'b', 'Black wins fools mate');
  assert(g.history[g.history.length-1].san === 'Qh4#', 'Final move SAN is Qh4# (' + g.history[g.history.length-1].san + ')');
})();

fs.unlinkSync(tmpPath);
console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
