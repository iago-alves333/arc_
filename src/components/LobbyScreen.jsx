import { useEffect, useState } from 'react'

/**
 * ══════════════════════════════════════════════════════════════
 *  LobbyScreen.jsx — Sala de espera antes dos minijogos
 * ──────────────────────────────────────────────────────────────
 *  Mostra a lista de alunos conectados e o botão de início
 *  (visível apenas para o Admin/professor).
 *
 *  Props:
 *    - playerName: string  — nome do jogador atual
 *    - isAdmin: boolean    — se este cliente é o Admin
 *    - jogadores: array    — lista de jogadores conectados
 *    - onStart: () => void — callback quando Admin clica em "Iniciar"
 * ══════════════════════════════════════════════════════════════
 */
export default function LobbyScreen({ playerName, isAdmin, jogadores = [], onStart }) {
  const [dots, setDots] = useState('')
  const [pulseIndex, setPulseIndex] = useState(0)

  // Animação de reticências
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 600)
    return () => clearInterval(interval)
  }, [])

  // Pulso sequencial nos avatares
  useEffect(() => {
    if (jogadores.length === 0) return
    const interval = setInterval(() => {
      setPulseIndex(prev => (prev + 1) % jogadores.length)
    }, 1200)
    return () => clearInterval(interval)
  }, [jogadores.length])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-md animate-fade-in">

        {/* Terminal window */}
        <div className="bg-term-surface border border-term-border rounded-lg overflow-hidden shadow-2xl shadow-black/50">

          {/* Title bar */}
          <div className="bg-term-card px-4 py-2.5 flex items-center gap-3 border-b border-term-border">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-term-red/80" />
              <div className="w-3 h-3 rounded-full bg-term-amber/80" />
              <div className="w-3 h-3 rounded-full bg-term-green/60" />
            </div>
            <span className="font-mono text-[11px] text-term-muted">
              lobby — CipherNet
            </span>
          </div>

          {/* Terminal body */}
          <div className="p-5 font-mono text-sm leading-relaxed">

            {/* Header */}
            <div className="space-y-1 mb-5 text-xs">
              <p className="text-term-cyan">&gt; Operador <span className="text-term-green">{playerName}</span> autenticado{isAdmin ? ' [ADMIN]' : ''}.</p>
              <p className="text-term-muted">&gt; Canal seguro estabelecido.</p>
              <p className="text-term-amber">⚠  Aguardando autorização para iniciar operação{dots}</p>
            </div>

            {/* Divider */}
            <div className="border-t border-term-border/50 my-3" />

            {/* Players list */}
            <div className="mb-4">
              <p className="text-[10px] text-term-muted uppercase tracking-[0.3em] mb-3">
                Operadores Conectados ({jogadores.length})
              </p>

              <div className="space-y-2 max-h-[240px] overflow-y-auto terminal-scroll">
                {jogadores.map((j, i) => (
                  <div
                    key={j.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded border transition-all duration-500 ${
                      j.nome === playerName
                        ? 'border-term-green/40 bg-term-green/5'
                        : 'border-term-border bg-term-bg/30'
                    }`}
                  >
                    {/* Avatar pulse */}
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-500 ${
                      i === pulseIndex
                        ? 'bg-term-green shadow-[0_0_10px_rgba(57,255,20,0.6)] scale-125'
                        : 'bg-term-green/40'
                    }`} />

                    {/* Name */}
                    <span className={`text-xs flex-1 ${
                      j.nome === playerName ? 'text-term-green' : 'text-term-text'
                    }`}>
                      {j.nome}
                      {j.nome === playerName && (
                        <span className="text-term-muted ml-1">(você)</span>
                      )}
                    </span>

                    {/* Admin badge */}
                    {j.isAdmin && (
                      <span className="text-[9px] text-term-amber border border-term-amber/40 rounded px-1.5 py-0.5 bg-term-amber/5">
                        ADMIN
                      </span>
                    )}
                  </div>
                ))}

                {jogadores.length === 0 && (
                  <p className="text-term-muted text-xs text-center py-4 animate-pulse-slow">
                    Nenhum operador conectado ainda...
                  </p>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-term-border/50 my-3" />

            {/* Status / Admin controls */}
            {isAdmin ? (
              <div className="animate-fade-in">
                <p className="text-[10px] text-term-amber mb-3">
                  ⚡ Modo Admin ativo — você controla o início da operação.
                </p>
                <button
                  id="btn-admin-start-minigames"
                  onClick={onStart}
                  disabled={jogadores.length < 1}
                  className="w-full border border-term-amber/60 text-term-amber font-mono text-sm py-3 rounded transition-all duration-200 hover:bg-term-amber/10 hover:border-term-amber hover:shadow-[0_0_15px_rgba(255,179,0,0.2)] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:shadow-none"
                >
                  [ 🚀 INICIAR MINIJOGOS — {jogadores.length} OPERADOR{jogadores.length !== 1 ? 'ES' : ''} ]
                </button>
              </div>
            ) : (
              <div className="text-center py-3">
                <div className="inline-flex items-center gap-2 text-term-muted text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-term-amber animate-pulse-slow" />
                  Aguardando o professor iniciar{dots}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] font-mono text-term-border mt-4 tracking-wider">
          CipherNet Lobby • {jogadores.length} operador{jogadores.length !== 1 ? 'es' : ''} na rede
        </p>
      </div>
    </div>
  )
}
