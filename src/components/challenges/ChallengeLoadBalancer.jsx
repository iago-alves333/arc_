import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

/**
 * ══════════════════════════════════════════════════════════════
 *  ChallengeLoadBalancer.jsx
 * ──────────────────────────────────────────────────────────────
 *  Minigame: "O Balanceador de Carga"
 *
 *  Cenário: Um ataque DDoS está sobrecarregando servidores.
 *  Bolinhas (requisições) caem do topo da tela e por padrão vão
 *  todas para o Servidor 1. O jogador deve arrastar/clicar nos
 *  servidores para rotear as requisições, distribuindo a carga
 *  igualmente entre os 4 servidores.
 *
 *  Se qualquer servidor atingir sobrecarga máxima, o jogador perde.
 *  Se sobreviver por tempo suficiente mantendo todos estáveis,
 *  o desafio é concluído.
 *
 *  Props:
 *    - onSolve: () => void — chamada quando o jogador completa.
 * ══════════════════════════════════════════════════════════════
 */

// ─── Constantes do jogo ─────────────────────────────────────
const SERVER_COUNT = 4
const MAX_LOAD = 100          // Carga máxima de cada servidor
const OVERLOAD_THRESHOLD = 90 // Acima disso = zona crítica
const DANGER_THRESHOLD = 70   // Acima disso = zona de perigo
const LOAD_PER_REQUEST = 8    // Carga adicionada por requisição
const DECAY_RATE = 0.4        // Carga que diminui por tick
const SURVIVE_TIME = 30       // Segundos para vencer
const SPAWN_INTERVAL_START = 600  // ms entre spawns (início)
const SPAWN_INTERVAL_MIN = 250    // ms entre spawns (mínimo)
const BALL_FALL_SPEED = 3     // pixels por frame
const TICK_MS = 50            // intervalo de update do game loop

const SERVER_NAMES = ['SRV-01', 'SRV-02', 'SRV-03', 'SRV-04']
const SERVER_ICONS = ['🖥️', '🖥️', '🖥️', '🖥️']

// Cores para estado dos servidores
function getServerColor(load) {
  if (load >= OVERLOAD_THRESHOLD) return { bar: 'bg-term-red', border: 'border-term-red/80', glow: 'shadow-[0_0_12px_rgba(255,59,48,0.5)]', text: 'text-term-red' }
  if (load >= DANGER_THRESHOLD) return { bar: 'bg-term-amber', border: 'border-term-amber/60', glow: 'shadow-[0_0_8px_rgba(255,179,0,0.3)]', text: 'text-term-amber' }
  return { bar: 'bg-term-green', border: 'border-term-green/40', glow: '', text: 'text-term-green' }
}

export default function ChallengeLoadBalancer({ onSolve }) {
  // ─── Estado do jogo ─────────────────────────────────────────
  const [gameState, setGameState] = useState('intro') // 'intro' | 'playing' | 'lost' | 'won'
  const [loads, setLoads] = useState(() => new Array(SERVER_COUNT).fill(0))
  const [selectedServer, setSelectedServer] = useState(0)
  const [timeLeft, setTimeLeft] = useState(SURVIVE_TIME)
  const [balls, setBalls] = useState([])
  const [totalRouted, setTotalRouted] = useState(0)
  const [waveIntensity, setWaveIntensity] = useState(1)

  // Refs para game loop
  const gameLoopRef = useRef(null)
  const spawnTimerRef = useRef(null)
  const timerRef = useRef(null)
  const ballIdRef = useRef(0)
  const selectedServerRef = useRef(0)
  const containerRef = useRef(null)

  // Sync ref com state
  useEffect(() => {
    selectedServerRef.current = selectedServer
  }, [selectedServer])

  // ─── Auto-distribuição round-robin ──────────────────────────
  // O jogador seleciona qual servidor recebe a próxima onda clicando nele.
  // Também pode usar o toque/arraste no campo de queda.

  const nextBallId = useCallback(() => {
    ballIdRef.current += 1
    return ballIdRef.current
  }, [])

  // ─── Spawn de bolinhas ────────────────────────────────────
  const spawnBall = useCallback(() => {
    const id = nextBallId()
    const x = Math.random() * 80 + 10 // 10-90% da largura
    setBalls(prev => [...prev, {
      id,
      x,
      y: -5,
      targetServer: selectedServerRef.current,
      arrived: false,
    }])
  }, [nextBallId])

  // ─── Iniciar jogo ─────────────────────────────────────────
  const startGame = useCallback(() => {
    setGameState('playing')
    setLoads(new Array(SERVER_COUNT).fill(0))
    setSelectedServer(0)
    selectedServerRef.current = 0
    setTimeLeft(SURVIVE_TIME)
    setBalls([])
    setTotalRouted(0)
    setWaveIntensity(1)
    ballIdRef.current = 0
  }, [])

  // ─── Game loop ────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'playing') return

    // Countdown timer
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameState('won')
          return 0
        }
        // Aumentar intensidade com o tempo
        const elapsed = SURVIVE_TIME - prev + 1
        setWaveIntensity(1 + Math.floor(elapsed / 8))
        return prev - 1
      })
    }, 1000)

    // Game loop – move balls and decay loads
    gameLoopRef.current = setInterval(() => {
      // Move balls
      setBalls(prev => {
        const updated = []
        const arrivals = new Array(SERVER_COUNT).fill(0)

        for (const ball of prev) {
          if (ball.arrived) continue
          const newY = ball.y + BALL_FALL_SPEED
          if (newY >= 85) {
            // Ball arrived at server
            arrivals[ball.targetServer] += LOAD_PER_REQUEST
            setTotalRouted(r => r + 1)
          } else {
            updated.push({ ...ball, y: newY })
          }
        }

        // Adicionar carga das bolas que chegaram
        if (arrivals.some(a => a > 0)) {
          setLoads(prevLoads => {
            const newLoads = prevLoads.map((l, i) => Math.min(MAX_LOAD, l + arrivals[i]))
            // Check overload
            if (newLoads.some(l => l >= MAX_LOAD)) {
              setGameState('lost')
            }
            return newLoads
          })
        }

        return updated
      })

      // Decay loads naturally
      setLoads(prev => prev.map(l => Math.max(0, l - DECAY_RATE)))
    }, TICK_MS)

    // Spawn timer
    const startSpawning = () => {
      const elapsed = SURVIVE_TIME - timeLeft
      const interval = Math.max(
        SPAWN_INTERVAL_MIN,
        SPAWN_INTERVAL_START - elapsed * 12
      )
      spawnTimerRef.current = setTimeout(() => {
        spawnBall()
        startSpawning()
      }, interval)
    }
    startSpawning()

    return () => {
      clearInterval(timerRef.current)
      clearInterval(gameLoopRef.current)
      clearTimeout(spawnTimerRef.current)
    }
  }, [gameState, spawnBall, timeLeft])

  // ─── Quando vence ─────────────────────────────────────────
  useEffect(() => {
    if (gameState === 'won') {
      setTimeout(() => onSolve(), 2000)
    }
  }, [gameState, onSolve])

  // ─── Handler de toque/clique na área de queda ─────────────
  const handleFieldInteraction = useCallback((clientX) => {
    if (!containerRef.current || gameState !== 'playing') return
    const rect = containerRef.current.getBoundingClientRect()
    const relX = (clientX - rect.left) / rect.width
    const serverIdx = Math.min(SERVER_COUNT - 1, Math.floor(relX * SERVER_COUNT))
    setSelectedServer(serverIdx)
  }, [gameState])

  const handleMouseMove = useCallback((e) => {
    handleFieldInteraction(e.clientX)
  }, [handleFieldInteraction])

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length > 0) {
      e.preventDefault()
      handleFieldInteraction(e.touches[0].clientX)
    }
  }, [handleFieldInteraction])

  // ─── Progress bar do tempo (porcentagem) ──────────────────
  const timePercent = (timeLeft / SURVIVE_TIME) * 100

  // ─── Tela de Introdução ───────────────────────────────────
  if (gameState === 'intro') {
    return (
      <div className="bg-term-surface border border-term-border rounded-lg overflow-hidden shadow-2xl shadow-black/50 animate-fade-in">
        <div className="bg-term-card px-4 py-2.5 flex items-center gap-3 border-b border-term-border">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-term-red/80" />
            <div className="w-3 h-3 rounded-full bg-term-amber/80" />
            <div className="w-3 h-3 rounded-full bg-term-green/60" />
          </div>
          <span className="font-mono text-[11px] text-term-muted">
            load_balancer — CipherNet
          </span>
        </div>

        <div className="p-5 font-mono text-sm leading-relaxed">
          <div className="space-y-1 mb-5 text-xs">
            <p className="text-term-red">&gt; ⚠ ALERTA: Ataque DDoS detectado!</p>
            <p className="text-term-cyan">&gt; Milhares de requisições falsas inundando o sistema.</p>
            <p className="text-term-amber">&gt; Servidor principal em sobrecarga crítica.</p>
            <p className="text-term-muted">&gt; Ativando protocolo de balanceamento manual...</p>
          </div>

          <div className="border-t border-term-border/50 my-4" />

          <div className="border border-term-border rounded-md p-5 bg-term-bg/50 mb-4">
            <p className="text-[10px] text-term-muted uppercase tracking-[0.3em] mb-4 text-center">
              Briefing da Missão
            </p>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-term-amber shrink-0">▸</span>
                <p className="text-term-text">
                  Requisições (bolinhas) cairão do topo da tela em direção aos servidores.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-term-amber shrink-0">▸</span>
                <p className="text-term-text">
                  <span className="text-term-green">Arraste o dedo</span> ou <span className="text-term-green">mova o mouse</span> para
                  selecionar qual servidor recebe as próximas requisições.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-term-amber shrink-0">▸</span>
                <p className="text-term-text">
                  Distribua a carga <span className="text-term-amber">igualmente</span> entre os 4 servidores.
                  Se qualquer um atingir <span className="text-term-red">100% de sobrecarga</span>, você perde.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-term-amber shrink-0">▸</span>
                <p className="text-term-text">
                  Sobreviva por <span className="text-term-cyan">{SURVIVE_TIME} segundos</span> para concluir o desafio.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={startGame}
            id="btn-lb-start"
            className="w-full border border-term-red/50 text-term-red font-mono text-sm py-3 rounded transition-all duration-200 hover:bg-term-red/10 hover:border-term-red hover:shadow-[0_0_15px_rgba(255,59,48,0.2)] active:scale-[0.98]"
          >
            [ ATIVAR LOAD BALANCER ]
          </button>

          <div className="border-t border-term-border/30 pt-3 mt-4">
            <p className="text-[11px] text-term-muted leading-relaxed">
              <span className="text-term-cyan">ℹ</span>{' '}
              Load Balancers distribuem tráfego entre servidores para evitar
              sobrecarga. Essenciais contra ataques DDoS em sistemas distribuídos.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ─── Tela de Derrota ──────────────────────────────────────
  if (gameState === 'lost') {
    const overloadedIdx = loads.findIndex(l => l >= MAX_LOAD)
    return (
      <div className="bg-term-surface border border-term-border rounded-lg overflow-hidden shadow-2xl shadow-black/50 animate-fade-in">
        <div className="bg-term-card px-4 py-2.5 flex items-center gap-3 border-b border-term-border">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-term-red/80" />
            <div className="w-3 h-3 rounded-full bg-term-amber/80" />
            <div className="w-3 h-3 rounded-full bg-term-green/60" />
          </div>
          <span className="font-mono text-[11px] text-term-muted">
            load_balancer — CRASH
          </span>
        </div>

        <div className="p-5 font-mono text-sm text-center">
          <div className="text-4xl mb-4 animate-pulse-slow">💥</div>
          <h3 className="text-term-red text-lg mb-2">SERVIDOR SOBRECARREGADO</h3>
          <p className="text-term-muted text-xs mb-1">
            {overloadedIdx >= 0 ? `${SERVER_NAMES[overloadedIdx]} atingiu carga crítica e caiu.` : 'Um servidor atingiu carga crítica.'}
          </p>
          <p className="text-term-muted text-xs mb-4">
            Requisições roteadas: <span className="text-term-amber">{totalRouted}</span>
          </p>

          <button
            onClick={startGame}
            id="btn-lb-retry"
            className="w-full border border-term-amber/50 text-term-amber font-mono text-sm py-3 rounded transition-all duration-200 hover:bg-term-amber/10 hover:border-term-amber hover:shadow-[0_0_15px_rgba(255,179,0,0.15)] active:scale-[0.98]"
          >
            [ REINICIAR BALANCEAMENTO ]
          </button>
        </div>
      </div>
    )
  }

  // ─── Tela de Vitória ──────────────────────────────────────
  if (gameState === 'won') {
    return (
      <div className="bg-term-surface border border-term-border rounded-lg overflow-hidden shadow-2xl shadow-black/50 animate-fade-in">
        <div className="bg-term-card px-4 py-2.5 flex items-center gap-3 border-b border-term-border">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-term-red/80" />
            <div className="w-3 h-3 rounded-full bg-term-amber/80" />
            <div className="w-3 h-3 rounded-full bg-term-green/60" />
          </div>
          <span className="font-mono text-[11px] text-term-muted">
            load_balancer — SUCCESS
          </span>
        </div>

        <div className="p-5 font-mono text-sm text-center animate-slide-up">
          <div className="text-4xl mb-4">🛡️</div>
          <div className="inline-block border border-term-green/40 rounded-full px-4 py-2 bg-term-green/5 mb-3">
            <span className="text-term-green text-sm">✓ ATAQUE DDoS NEUTRALIZADO</span>
          </div>
          <p className="text-term-muted text-xs mb-1">
            Balanceamento estável mantido por {SURVIVE_TIME}s.
          </p>
          <p className="text-term-muted text-xs">
            Requisições roteadas: <span className="text-term-green font-bold">{totalRouted}</span>
          </p>
        </div>
      </div>
    )
  }

  // ─── Tela de Jogo (playing) ───────────────────────────────
  return (
    <div className="bg-term-surface border border-term-border rounded-lg overflow-hidden shadow-2xl shadow-black/50 animate-fade-in">
      {/* Title bar */}
      <div className="bg-term-card px-4 py-2 flex items-center justify-between border-b border-term-border">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-term-red/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-term-amber/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-term-green/60" />
          </div>
          <span className="font-mono text-[10px] text-term-muted">
            load_balancer — ACTIVE
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-term-red animate-pulse-slow">
            ● DDoS ATIVO
          </span>
          <span className="font-mono text-[10px] text-term-cyan">
            Wave {waveIntensity}
          </span>
        </div>
      </div>

      <div className="p-3">
        {/* Timer bar */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="font-mono text-[10px] text-term-muted">Sobrevivência</span>
            <span className={`font-mono text-[10px] font-bold ${timeLeft <= 10 ? 'text-term-red animate-pulse-slow' : 'text-term-cyan'}`}>
              {timeLeft}s
            </span>
          </div>
          <div className="w-full h-1.5 bg-term-border rounded-full overflow-hidden">
            <div
              className="h-full bg-term-cyan rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${timePercent}%` }}
            />
          </div>
        </div>

        {/* Área de queda das bolinhas + roteador */}
        <div
          ref={containerRef}
          className="relative w-full bg-term-bg/80 border border-term-border rounded-md overflow-hidden select-none"
          style={{ height: '220px', touchAction: 'none' }}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          onTouchStart={(e) => {
            if (e.touches.length > 0) {
              handleFieldInteraction(e.touches[0].clientX)
            }
          }}
          onClick={(e) => handleFieldInteraction(e.clientX)}
        >
          {/* Grid lines de fundo */}
          {[1, 2, 3].map(i => (
            <div
              key={`vline-${i}`}
              className="absolute top-0 bottom-0 w-px bg-term-border/30"
              style={{ left: `${(i / SERVER_COUNT) * 100}%` }}
            />
          ))}

          {/* Indicador do servidor selecionado */}
          <div
            className="absolute top-0 bottom-0 transition-all duration-150 ease-out bg-term-green/5 border-x border-term-green/20"
            style={{
              left: `${(selectedServer / SERVER_COUNT) * 100}%`,
              width: `${100 / SERVER_COUNT}%`,
            }}
          />

          {/* Label do roteador */}
          <div
            className="absolute top-1 transition-all duration-150 ease-out z-10"
            style={{
              left: `${((selectedServer + 0.5) / SERVER_COUNT) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <span className="font-mono text-[9px] text-term-green bg-term-bg/80 px-1.5 py-0.5 rounded border border-term-green/30">
              ▼ ROTEANDO
            </span>
          </div>

          {/* Bolinhas caindo */}
          {balls.map(ball => (
            <div
              key={ball.id}
              className="absolute w-3 h-3 rounded-full transition-none"
              style={{
                left: `${ball.x}%`,
                top: `${ball.y}%`,
                background: `radial-gradient(circle at 30% 30%, #FF6B6B, #FF3B30)`,
                boxShadow: '0 0 6px rgba(255, 59, 48, 0.6)',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}

          {/* Labels dos servidores na base */}
          <div className="absolute bottom-0 left-0 right-0 flex">
            {SERVER_NAMES.map((name, i) => {
              const colors = getServerColor(loads[i])
              return (
                <button
                  key={name}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedServer(i)
                  }}
                  className={`flex-1 py-1.5 text-center font-mono text-[9px] border-t transition-all duration-200 ${
                    selectedServer === i
                      ? `${colors.border} bg-term-card/80 ${colors.text}`
                      : 'border-term-border/40 text-term-muted bg-term-bg/60'
                  }`}
                >
                  {SERVER_ICONS[i]} {name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Barras de carga dos servidores */}
        <div className="grid grid-cols-4 gap-1.5 mt-3">
          {loads.map((load, i) => {
            const colors = getServerColor(load)
            const pct = Math.min(100, (load / MAX_LOAD) * 100)
            return (
              <button
                key={i}
                onClick={() => setSelectedServer(i)}
                className={`p-2 rounded border transition-all duration-200 ${
                  selectedServer === i
                    ? `${colors.border} ${colors.glow} bg-term-card`
                    : 'border-term-border/40 bg-term-bg/50'
                }`}
              >
                <p className={`font-mono text-[9px] text-center mb-1 ${
                  selectedServer === i ? colors.text : 'text-term-muted'
                }`}>
                  {SERVER_NAMES[i]}
                </p>

                {/* Barra vertical de carga */}
                <div className="w-full h-16 bg-term-bg rounded-sm overflow-hidden border border-term-border/30 relative">
                  <div
                    className={`absolute bottom-0 left-0 right-0 ${colors.bar} transition-all duration-150 rounded-sm`}
                    style={{ height: `${pct}%` }}
                  />
                  {/* Linhas de referência */}
                  <div className="absolute left-0 right-0 border-t border-term-red/30 border-dashed" style={{ bottom: `${OVERLOAD_THRESHOLD}%` }} />
                  <div className="absolute left-0 right-0 border-t border-term-amber/20 border-dashed" style={{ bottom: `${DANGER_THRESHOLD}%` }} />
                </div>

                <p className={`font-mono text-[9px] text-center mt-1 font-bold ${colors.text}`}>
                  {Math.round(pct)}%
                </p>
              </button>
            )
          })}
        </div>

        {/* Status footer */}
        <div className="flex justify-between items-center mt-2 px-1">
          <span className="font-mono text-[9px] text-term-muted">
            Roteadas: <span className="text-term-amber">{totalRouted}</span>
          </span>
          <span className="font-mono text-[9px] text-term-muted">
            Alvo: <span className="text-term-green">{SERVER_NAMES[selectedServer]}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
