import { useEffect, useState } from 'react'

/**
 * ══════════════════════════════════════════════════════════════
 *  AdminDashboard.jsx — Painel de monitoramento do professor
 * ──────────────────────────────────────────────────────────────
 *  O Admin NÃO joga — apenas observa os alunos em tempo real.
 *  Mostra:
 *    - Lista de jogadores com fase atual de cada um
 *    - Barra de progresso global
 *    - Botões de controle de estado
 *
 *  Props:
 *    - playerName: string
 *    - jogadores: array (com faseAtual)
 *    - estadoPartida: string
 *    - onStartMinigames: () => void
 *    - onStartDistributed: () => void
 *    - onResetGame: () => void
 * ══════════════════════════════════════════════════════════════
 */

const FASE_LABELS = {
  'LOBBY_INICIAL':          { label: 'No Lobby',           color: 'text-term-muted',  bg: 'bg-term-border/30' },
  'FASE_1_CIFRA':           { label: 'Cifra de César',     color: 'text-term-cyan',   bg: 'bg-term-cyan/10' },
  'DESAFIOS_ALEATORIOS':    { label: 'Mini-Enigmas',       color: 'text-term-amber',  bg: 'bg-term-amber/10' },
  'LOBBY_FINAL':            { label: 'Aguardando',         color: 'text-term-green',  bg: 'bg-term-green/10' },
  'SISTEMAS_DISTRIBUIDOS':  { label: 'Quebrando Senha',    color: 'text-dark-accent', bg: 'bg-dark-accent/10' },
  'ADMIN_DASHBOARD':        { label: 'Admin',              color: 'text-term-amber',  bg: 'bg-term-amber/10' },
}

const ESTADO_CONFIG = {
  'LOBBY_INICIAL':          { label: 'Lobby Inicial',           emoji: '⏳' },
  'JOGANDO_MINIGAMES':      { label: 'Minijogos em Andamento',  emoji: '🎮' },
  'LOBBY_FINAL':            { label: 'Lobby Final',             emoji: '🔄' },
  'SISTEMAS_DISTRIBUIDOS':  { label: 'Sistemas Distribuídos',   emoji: '🌐' },
}

function getFaseInfo(fase) {
  return FASE_LABELS[fase] || FASE_LABELS['LOBBY_INICIAL']
}

export default function AdminDashboard({
  playerName,
  jogadores = [],
  estadoPartida = 'LOBBY_INICIAL',
  onStartMinigames,
  onStartDistributed,
  onResetGame,
}) {
  const [clock, setClock] = useState('')

  // Relógio em tempo real
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('pt-BR', { hour12: false }))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  // Separar alunos (sem admin) para estatísticas
  const alunos = jogadores.filter(j => !j.isAdmin)
  const totalAlunos = alunos.length
  const concluiramMinigames = alunos.filter(j => j.minigamesConcluidos).length
  const senhaEncontrada = alunos.some(j => j.senhaEncontrada)
  const estadoInfo = ESTADO_CONFIG[estadoPartida] || ESTADO_CONFIG['LOBBY_INICIAL']

  // Agrupar por fase
  const faseGroups = {}
  for (const j of alunos) {
    const fase = j.faseAtual || 'LOBBY_INICIAL'
    if (!faseGroups[fase]) faseGroups[fase] = []
    faseGroups[fase].push(j)
  }

  const canStartMinigames = estadoPartida === 'LOBBY_INICIAL' && totalAlunos > 0
  const canStartDistributed = (estadoPartida === 'JOGANDO_MINIGAMES' || estadoPartida === 'LOBBY_FINAL')

  return (
    <div className="min-h-screen flex flex-col px-4 py-5 md:px-6 md:py-8 max-w-2xl mx-auto">

      {/* ── Header ────────────────────────────────────────── */}
      <div className="mb-5 animate-fade-in">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-mono text-term-amber uppercase tracking-widest">
            ⚡ Painel do Admin
          </p>
          <span className="text-[10px] font-mono text-term-muted">{clock}</span>
        </div>
        <h1 className="font-mono text-xl md:text-2xl font-bold text-term-green">
          Monitoramento da Turma
        </h1>
      </div>

      {/* ── Estado da Partida ─────────────────────────────── */}
      <div className="bg-term-surface border border-term-border rounded-lg p-4 mb-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{estadoInfo.emoji}</span>
            <div>
              <p className="text-[9px] text-term-muted uppercase tracking-wider">Estado Atual</p>
              <p className="text-sm font-mono text-term-green font-bold">{estadoInfo.label}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-term-muted uppercase tracking-wider">Alunos</p>
            <p className="text-lg font-mono text-term-white font-bold">{totalAlunos}</p>
          </div>
        </div>

        {/* Progresso dos minigames */}
        {(estadoPartida === 'JOGANDO_MINIGAMES' || estadoPartida === 'LOBBY_FINAL') && (
          <div className="mt-3 pt-3 border-t border-term-border/50">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-term-muted">Minijogos Concluídos</span>
              <span className="text-[11px] font-mono text-term-green">
                {concluiramMinigames}/{totalAlunos}
              </span>
            </div>
            <div className="h-2 bg-term-bg rounded-full overflow-hidden border border-term-border">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: totalAlunos > 0 ? `${(concluiramMinigames / totalAlunos) * 100}%` : '0%',
                  background: concluiramMinigames === totalAlunos
                    ? 'linear-gradient(to right, #39FF14, #6dff56)'
                    : 'linear-gradient(to right, #FFB300, #ffcc44)',
                }}
              />
            </div>
          </div>
        )}

        {/* Progresso da quebra de senha colaborativa */}
        {estadoPartida === 'SISTEMAS_DISTRIBUIDOS' && (
          <div className="mt-3 pt-3 border-t border-term-border/50">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-term-muted">Senha Compartilhada</span>
              <span className={`text-[11px] font-mono ${senhaEncontrada ? 'text-term-green' : 'text-term-cyan animate-pulse-slow'}`}>
                {senhaEncontrada ? '🔓 QUEBRADA' : '🔒 Em andamento...'}
              </span>
            </div>
            <div className="h-2 bg-term-bg rounded-full overflow-hidden border border-term-border">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: senhaEncontrada ? '100%' : '50%',
                  background: senhaEncontrada
                    ? 'linear-gradient(to right, #39FF14, #6dff56)'
                    : 'linear-gradient(to right, #6366F1, #818CF8)',
                }}
              />
            </div>
            <p className="text-[9px] text-term-muted mt-1">
              {totalAlunos} dispositivo{totalAlunos !== 1 ? 's' : ''} trabalhando juntos
            </p>
          </div>
        )}
      </div>

      {/* ── Botões de Controle ─────────────────────────────── */}
      <div className="flex gap-2 mb-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {canStartMinigames && (
          <button
            id="btn-admin-start-minigames"
            onClick={onStartMinigames}
            className="flex-1 border border-term-amber/60 text-term-amber font-mono text-xs py-2.5 rounded transition-all duration-200 hover:bg-term-amber/10 hover:border-term-amber hover:shadow-[0_0_12px_rgba(255,179,0,0.15)] active:scale-[0.98]"
          >
            🚀 INICIAR MINIJOGOS
          </button>
        )}

        {canStartDistributed && (
          <button
            id="btn-admin-start-distributed"
            onClick={onStartDistributed}
            className="flex-1 border border-term-cyan/60 text-term-cyan font-mono text-xs py-2.5 rounded transition-all duration-200 hover:bg-term-cyan/10 hover:border-term-cyan hover:shadow-[0_0_12px_rgba(0,229,255,0.15)] active:scale-[0.98]"
          >
            🌐 INICIAR QUEBRA DE SENHA
          </button>
        )}

        <button
          id="btn-admin-reset"
          onClick={onResetGame}
          className="border border-term-red/40 text-term-red/70 font-mono text-xs px-3 py-2.5 rounded transition-all duration-200 hover:bg-term-red/10 hover:border-term-red/70 active:scale-[0.98]"
          title="Reiniciar jogo"
        >
          ↺
        </button>
      </div>

      {/* ── Lista de Alunos ───────────────────────────────── */}
      <div className="flex-1 bg-term-surface border border-term-border rounded-lg overflow-hidden animate-slide-up" style={{ animationDelay: '0.2s' }}>
        {/* Table header */}
        <div className="bg-term-card px-4 py-2 flex items-center gap-3 border-b border-term-border">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-term-red/60" />
            <div className="w-2 h-2 rounded-full bg-term-amber/60" />
            <div className="w-2 h-2 rounded-full bg-term-green/60" />
          </div>
          <span className="font-mono text-[10px] text-term-muted">
            monitor — {totalAlunos} aluno{totalAlunos !== 1 ? 's' : ''} conectado{totalAlunos !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Column headers */}
        <div className="px-4 py-2 flex items-center gap-3 border-b border-term-border/50 bg-term-bg/30">
          <span className="text-[9px] text-term-muted uppercase tracking-wider w-5">#</span>
          <span className="text-[9px] text-term-muted uppercase tracking-wider flex-1">Operador</span>
          <span className="text-[9px] text-term-muted uppercase tracking-wider w-28 text-center">Fase Atual</span>
          <span className="text-[9px] text-term-muted uppercase tracking-wider w-14 text-center">Status</span>
        </div>

        {/* Rows */}
        <div className="max-h-[400px] overflow-y-auto terminal-scroll">
          {alunos.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-term-muted text-xs font-mono animate-pulse-slow">
                Nenhum aluno conectado ainda...
              </p>
            </div>
          ) : (
            alunos.map((j, i) => {
              const faseInfo = getFaseInfo(j.faseAtual)
              return (
                <div
                  key={j.id}
                  className={`px-4 py-2.5 flex items-center gap-3 border-b border-term-border/30 transition-colors duration-300 ${
                    i % 2 === 0 ? 'bg-transparent' : 'bg-term-bg/20'
                  }`}
                >
                  {/* Index */}
                  <span className="text-[10px] text-term-muted font-mono w-5">{i + 1}</span>

                  {/* Name + indicator */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      j.senhaEncontrada ? 'bg-term-green shadow-[0_0_6px_rgba(57,255,20,0.5)]'
                      : j.minigamesConcluidos ? 'bg-term-green/60'
                      : 'bg-term-amber/50 animate-pulse-slow'
                    }`} />
                    <span className="text-xs font-mono text-term-text truncate">{j.nome}</span>
                  </div>

                  {/* Phase badge */}
                  <div className={`w-28 text-center px-1.5 py-0.5 rounded text-[9px] font-mono ${faseInfo.color} ${faseInfo.bg}`}>
                    {faseInfo.label}
                  </div>

                  {/* Status */}
                  <div className="w-14 text-center">
                    {j.senhaEncontrada ? (
                      <span className="text-[9px] text-term-green font-mono">✓ OK</span>
                    ) : j.minigamesConcluidos ? (
                      <span className="text-[9px] text-term-green/60 font-mono">PRONTO</span>
                    ) : (
                      <span className="text-[9px] text-term-amber/60 font-mono animate-pulse-slow">...</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Resumo por Fase ───────────────────────────────── */}
      {Object.keys(faseGroups).length > 0 && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          {Object.entries(faseGroups).map(([fase, players]) => {
            const info = getFaseInfo(fase)
            return (
              <div key={fase} className="bg-term-surface border border-term-border rounded-lg p-3 text-center">
                <p className="text-lg font-mono font-bold text-term-white">{players.length}</p>
                <p className={`text-[9px] font-mono ${info.color} uppercase tracking-wider`}>
                  {info.label}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────── */}
      <p className="text-center text-[10px] font-mono text-term-border mt-4 tracking-wider">
        CipherNet Admin Console • {playerName}
      </p>
    </div>
  )
}
