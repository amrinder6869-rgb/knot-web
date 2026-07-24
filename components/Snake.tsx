'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const SNAKE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Snake</title>
  <style>
    * { box-sizing: border-box; touch-action: manipulation; }
    body {
      margin: 0; background: #0f172a; color: #f8fafc;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 100vh; padding: 16px;
    }
    .header { display: flex; justify-content: space-between; width: 100%; max-width: 360px; margin-bottom: 12px; }
    .score-box { font-size: 18px; font-weight: 600; }
    canvas { background: #1e293b; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; width: 200px; }
    .btn { background: #334155; color: #fff; border: none; padding: 16px; font-size: 18px; border-radius: 8px; cursor: pointer; }
    .btn-up { grid-column: 2; }
    .btn-left { grid-column: 1; grid-row: 2; }
    .btn-down { grid-column: 2; grid-row: 2; }
    .btn-right { grid-column: 3; grid-row: 2; }
  </style>
</head>
<body>
  <div class="header">
    <div class="score-box">Score: <span id="score">0</span></div>
    <div class="score-box">Best: <span id="highScore">0</span></div>
  </div>
  <canvas id="gameCanvas" width="360" height="360"></canvas>
  <div class="controls">
    <button class="btn btn-up" onclick="setDir('UP')">Up</button>
    <button class="btn btn-left" onclick="setDir('LEFT')">Left</button>
    <button class="btn btn-down" onclick="setDir('DOWN')">Down</button>
    <button class="btn btn-right" onclick="setDir('RIGHT')">Right</button>
  </div>
<script>
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('highScore');
  const GRID_SIZE = 18;
  const TILE_COUNT = canvas.width / GRID_SIZE;
  let snake, food, dir, nextDir, score, gameInterval;
  let highScore = 0;
  try { highScore = localStorage.getItem('snake_highscore') || 0; } catch (e) {}
  highScoreEl.innerText = highScore;

  function initGame() {
    snake = [{ x: 10, y: 10 }, { x: 10, y: 11 }];
    dir = 'UP'; nextDir = 'UP'; score = 0;
    scoreEl.innerText = score;
    spawnFood();
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, 120);
  }

  function spawnFood() {
    food = { x: Math.floor(Math.random() * TILE_COUNT), y: Math.floor(Math.random() * TILE_COUNT) };
    if (snake.some(s => s.x === food.x && s.y === food.y)) spawnFood();
  }

  function setDir(newDir) {
    const opposites = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
    if (newDir !== opposites[dir]) nextDir = newDir;
  }
  window.setDir = setDir;

  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'KeyW'].includes(e.code)) setDir('UP');
    if (['ArrowDown', 'KeyS'].includes(e.code)) setDir('DOWN');
    if (['ArrowLeft', 'KeyA'].includes(e.code)) setDir('LEFT');
    if (['ArrowRight', 'KeyD'].includes(e.code)) setDir('RIGHT');
  });

  function gameLoop() {
    dir = nextDir;
    const head = { ...snake[0] };
    if (dir === 'UP') head.y--;
    if (dir === 'DOWN') head.y++;
    if (dir === 'LEFT') head.x--;
    if (dir === 'RIGHT') head.x++;
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT || snake.some(s => s.x === head.x && s.y === head.y)) {
      return gameOver();
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10; scoreEl.innerText = score; spawnFood();
    } else { snake.pop(); }
    draw();
  }

  function draw() {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc((food.x + 0.5) * GRID_SIZE, (food.y + 0.5) * GRID_SIZE, GRID_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? '#10b981' : '#34d399';
      ctx.fillRect(segment.x * GRID_SIZE + 1, segment.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
    });
  }

  function gameOver() {
    clearInterval(gameInterval);
    if (score > highScore) {
      highScore = score;
      try { localStorage.setItem('snake_highscore', highScore); } catch (e) {}
      highScoreEl.innerText = highScore;
    }
    window.parent.postMessage({ type: 'snake_game_over', score: score }, '*');
    setTimeout(initGame, 600);
  }

  initGame();
</script>
</body>
</html>`

export default function Snake({ knotId, currentUser, onBack }: { knotId: string, currentUser: any, onBack: () => void }) {
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [error, setError] = useState('')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    loadLeaderboard()
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'snake_game_over') saveScore(e.data.score)
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  async function loadLeaderboard() {
    const { data, error: fetchError } = await supabase
      .from('game_scores')
      .select('*, profiles:user_id(name)')
      .eq('knot_id', knotId)
      .eq('game_id', 'snake')
      .order('score', { ascending: false })
      .limit(10)
    if (fetchError) { setError('Could not load the leaderboard.'); return }
    setLeaderboard(data || [])
  }

  async function saveScore(score: number) {
    if (!currentUser || score <= 0) return
    const { error: insertError } = await supabase.from('game_scores').insert({
      knot_id: knotId, user_id: currentUser.id, game_id: 'snake', score,
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
            ref={iframeRef}
            srcDoc={SNAKE_HTML}
            style={{ width: 392, height: 520, border: 'none', display: 'block' }}
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
