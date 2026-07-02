import { useState, useMemo } from 'react'

/**
 * ══════════════════════════════════════════════════════════════
 *  ChallengeRiddle.jsx
 * ──────────────────────────────────────────────────────────────
 *  O jogador recebe um enigma/charada macabra e precisa digitar
 *  a resposta correta.
 *
 *  O enigma é sorteado do banco RIDDLE_BANK uma única vez por
 *  montagem (useMemo), garantindo estabilidade entre re-renders.
 *
 *  Props:
 *    - onSolve: () => void — chamada quando o jogador acerta.
 * ══════════════════════════════════════════════════════════════
 */

// ─── Banco de enigmas macabros ──────────────────────────────
const RIDDLE_BANK = [
  {
    pergunta:
      'Sou invocado em noites sem lua, carrego correntes que ninguém vê. ' +
      'Meu nome ecoa nos corredores e faço o vivo estremecer. O que sou?',
    resposta_correta: 'FANTASMA',
    dica: 'Habita entre os vivos, mas não está vivo.',
  },
  {
    pergunta:
      'Tenho dentes, mas não mordo. Tenho tampa, mas não sou panela. ' +
      'Quem entra em mim nunca mais sai. O que sou?',
    resposta_correta: 'CAIXAO',
    dica: 'Uma cama para a eternidade.',
  },
  {
    pergunta:
      'Quanto mais me alimentam, mais eu cresço. Mas se me dão água, eu morro. ' +
      'Nas fogueiras rituais, sou o mestre. O que sou?',
    resposta_correta: 'FOGO',
    dica: 'Elemento primordial de rituais ancestrais.',
  },
  {
    pergunta:
      'Sou a primeira coisa que você vê ao fechar os olhos, ' +
      'e a última ao abri-los numa cripta. Estou em toda parte, ' +
      'mas desapareço com a luz. O que sou?',
    resposta_correta: 'ESCURIDAO',
    dica: 'O oposto do que te permite enxergar.',
  },
  {
    pergunta:
      'Posso ser de prata ou de eclipse. Os lobos uivam para mim, ' +
      'e as marés me obedecem. Nas noites de ritual, sou vigia silenciosa. O que sou?',
    resposta_correta: 'LUA',
    dica: 'Brilha no céu noturno, mas não produz luz própria.',
  },
  {
    pergunta:
      'Sem boca, eu grito. Sem olhos, eu choro. ' +
      'Nasço da dor e morro no esquecimento. ' +
      'Bruxas me carregam em frascos. O que sou?',
    resposta_correta: 'LAGRIMA',
    dica: 'Cai dos olhos quando a alma sangra.',
  },
  {
    pergunta:
      'Caminho sem pernas, sussurro sem boca, ' +
      'arrasto folhas mortas e apago velas de ritual. O que sou?',
    resposta_correta: 'VENTO',
    dica: 'Invisível, mas você sente minha presença.',
  },
  {
    pergunta:
      'Sou vermelha como o pecado, corro nas veias do inocente ' +
      'e sou derramada nos pactos sombrios. O que sou?',
    resposta_correta: 'SANGUE',
    dica: 'Líquido vital que sela maldições.',
  },
]

/**
 * Normaliza a string para comparação (remove acentos, maiúsculas).
 */
function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

export default function ChallengeRiddle({ onSolve }) {
  // ─── Sorteio do enigma (uma vez por montagem) ─────────────
  const riddle = useMemo(() => {
    const idx = Math.floor(Math.random() * RIDDLE_BANK.length)
    return RIDDLE_BANK[idx]
  }, [])

  // ─── Estado local ─────────────────────────────────────────
  const [guess, setGuess] = useState('')
  const [status, setStatus] = useState('idle') // 'idle' | 'wrong' | 'correct'
  const [attempts, setAttempts] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [typingComplete, setTypingComplete] = useState(false)

  // Typing animation state
  const [displayedText, setDisplayedText] = useState('')

  // Typewriter effect for riddle text
  useMemo(() => {
    let i = 0
    const text = riddle.pergunta
    setDisplayedText('')
    const interval = setInterval(() => {
      i++
      setDisplayedText(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        setTypingComplete(true)
      }
    }, 20)
    return () => clearInterval(interval)
  }, [riddle])

  const handleSubmit = (e) => {
    e.preventDefault()
    const normalizedGuess = normalize(guess)
    const normalizedAnswer = normalize(riddle.resposta_correta)

    if (normalizedGuess === normalizedAnswer) {
      setStatus('correct')
      setTimeout(() => onSolve(), 1200)
    } else {
      setStatus('wrong')
      setAttempts((a) => a + 1)
      if (attempts >= 1) setShowHint(true)
      setTimeout(() => setStatus('idle'), 1500)
    }
  }

  return (
    <div className="bg-term-surface border border-term-border rounded-lg overflow-hidden shadow-2xl shadow-black/50 animate-fade-in">
      {/* ── Title bar ────────────────────────────────────── */}
      <div className="bg-term-card px-4 py-2.5 flex items-center gap-3 border-b border-term-border">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-term-red/80" />
          <div className="w-3 h-3 rounded-full bg-term-amber/80" />
          <div className="w-3 h-3 rounded-full bg-term-green/60" />
        </div>
        <span className="font-mono text-[11px] text-term-muted">
          enigma_vault — CipherNet
        </span>
      </div>

      {/* ── Terminal body ────────────────────────────────── */}
      <div className="p-5 font-mono text-sm leading-relaxed">
        {/* Logs de contexto */}
        <div className="space-y-1 mb-5 text-xs">
          <p className="text-term-cyan">&gt; Acessando cofre de enigmas...</p>
          <p className="text-term-muted">&gt; Arquivo selado encontrado.</p>
          <p className="text-term-red">⚠  Resolva o enigma para desbloquear o selo.</p>
        </div>

        <div className="border-t border-term-border/50 my-3" />

        {/* Riddle display */}
        <div
          className={`border rounded-md p-5 my-3 transition-all duration-400 ${
            status === 'correct'
              ? 'border-term-green/60 bg-term-green/5'
              : status === 'wrong'
              ? 'border-term-red/60 bg-term-red/5 animate-[shake_0.4s_ease-in-out]'
              : 'border-term-border bg-term-bg/50'
          }`}
        >
          <p className="text-[10px] text-term-muted uppercase tracking-[0.3em] mb-3 text-center">
            ☠ Enigma Selado ☠
          </p>

          <p className="text-term-white text-sm leading-relaxed italic">
            "{displayedText}"
            {!typingComplete && <span className="text-term-green animate-blink">▊</span>}
          </p>
        </div>

        {/* Dica após 2 erros */}
        {showHint && status !== 'correct' && (
          <div className="my-3 p-3 border border-term-cyan/30 rounded bg-term-cyan/5 animate-fade-in">
            <p className="text-[11px] text-term-cyan">
              <span className="text-term-amber">💡 DICA:</span>{' '}
              <span className="text-term-white">{riddle.dica}</span>
            </p>
          </div>
        )}

        {/* Input form */}
        {status !== 'correct' ? (
          <form onSubmit={handleSubmit} className="mt-4">
            <label
              htmlFor="riddle-answer"
              className="text-term-muted text-xs block mb-2"
            >
              &gt; Qual é a resposta do enigma?
            </label>
            <div className="flex items-center gap-2">
              <span className="text-term-red select-none">$</span>
              <input
                id="riddle-answer"
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="resposta_"
                maxLength={30}
                autoComplete="off"
                autoFocus
                disabled={!typingComplete}
                className="flex-1 bg-transparent border-none outline-none text-term-red font-mono text-sm placeholder:text-term-border caret-term-red disabled:opacity-40"
              />
              <span className="text-term-red animate-blink">▊</span>
            </div>

            {status === 'wrong' && (
              <p className="text-term-red text-xs mt-2 animate-fade-in">
                ✗ Resposta incorreta. O selo permanece intacto. [{attempts} erro{attempts > 1 ? 's' : ''}]
              </p>
            )}

            <button
              type="submit"
              id="btn-riddle-submit"
              disabled={guess.trim().length < 1 || !typingComplete}
              className="w-full mt-4 border border-term-red/50 text-term-red font-mono text-sm py-3 rounded transition-all duration-200 hover:bg-term-red/10 hover:border-term-red hover:shadow-[0_0_15px_rgba(255,59,48,0.15)] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              [ QUEBRAR SELO ]
            </button>
          </form>
        ) : (
          /* Mensagem de sucesso */
          <div className="mt-4 text-center animate-slide-up">
            <div className="inline-block border border-term-green/40 rounded-full px-4 py-2 bg-term-green/5 mb-3">
              <span className="text-term-green text-sm">✓ SELO QUEBRADO</span>
            </div>
            <p className="text-term-muted text-xs">
              Resposta: <span className="text-term-green font-bold">{riddle.resposta_correta}</span>
            </p>
          </div>
        )}

        {/* Info footer */}
        <div className="border-t border-term-border/30 pt-3 mt-4">
          <p className="text-[11px] text-term-muted leading-relaxed">
            <span className="text-term-red">☠</span>{' '}
            Os enigmas são guardiões ancestrais. Pense além do literal.
          </p>
        </div>
      </div>
    </div>
  )
}
