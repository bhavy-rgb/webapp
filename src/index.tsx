import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/static/*', serveStatic({ root: './public' }))

// ---------------------------------------------------------------------------
// Online friend-game API (D1-backed)
// ---------------------------------------------------------------------------

function randomCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function randomToken() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

type GameRow = {
  id: number; code: string; white_token: string | null; black_token: string | null;
  creator_color: string; moves: string; status: string; result: string | null;
  time_minutes: number; increment_seconds: number;
  white_ms: number | null; black_ms: number | null; last_move_at: number | null;
  draw_offer: string | null;
}

async function getGame(db: D1Database, code: string): Promise<GameRow | null> {
  return await db.prepare('SELECT * FROM games WHERE code = ?').bind(code.toUpperCase()).first<GameRow>()
}

function playerColor(g: GameRow, token: string): 'w' | 'b' | null {
  if (token && g.white_token === token) return 'w'
  if (token && g.black_token === token) return 'b'
  return null
}

// Compute live clocks; returns { whiteMs, blackMs, flagged: 'w'|'b'|null }
function liveClocks(g: GameRow, now: number) {
  if (!g.time_minutes) return { whiteMs: null, blackMs: null, flagged: null as string | null }
  let whiteMs = g.white_ms ?? g.time_minutes * 60000
  let blackMs = g.black_ms ?? g.time_minutes * 60000
  const moves = JSON.parse(g.moves) as unknown[]
  const turn = moves.length % 2 === 0 ? 'w' : 'b'
  if (g.status === 'active' && g.last_move_at) {
    const elapsed = now - g.last_move_at
    if (turn === 'w') whiteMs -= elapsed
    else blackMs -= elapsed
  }
  let flagged: string | null = null
  if (whiteMs <= 0) { whiteMs = 0; flagged = 'w' }
  if (blackMs <= 0) { blackMs = 0; flagged = 'b' }
  return { whiteMs, blackMs, flagged }
}

// Create a game
app.post('/api/games', async (c) => {
  const body = await c.req.json().catch(() => ({})) as any
  let color: string = body.color === 'b' ? 'b' : body.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : 'w'
  const timeMinutes = Math.max(0, Math.min(180, parseInt(body.timeMinutes) || 0))
  const incrementSeconds = Math.max(0, Math.min(60, parseInt(body.incrementSeconds) || 0))
  const token = randomToken()

  let code = randomCode()
  for (let i = 0; i < 5; i++) {
    const existing = await getGame(c.env.DB, code)
    if (!existing) break
    code = randomCode()
  }

  const initialMs = timeMinutes ? timeMinutes * 60000 : null
  await c.env.DB.prepare(
    `INSERT INTO games (code, white_token, black_token, creator_color, time_minutes, increment_seconds, white_ms, black_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    code,
    color === 'w' ? token : null,
    color === 'b' ? token : null,
    color, timeMinutes, incrementSeconds, initialMs, initialMs
  ).run()

  return c.json({ code, token, color, timeMinutes, incrementSeconds })
})

// Join a game
app.post('/api/games/:code/join', async (c) => {
  const g = await getGame(c.env.DB, c.req.param('code'))
  if (!g) return c.json({ error: 'Game not found' }, 404)
  if (g.status === 'finished') return c.json({ error: 'Game already finished' }, 400)
  if (g.white_token && g.black_token) return c.json({ error: 'Game is full' }, 400)
  const token = randomToken()
  const color = g.white_token ? 'b' : 'w'
  const col = color === 'w' ? 'white_token' : 'black_token'
  await c.env.DB.prepare(
    `UPDATE games SET ${col} = ?, status = 'active', last_move_at = ? WHERE id = ? AND ${col} IS NULL`
  ).bind(token, Date.now(), g.id).run()
  return c.json({ code: g.code, token, color, timeMinutes: g.time_minutes, incrementSeconds: g.increment_seconds })
})

// Poll game state
app.get('/api/games/:code/state', async (c) => {
  const g = await getGame(c.env.DB, c.req.param('code'))
  if (!g) return c.json({ error: 'Game not found' }, 404)
  const now = Date.now()
  const { whiteMs, blackMs, flagged } = liveClocks(g, now)
  // Flag fall ends the game server-side
  if (flagged && g.status === 'active') {
    const winner = flagged === 'w' ? 'b' : 'w'
    await c.env.DB.prepare(
      `UPDATE games SET status='finished', result=?, white_ms=?, black_ms=? WHERE id=? AND status='active'`
    ).bind(`timeout:${winner}`, whiteMs, blackMs, g.id).run()
    g.status = 'finished'
    g.result = `timeout:${winner}`
  }
  return c.json({
    code: g.code,
    status: g.status,
    result: g.result,
    moves: JSON.parse(g.moves),
    creatorColor: g.creator_color,
    whiteJoined: !!g.white_token,
    blackJoined: !!g.black_token,
    timeMinutes: g.time_minutes,
    incrementSeconds: g.increment_seconds,
    whiteMs, blackMs,
    drawOffer: g.draw_offer,
  })
})

// Make a move
app.post('/api/games/:code/move', async (c) => {
  const body = await c.req.json().catch(() => ({})) as any
  const g = await getGame(c.env.DB, c.req.param('code'))
  if (!g) return c.json({ error: 'Game not found' }, 404)
  const color = playerColor(g, body.token)
  if (!color) return c.json({ error: 'Not a player in this game' }, 403)
  if (g.status !== 'active') return c.json({ error: 'Game is not active' }, 400)

  const moves = JSON.parse(g.moves) as any[]
  const turn = moves.length % 2 === 0 ? 'w' : 'b'
  if (turn !== color) return c.json({ error: 'Not your turn' }, 400)
  if (typeof body.moveIndex === 'number' && body.moveIndex !== moves.length) {
    return c.json({ error: 'Out of sync', moves }, 409)
  }
  const mv = body.move
  if (!mv || typeof mv.from !== 'number' || typeof mv.to !== 'number' ||
      mv.from < 0 || mv.from > 63 || mv.to < 0 || mv.to > 63) {
    return c.json({ error: 'Invalid move format' }, 400)
  }

  const now = Date.now()
  const { whiteMs, blackMs, flagged } = liveClocks(g, now)
  if (flagged) {
    const winner = flagged === 'w' ? 'b' : 'w'
    await c.env.DB.prepare(
      `UPDATE games SET status='finished', result=?, white_ms=?, black_ms=? WHERE id=? AND status='active'`
    ).bind(`timeout:${winner}`, whiteMs, blackMs, g.id).run()
    return c.json({ error: 'Flag fell', result: `timeout:${winner}` }, 400)
  }

  moves.push({ from: mv.from, to: mv.to, promotion: mv.promotion || null })

  // Apply increment to the mover, stamp move time
  let newWhite = whiteMs, newBlack = blackMs
  if (g.time_minutes) {
    if (color === 'w') newWhite = (whiteMs ?? 0) + g.increment_seconds * 1000
    else newBlack = (blackMs ?? 0) + g.increment_seconds * 1000
  }

  // A move implicitly declines any pending draw offer from the opponent
  const result = body.result || null // client-detected game end (checkmate/stalemate/draw)
  const status = result ? 'finished' : 'active'

  await c.env.DB.prepare(
    `UPDATE games SET moves=?, white_ms=?, black_ms=?, last_move_at=?, draw_offer=NULL, status=?, result=? WHERE id=?`
  ).bind(JSON.stringify(moves), newWhite, newBlack, now, status, result, g.id).run()

  return c.json({ ok: true, moves, whiteMs: newWhite, blackMs: newBlack, status, result })
})

// Resign
app.post('/api/games/:code/resign', async (c) => {
  const body = await c.req.json().catch(() => ({})) as any
  const g = await getGame(c.env.DB, c.req.param('code'))
  if (!g) return c.json({ error: 'Game not found' }, 404)
  const color = playerColor(g, body.token)
  if (!color) return c.json({ error: 'Not a player in this game' }, 403)
  if (g.status === 'finished') return c.json({ error: 'Game already finished' }, 400)
  const winner = color === 'w' ? 'b' : 'w'
  await c.env.DB.prepare(`UPDATE games SET status='finished', result=? WHERE id=?`)
    .bind(`resign:${winner}`, g.id).run()
  return c.json({ ok: true, result: `resign:${winner}` })
})

// Draw offer / accept / decline
app.post('/api/games/:code/draw', async (c) => {
  const body = await c.req.json().catch(() => ({})) as any
  const g = await getGame(c.env.DB, c.req.param('code'))
  if (!g) return c.json({ error: 'Game not found' }, 404)
  const color = playerColor(g, body.token)
  if (!color) return c.json({ error: 'Not a player in this game' }, 403)
  if (g.status !== 'active') return c.json({ error: 'Game is not active' }, 400)

  if (body.action === 'offer') {
    await c.env.DB.prepare(`UPDATE games SET draw_offer=? WHERE id=?`).bind(color, g.id).run()
    return c.json({ ok: true })
  }
  if (body.action === 'accept') {
    if (!g.draw_offer || g.draw_offer === color) return c.json({ error: 'No draw offer to accept' }, 400)
    await c.env.DB.prepare(`UPDATE games SET status='finished', result='draw:agreement', draw_offer=NULL WHERE id=?`)
      .bind(g.id).run()
    return c.json({ ok: true, result: 'draw:agreement' })
  }
  if (body.action === 'decline') {
    await c.env.DB.prepare(`UPDATE games SET draw_offer=NULL WHERE id=?`).bind(g.id).run()
    return c.json({ ok: true })
  }
  // Claimed draws (threefold / fifty-move) — verified by the claimant's engine
  if (body.action === 'claim' && (body.reason === 'repetition' || body.reason === 'fifty-move')) {
    await c.env.DB.prepare(`UPDATE games SET status='finished', result=? WHERE id=?`)
      .bind(`draw:${body.reason}`, g.id).run()
    return c.json({ ok: true, result: `draw:${body.reason}` })
  }
  return c.json({ error: 'Invalid action' }, 400)
})

// ---------------------------------------------------------------------------
// HTML shell
// ---------------------------------------------------------------------------

app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FIDE Chess — Play Friends &amp; Maia</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>♞</text></svg>">
  <link href="/static/style.css" rel="stylesheet">
</head>
<body>
  <div id="app-root">
    <header id="app-header">
      <h1 id="app-title"><span class="title-icon">♞</span> FIDE Chess</h1>
      <p id="app-subtitle">Full FIDE rules — play locally, against Maia, or with a friend online</p>
    </header>

    <!-- ======== Mode selection menu ======== -->
    <section id="mode-menu">
      <div class="mode-card" id="mode-local">
        <div class="mode-icon">👥</div>
        <h3>Pass &amp; Play</h3>
        <p>Two players on this device</p>
      </div>
      <div class="mode-card" id="mode-maia">
        <div class="mode-icon">🤖</div>
        <h3>Play Against Maia</h3>
        <p>Human-like bot, rated 600–1900</p>
      </div>
      <div class="mode-card" id="mode-friend">
        <div class="mode-icon">🌐</div>
        <h3>Play a Friend Online</h3>
        <p>Create a game &amp; share the code</p>
      </div>
    </section>

    <!-- ======== Game area (hidden until a mode starts) ======== -->
    <main id="main-layout" class="hidden">
      <section id="board-section">
        <div id="opponent-bar" class="player-bar">
          <span id="opponent-name" class="player-name"></span>
          <span id="clock-top" class="clock hidden">--:--</span>
        </div>

        <div id="turn-banner" class="turn-banner">
          <span id="turn-indicator-dot" class="turn-dot white"></span>
          <span id="turn-text">White to move</span>
        </div>

        <div id="board-wrapper">
          <div id="rank-labels" class="coord-labels ranks"></div>
          <div id="chess-board" role="grid" aria-label="Chess board"></div>
          <div id="file-labels" class="coord-labels files"></div>
        </div>

        <div id="player-bar-bottom" class="player-bar">
          <span id="player-name" class="player-name"></span>
          <span id="clock-bottom" class="clock hidden">--:--</span>
        </div>

        <div id="status-banner" class="status-banner hidden"></div>
        <div id="share-banner" class="share-banner hidden">
          Waiting for a friend to join… Game code:
          <strong id="share-code"></strong>
          <button id="btn-copy-link" class="btn btn-small">Copy invite link</button>
        </div>
        <div id="draw-offer-banner" class="share-banner hidden">
          Your opponent offers a draw.
          <button id="btn-draw-accept" class="btn btn-small">Accept</button>
          <button id="btn-draw-decline" class="btn btn-small">Decline</button>
        </div>

        <div id="controls">
          <button id="btn-back-menu" class="btn">☰ Menu</button>
          <button id="btn-new-game" class="btn btn-primary">↻ New Game</button>
          <button id="btn-flip-board" class="btn">Flip Board</button>
          <button id="btn-undo" class="btn">Undo</button>
          <button id="btn-resign" class="btn btn-danger">Resign</button>
          <button id="btn-draw-agree" class="btn">Offer Draw</button>
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

    <!-- ======== Play Against Maia modal ======== -->
    <div id="maia-modal" class="modal hidden">
      <div class="modal-content config-modal">
        <div class="config-header">
          <div>
            <h3>Play Against Maia</h3>
            <p class="config-sub">Configure your game settings and choose your side</p>
          </div>
          <button class="modal-close" data-close="maia-modal">✕</button>
        </div>

        <div class="config-row">
          <label class="config-label" for="maia-level">Opponent:</label>
          <select id="maia-level" class="config-select">
            <option value="600">Maia 600</option>
            <option value="900">Maia 900</option>
            <option value="1100" selected>Maia 1100</option>
            <option value="1300">Maia 1300</option>
            <option value="1500">Maia 1500</option>
            <option value="1700">Maia 1700</option>
            <option value="1900">Maia 1900</option>
          </select>
        </div>

        <div class="config-row">
          <span class="config-label">Time Control:</span>
          <div class="tc-presets" id="maia-tc-presets">
            <button class="tc-btn" data-min="3" data-inc="0">3+0</button>
            <button class="tc-btn" data-min="5" data-inc="2">5+2</button>
            <button class="tc-btn" data-min="10" data-inc="0">10+0</button>
            <button class="tc-btn" data-min="15" data-inc="10">15+10</button>
            <button class="tc-btn active" data-min="0" data-inc="0">Unlimited</button>
          </div>
        </div>

        <div class="config-row slider-row">
          <div class="slider-head"><span>Time (minutes)</span><span id="maia-time-value">0</span></div>
          <input type="range" id="maia-time-slider" min="0" max="60" value="0">
        </div>
        <div class="config-row slider-row">
          <div class="slider-head"><span>Increment (seconds)</span><span id="maia-inc-value">0</span></div>
          <input type="range" id="maia-inc-slider" min="0" max="30" value="0">
        </div>

        <div class="config-row">
          <span class="config-label">Maia thinking time:</span>
          <div class="toggle-group" id="maia-think-toggle">
            <button class="toggle-btn" data-think="instant">Instant</button>
            <button class="toggle-btn active" data-think="human">Human-like</button>
          </div>
        </div>

        <div class="config-row">
          <label class="checkbox-label">
            <input type="checkbox" id="maia-custom-pos"> Start from custom position
          </label>
          <input type="text" id="maia-fen-input" class="config-input hidden" placeholder="Paste FEN, e.g. rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1">
        </div>

        <div class="config-footer">
          <p class="choose-color-label">Choose your color:</p>
          <div class="color-choices" id="maia-color-choices">
            <button class="color-btn" data-color="b" title="Play as Black"><img src="/static/pieces/bK.svg" alt="Black"></button>
            <button class="color-btn selected" data-color="random" title="Random side"><img src="/static/pieces/wK.svg" alt="Random"><span class="random-badge">?</span></button>
            <button class="color-btn" data-color="w" title="Play as White"><img src="/static/pieces/wK.svg" alt="White"></button>
          </div>
          <button id="btn-start-maia" class="btn btn-primary btn-wide">Start Game</button>
        </div>
      </div>
    </div>

    <!-- ======== Friend game modal ======== -->
    <div id="friend-modal" class="modal hidden">
      <div class="modal-content config-modal">
        <div class="config-header">
          <div>
            <h3>Play a Friend Online</h3>
            <p class="config-sub">Create a game and share the code, or join with a friend's code</p>
          </div>
          <button class="modal-close" data-close="friend-modal">✕</button>
        </div>

        <div class="friend-tabs">
          <button id="tab-create" class="friend-tab active">Create Game</button>
          <button id="tab-join" class="friend-tab">Join Game</button>
        </div>

        <div id="friend-create-panel">
          <div class="config-row">
            <span class="config-label">Time Control:</span>
            <div class="tc-presets" id="friend-tc-presets">
              <button class="tc-btn" data-min="3" data-inc="0">3+0</button>
              <button class="tc-btn" data-min="5" data-inc="2">5+2</button>
              <button class="tc-btn" data-min="10" data-inc="0">10+0</button>
              <button class="tc-btn" data-min="15" data-inc="10">15+10</button>
              <button class="tc-btn active" data-min="0" data-inc="0">Unlimited</button>
            </div>
          </div>
          <div class="config-row slider-row">
            <div class="slider-head"><span>Time (minutes)</span><span id="friend-time-value">0</span></div>
            <input type="range" id="friend-time-slider" min="0" max="60" value="0">
          </div>
          <div class="config-row slider-row">
            <div class="slider-head"><span>Increment (seconds)</span><span id="friend-inc-value">0</span></div>
            <input type="range" id="friend-inc-slider" min="0" max="30" value="0">
          </div>
          <div class="config-footer">
            <p class="choose-color-label">Choose your color:</p>
            <div class="color-choices" id="friend-color-choices">
              <button class="color-btn" data-color="b" title="Play as Black"><img src="/static/pieces/bK.svg" alt="Black"></button>
              <button class="color-btn selected" data-color="random" title="Random side"><img src="/static/pieces/wK.svg" alt="Random"><span class="random-badge">?</span></button>
              <button class="color-btn" data-color="w" title="Play as White"><img src="/static/pieces/wK.svg" alt="White"></button>
            </div>
            <button id="btn-create-friend" class="btn btn-primary btn-wide">Create Game</button>
          </div>
        </div>

        <div id="friend-join-panel" class="hidden">
          <div class="config-row">
            <label class="config-label" for="join-code-input">Game code:</label>
            <input type="text" id="join-code-input" class="config-input code-input" placeholder="e.g. AB3XY9" maxlength="6" autocapitalize="characters">
          </div>
          <div class="config-footer">
            <button id="btn-join-friend" class="btn btn-primary btn-wide">Join Game</button>
          </div>
        </div>
        <p id="friend-error" class="config-error hidden"></p>
      </div>
    </div>

    <!-- ======== Promotion modal ======== -->
    <div id="promotion-modal" class="modal hidden">
      <div class="modal-content">
        <h3>Promote pawn to:</h3>
        <div id="promotion-choices"></div>
      </div>
    </div>

    <footer id="app-footer">
      Implements the FIDE Laws of Chess (Articles 1–5, 9). Maia bot inspired by
      <a href="https://github.com/CSSLab/maia-chess" target="_blank" rel="noopener">CSSLab/maia-chess</a>. Not an official FIDE product.
    </footer>
  </div>

  <script src="/static/chess-engine.js"></script>
  <script src="/static/maia-bot.js"></script>
  <script src="/static/app.js"></script>
</body>
</html>`)
})

export default app
