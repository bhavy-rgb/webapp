import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

app.use('/static/*', serveStatic({ root: './public' }))

app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FIDE Chess — Full Rules Chess Game</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>♞</text></svg>">
  <link href="/static/style.css" rel="stylesheet">
</head>
<body>
  <div id="app-root">
    <header id="app-header">
      <h1 id="app-title"><span class="title-icon">♞</span> FIDE Chess</h1>
      <p id="app-subtitle">Full rules chess — plays exactly per the official FIDE Laws of Chess</p>
    </header>

    <main id="main-layout">
      <section id="board-section">
        <div id="turn-banner" class="turn-banner">
          <span id="turn-indicator-dot" class="turn-dot white"></span>
          <span id="turn-text">White to move</span>
        </div>

        <div id="board-wrapper">
          <div id="rank-labels" class="coord-labels ranks"></div>
          <div id="chess-board" role="grid" aria-label="Chess board"></div>
          <div id="file-labels" class="coord-labels files"></div>
        </div>

        <div id="status-banner" class="status-banner hidden"></div>

        <div id="controls">
          <button id="btn-new-game" class="btn btn-primary"><i class="fa-icon">&#8635;</i> New Game</button>
          <button id="btn-flip-board" class="btn">Flip Board</button>
          <button id="btn-undo" class="btn">Undo</button>
          <button id="btn-resign" class="btn btn-danger">Resign</button>
          <button id="btn-draw-agree" class="btn">Offer / Agree Draw</button>
        </div>
        <div id="claim-controls">
          <button id="btn-claim-repetition" class="btn btn-claim hidden">Claim Draw: Threefold Repetition</button>
          <button id="btn-claim-fifty" class="btn btn-claim hidden">Claim Draw: 50-Move Rule</button>
        </div>
      </section>

      <aside id="side-panel">
        <div class="panel-box" id="captured-box">
          <h2>Captured Pieces</h2>
          <div class="captured-row">
            <span class="captured-label">White captured:</span>
            <div id="captured-by-white" class="captured-pieces"></div>
          </div>
          <div class="captured-row">
            <span class="captured-label">Black captured:</span>
            <div id="captured-by-black" class="captured-pieces"></div>
          </div>
        </div>

        <div class="panel-box" id="history-box">
          <h2>Move History</h2>
          <ol id="move-list"></ol>
        </div>

        <div class="panel-box" id="rules-box">
          <h2>Rules Applied</h2>
          <ul id="rules-list">
            <li>Art.3 — legal moves per piece</li>
            <li>Art.3.7d — en passant</li>
            <li>Art.3.7e — pawn promotion</li>
            <li>Art.3.8b — castling rights &amp; safety</li>
            <li>Art.5.1a — checkmate</li>
            <li>Art.5.2a — stalemate</li>
            <li>Art.5.2b/9.6 — dead position</li>
            <li>Art.9.2 — threefold repetition (claimable)</li>
            <li>Art.9.3 — 50-move rule (claimable)</li>
          </ul>
        </div>
      </aside>
    </main>

    <div id="promotion-modal" class="modal hidden">
      <div class="modal-content">
        <h3>Promote pawn to:</h3>
        <div id="promotion-choices"></div>
      </div>
    </div>

    <footer id="app-footer">
      Implements the FIDE Laws of Chess (Articles 1–5, 9). For reference only — not an official FIDE product.
    </footer>
  </div>

  <script src="/static/chess-engine.js"></script>
  <script src="/static/app.js"></script>
</body>
</html>`)
})

export default app
