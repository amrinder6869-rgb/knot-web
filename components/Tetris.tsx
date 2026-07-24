'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const TETRIS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Tetris</title>
  <style>
    * { box-sizing: border-box; touch-action: manipulation; }
    body {
      margin: 0; background: #0f172a; color: #f8fafc;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 100vh; padding: 16px;
    }
    .header { display: flex; justify-content: space-between; width: 100%; max-width: 240px; margin-bottom: 12px; }
    .score-box { font-size: 16px; font-weight: 600; }
    canvas { background: #1e293b; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; width: 240px; }
    .btn { background: #334155; color: #fff; border: none; padding: 14px; font-size: 16px; border-radius: 8px; cursor: pointer; }
    .btn-rotate { grid-column: 2; }
    .btn-left { grid-column: 1; grid-row: 2; }
    .btn-drop { grid-column: 2; grid-row: 2; }
    .btn-right { grid-column: 3; grid-row: 2; }
  </style>
</head>
<body>
  <div class="header">
    <div class="score-box">Score: <span id="score">0</span></div>
    <div class="score-box">Lines: <span id="lines">0</span></div>
  </div>
  <canvas id="tetris" width="240" height="480"></canvas>
  <div class="controls">
    <button class="btn btn-rotate" onclick="playerRotate(1)">Rotate</button>
    <button class="btn btn-left" onclick="playerMove(-1)">Left</button>
    <button class="btn btn-drop" onclick="playerDrop()">Down</button>
    <button class="btn btn-right" onclick="playerMove(1)">Right</button>
  </div>
<script>
  const canvas = document.getElementById('tetris');
  const context = canvas.getContext('2d');
  context.scale(24, 24);
  const scoreEl = document.getElementById('score');
  const linesEl = document.getElementById('lines');

  const PIECES = {
    'I': [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
    'L': [[0,2,0],[0,2,0],[0,2,2]],
    'J': [[0,3,0],[0,3,0],[3,3,0]],
    'O': [[4,4],[4,4]],
    'Z': [[5,5,0],[0,5,5],[0,0,0]],
    'S': [[0,6,6],[6,6,0],[0,0,0]],
    'T': [[0,7,0],[7,7,7],[0,0,0]]
  };
  const COLORS = [null,'#00f0f0','#f0a000','#0000f0','#f0f000','#f00000','#00f000','#a000f0'];

  const arena = createMatrix(10, 20);
  let score = 0, lines = 0;
  const player = { pos: { x: 0, y: 0 }, matrix: null };

  function createMatrix(w, h) { const m = []; while (h--) m.push(new Array(w).fill(0)); return m; }

  function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y)
      for (let x = 0; x < m[y].length; ++x)
        if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) return true;
    return false;
  }

  function merge(arena, player) {
    player.matrix.forEach((row, y) => row.forEach((value, x) => { if (value !== 0) arena[y + player.pos.y][x + player.pos.x] = value; }));
  }

  function arenaSweep() {
    let rowCount = 1;
    outer: for (let y = arena.length - 1; y >= 0; --y) {
      for (let x = 0; x < arena[y].length; ++x) if (arena[y][x] === 0) continue outer;
      const row = arena.splice(y, 1)[0].fill(0);
      arena.unshift(row);
      ++y;
      score += rowCount * 100;
      lines += 1;
      rowCount *= 2;
    }
    scoreEl.innerText = score;
    linesEl.innerText = lines;
  }

  function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
      player.pos.y--;
      merge(arena, player);
      playerReset();
      arenaSweep();
    }
    dropCounter = 0;
  }

  function playerMove(dir) { player.pos.x += dir; if (collide(arena, player)) player.pos.x -= dir; }

  function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y)
      for (let x = 0; x < y; ++x) [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    if (dir > 0) matrix.forEach(row => row.reverse());
    else matrix.reverse();
  }
  window.playerRotate = function(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
      player.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (offset > player.matrix[0].length) { rotate(player.matrix, -dir); player.pos.x = pos; return; }
    }
  };
  window.playerMove = playerMove;
  window.playerDrop = playerDrop;

  function playerReset() {
    const pieces = 'ILJOTSZ';
    player.matrix = PIECES[pieces[pieces.length * Math.random() | 0]];
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    if (collide(arena, player)) { arena.forEach(row => row.fill(0)); gameOver(); }
  }

  function gameOver() {
    window.parent.postMessage({ type: 'tetris_game_over', score: score, lines: lines }, '*');
    score = 0; lines = 0;
    scoreEl.innerText = 0; linesEl.innerText = 0;
  }

  function drawMatrix(matrix, offset) {
    matrix.forEach((row, y) => row.forEach((value, x) => {
      if (value !== 0) {
        context.fillStyle = COLORS[value];
        context.fillRect(x + offset.x, y + offset.y, 1, 1);
        context.strokeStyle = '#1e293b';
        context.lineWidth = 0.05;
        context.strokeRect(x + offset.x, y + offset.y, 1, 1);
      }
    }));
  }

  function draw() {
    context.fillStyle = '#1e293b';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, { x: 0, y: 0 });
    drawMatrix(player.matrix, player.pos);
  }

  let dropCounter = 0, dropInterval = 1000, lastTime = 0;
  function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) playerDrop();
    draw();
    requestAnimationFrame(update);
  }

  window.addEventListener('keydown', event => {
    if (event.keyCode === 37) playerMove(-1);
    if (event.keyCode === 39) playerMove(1);
    if (event.keyCode === 40) playerDrop();
    if (event.keyCode === 38 || event.keyCode === 87) playerRotate(1);
  });

  playerReset();
  update();
</script>
</body>
</html>`

export default function Tetris({ knotId, currentUser, onBack }: { knotId: string, currentUser: any, onBack: () => void }) {
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    loadLeaderboard()
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'tetris_game_over') saveScore(e.data.score)
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  async function loadLeaderboard() {
    const { data, error: fetchError } = await supabase
      .from('game_scores')
      .select('*, profiles:user_id(name)')
      .eq('knot_id', knotId)
      .eq('game_id', 'tetris')
      .order('score', { ascending: false })
      .limit(10)
    if (fetchError) { setError('Could not load the leaderboard.'); return }
    setLeaderboard(data || [])
  }

  async function saveScore(score: number) {
    if (!currentUser || score <= 0) return
    const { error: insertError } = await supabase.from('game_scores').insert({
      knot_id: knotId, user_id: currentUser.id, game_id: 'tetris', score,
    })
    if (insertError) { setError('Could not save your score.'); return }
    loadLeaderboard()
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <button onClick={onBack} style={{ marginBottom: 16, padding: '8px 14px', background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
        Back to games
      </button>

      {error && (
        <div style={{ padding: '10px 14px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 13, color: 'var(--yellow)', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <iframe
            srcDoc={TETRIS_HTML}
            style={{ width: 280, height: 620, border: 'none', display: 'block' }}
            sandbox="allow-scripts"
          />
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Knot leaderboard</div>
          {leaderboard.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>No scores yet. Play a round!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {leaderboard.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', width: 16 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{s.profiles?.name || 'Someone'}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--yellow)' }}>{s.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
