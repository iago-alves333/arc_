import { useState, useMemo } from 'react'

// ─── Imports dos desafios ───────────────────────────────────
import ChallengeLoadBalancer from './challenges/ChallengeLoadBalancer'
import ChallengeRiddle from './challenges/ChallengeRiddle'
import ChallengeTerminalLogic from './challenges/ChallengeTerminalLogic'

/**
 * ══════════════════════════════════════════════════════════════
 *  RandomChallengeManager.jsx
 * ──────────────────────────────────────────────────────────────
 *  Controlador das fases aleatórias. Ele:
 *
 *    1. Mantém um REGISTRO de todos os desafios possíveis.
 *    2. Sorteia N desafios sem repetição (via useMemo, uma vez por mount).
 *    3. Gerencia a progressão (desafio atual, barra de progresso).
 *    4. Chama `onComplete` quando todos forem concluídos.
 *
 *  Props:
 *    - challengeCount: number  — quantos desafios sortear (default: 3).
 *    - onComplete: () => void  — callback ao completar todos.
 *
 * ──────────────────────────────────────────────────────────────
 *  🔧 COMO ADICIONAR UM NOVO DESAFIO NO FUTURO:
 *
 *  1. Crie seu componente em `src/components/challenges/`.
 *     Ele DEVE receber a prop `onSolve: () => void`.
 *
 *  2. Importe-o neste arquivo:
 *        import MeuNovoDesafio from './challenges/MeuNovoDesafio'
 *
 *  3. Adicione uma entrada no array CHALLENGE_REGISTRY abaixo:
 *        {
 *          id: 'meu-novo-desafio',
 *          name: 'Nome Exibido',
 *          component: MeuNovoDesafio,
 *        }
 *
 *  Pronto! O gerenciador passará a incluí-lo nos sorteios.
 * ══════════════════════════════════════════════════════════════
 */

// ─── REGISTRO DE DESAFIOS ───────────────────────────────────
// Cada entrada possui:
//   - id:        identificador único (usado como key do React)
//   - name:      nome amigável exibido na HUD de progresso
//   - component: o componente React (deve aceitar prop `onSolve`)
const CHALLENGE_REGISTRY = [
  {
    id: 'load-balancer',
    name: 'Balanceador de Carga',
    component: ChallengeLoadBalancer,
  },
  {
    id: 'riddle',
    name: 'Enigma Macabro',
    component: ChallengeRiddle,
  },
  {
    id: 'terminal-logic',
    name: 'Lógica de Sequência',
    component: ChallengeTerminalLogic,
  },
  // ──────────────────────────────────────────────────────────
  // 🆕 Adicione novos desafios aqui. Exemplo:
  // {
  //   id: 'binary-decode',
  //   name: 'Decodificação Binária',
  //   component: ChallengeBinaryDecode,
  // },
  // ──────────────────────────────────────────────────────────
]

/**
 * Embaralha um array usando Fisher-Yates e retorna os primeiros N.
 * Não muta o array original.
 */
function shuffleAndPick(arr, count) {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, count)
}

export default function RandomChallengeManager({
  challengeCount = 3,
  onComplete,
}) {
  // ─── Sorteio dos desafios (uma vez por montagem) ──────────
  // useMemo garante que o sorteio não muda durante re-renders
  // (ex: quando o jogador erra e o componente re-renderiza).
  const selectedChallenges = useMemo(() => {
    const count = Math.min(challengeCount, CHALLENGE_REGISTRY.length)
    return shuffleAndPick(CHALLENGE_REGISTRY, count)
  }, [challengeCount])

  // ─── Estado de progressão ─────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0)
  const [transitioning, setTransitioning] = useState(false)

  const total = selectedChallenges.length
  const isLastChallenge = currentIndex >= total

  // ─── Handler quando um desafio é resolvido ────────────────
  const handleSolve = () => {
    setTransitioning(true)

    // Pequena pausa para animação de transição
    setTimeout(() => {
      const nextIndex = currentIndex + 1

      if (nextIndex >= total) {
        // Todos os desafios concluídos!
        setCurrentIndex(nextIndex)
        setTimeout(() => onComplete(), 1500)
      } else {
        setCurrentIndex(nextIndex)
        setTransitioning(false)
      }
    }, 800)
  }

  // ─── Tela de conclusão (todos resolvidos) ─────────────────
  if (isLastChallenge) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 py-8">
        <div className="w-full max-w-md text-center animate-fade-in">
          <div className="bg-term-surface border border-term-green/40 rounded-lg p-8 shadow-2xl shadow-black/50">
            <div className="text-4xl mb-4">🔓</div>
            <h2 className="font-mono text-term-green text-lg mb-2">
              SELOS QUEBRADOS
            </h2>
            <p className="font-mono text-term-muted text-xs mb-4">
              Todos os {total} desafios foram concluídos.
            </p>
            <div className="flex justify-center gap-2 mb-4">
              {selectedChallenges.map((_, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full bg-term-green shadow-[0_0_8px_rgba(57,255,20,0.5)]"
                />
              ))}
            </div>
            <p className="font-mono text-term-green/60 text-[11px] animate-pulse-slow">
              Avançando para a próxima fase...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ─── Renderiza o desafio atual ────────────────────────────
  const currentChallenge = selectedChallenges[currentIndex]
  const ChallengeComponent = currentChallenge.component

  return (
    <div className="min-h-screen flex flex-col px-5 py-6 md:py-10 max-w-lg mx-auto">
      {/* ── HUD de progresso ─────────────────────────────── */}
      <div className="mb-4 animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[11px] text-term-muted">
            Desafio {currentIndex + 1}/{total}
          </span>
          <span className="font-mono text-[11px] text-term-cyan">
            {currentChallenge.name}
          </span>
        </div>

        {/* Barra de progresso */}
        <div className="w-full h-1.5 bg-term-border rounded-full overflow-hidden">
          <div
            className="h-full bg-term-green rounded-full transition-all duration-500 ease-out shadow-[0_0_6px_rgba(57,255,20,0.4)]"
            style={{
              width: `${((currentIndex) / total) * 100}%`,
            }}
          />
        </div>

        {/* Indicadores de desafios */}
        <div className="flex items-center gap-1.5 mt-2">
          {selectedChallenges.map((ch, i) => (
            <div
              key={ch.id}
              title={ch.name}
              className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                i < currentIndex
                  ? 'bg-term-green shadow-[0_0_4px_rgba(57,255,20,0.4)]'
                  : i === currentIndex
                  ? 'bg-term-amber animate-pulse-slow'
                  : 'bg-term-border'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Componente do desafio ─────────────────────────── */}
      <div
        className={`flex-1 transition-all duration-500 ${
          transitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
      >
        {/*
          key={currentChallenge.id} força o React a desmontar/remontar
          o componente quando mudamos de desafio, garantindo que o
          useMemo interno de cada desafio gere dados novos.
        */}
        <ChallengeComponent
          key={currentChallenge.id}
          onSolve={handleSolve}
        />
      </div>

      {/* ── Footer ───────────────────────────────────────── */}
      <p className="text-center text-[10px] font-mono text-term-border mt-3 tracking-wider">
        CipherNet Challenge Protocol • Desafio {currentIndex + 1}/{total}
      </p>
    </div>
  )
}
