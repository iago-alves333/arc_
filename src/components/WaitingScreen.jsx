import { useEffect, useState } from 'react'

/**
 * ══════════════════════════════════════════════════════════════
 *  WaitingScreen.jsx — Lobby Final (pós-minijogos)
 * ──────────────────────────────────────────────────────────────
 *  Aparece quando um aluno termina os minijogos e precisa
 *  aguardar os outros antes da fase de sistemas distribuídos.
 *
 *  O Admin vê quem já terminou e tem o botão de "Iniciar
 *  Quebra de Senha".
 *
 *  Props:
 *    - playerName: string       — nome do jogador
 *    - isAdmin: boolean         — se é Admin
 *    - jogadores: array         — lista de jogadores
 *    - onStartDistributed: ()   — callback Admin inicia distribuído
 * ══════════════════════════════════════════════════════════════
 */
export default function WaitingScreen({ playerName, isAdmin, jogadores = [], onStartDistributed }) {
  const [dots, setDots] = useState('')
  const [glitchFrame, setGlitchFrame] = useState(false)

  const concluidos = jogadores.filter(j => j.minigamesConcluidos)
  const pendentes = jogadores.filter(j => !j.minigamesConcluidos)
  const progresso = jogadores.length > 0
    ? Math.round((concluidos.length / jogadores.length) * 100)
    : 0

  // Animação de reticências
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 600)
    return () => clearInterval(interval)
  }, [])

  // Glitch sutil a cada poucos segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setGlitchFrame(true)
      setTimeout(() => setGlitchFrame(false), 150)
    }, 4000 + Math.random() * 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-md animate-fade-in">

        {/* Terminal window */}
        <div className={`bg-term-surface border border-term-border rounded-lg overflow-hidden shadow-2xl shadow-black/50 transition-transform duration-150 ${
          glitchFrame ? 'translate-x-[1px]' : ''
        }`}>

          {/* Title bar */}
          <div className="bg-term-card px-4 py-2.5 flex items-center gap-3 border-b border-term-border">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-term-red/80" />
              <div className="w-3 h-3 rounded-full bg-term-amber/80" />
              <div className="w-3 h-3 rounded-full bg-term-green/60" />
            </div>
            <span className="font-mono text-[11px] text-term-muted">
              sync_network — CipherNet
            </span>
          </div>

          {/* Terminal body */}
          <div className="p-5 font-mono text-sm leading-relaxed">

            {/* Header */}
            <div className="space-y-1 mb-5 text-xs">
              <p className="text-term-green">&gt; Desafios concluídos com sucesso ✓</p>
              <p className="text-term-cyan">&gt; Preparando rede de nós distribuídos{dots}</p>
              <p className="text-term-muted">&gt; Aguardando os outros nós da rede se conectarem{dots}</p>
            </div>

            {/* Divider */}
            <div className="border-t border-term-border/50 my-3" />

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] text-term-muted uppercase tracking-wider">
                  Sincronização da Rede
                </span>
                <span className={`text-[11px] font-mono ${
                  progresso >= 100 ? 'text-term-green' : 'text-term-amber'
                }`}>
                  {concluidos.length}/{jogadores.length} nós prontos
                </span>
              </div>
              <div className="h-2 bg-term-bg rounded-full overflow-hidden border border-term-border">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${progresso}%`,
                    background: progresso >= 100
                      ? 'linear-gradient(to right, #39FF14, #6dff56)'
                      : 'linear-gradient(to right, #FFB300, #ffcc44)',
                  }}
                />
              </div>
            </div>

            {/* Players list — organized by status */}
            <div className="mb-4 space-y-3">
              {/* Concluídos */}
              {concluidos.length > 0 && (
                <div>
                  <p className="text-[9px] text-term-green uppercase tracking-[0.25em] mb-1.5">
                    ✓ Prontos ({concluidos.length})
                  </p>
                  <div className="space-y-1">
                    {concluidos.map(j => (
                      <div key={j.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-term-green/5 border border-term-green/20">
                        <div className="w-2 h-2 rounded-full bg-term-green shadow-[0_0_6px_rgba(57,255,20,0.5)]" />
                        <span className="text-xs text-term-green flex-1">
                          {j.nome}
                          {j.nome === playerName && <span className="text-term-muted ml-1">(você)</span>}
                        </span>
                        <span className="text-[9px] text-term-green/60">PRONTO</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pendentes */}
              {pendentes.length > 0 && (
                <div>
                  <p className="text-[9px] text-term-amber uppercase tracking-[0.25em] mb-1.5">
                    ⏳ Em progresso ({pendentes.length})
                  </p>
                  <div className="space-y-1">
                    {pendentes.map(j => (
                      <div key={j.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-term-amber/5 border border-term-border">
                        <div className="w-2 h-2 rounded-full bg-term-amber/50 animate-pulse-slow" />
                        <span className="text-xs text-term-muted flex-1">
                          {j.nome}
                          {j.nome === playerName && <span className="text-term-muted ml-1">(você)</span>}
                        </span>
                        <span className="text-[9px] text-term-amber/50 animate-pulse-slow">JOGANDO</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-term-border/50 my-3" />

            {/* Admin controls or waiting message */}
            {isAdmin ? (
              <div className="animate-fade-in">
                <p className="text-[10px] text-term-amber mb-3">
                  ⚡ Admin — inicie a quebra de senha quando todos estiverem prontos.
                </p>
                <button
                  id="btn-admin-start-distributed"
                  onClick={onStartDistributed}
                  className="w-full border border-term-cyan/60 text-term-cyan font-mono text-sm py-3 rounded transition-all duration-200 hover:bg-term-cyan/10 hover:border-term-cyan hover:shadow-[0_0_15px_rgba(0,229,255,0.2)] active:scale-[0.98]"
                >
                  [ 🌐 INICIAR QUEBRA DE SENHA — {concluidos.length}/{jogadores.length} PRONTOS ]
                </button>
              </div>
            ) : (
              <div className="text-center py-3">
                <div className="inline-flex items-center gap-2 text-term-muted text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-term-cyan animate-pulse-slow" />
                  Aguardando o professor iniciar a quebra de senha{dots}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] font-mono text-term-border mt-4 tracking-wider">
          CipherNet Sync Protocol • {progresso}% sincronizado
        </p>
      </div>
    </div>
  )
}
