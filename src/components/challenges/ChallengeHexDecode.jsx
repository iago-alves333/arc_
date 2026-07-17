import { useState, useMemo } from 'react'

/**
 * ══════════════════════════════════════════════════════════════
 *  ChallengeHexDecode.jsx
 * ──────────────────────────────────────────────────────────────
 *  O jogador recebe uma palavra temática convertida em Hexadecimal.
 *  Ele precisa descobrir a palavra original e digitar no terminal.
 *
 *  A palavra é sorteada de um banco interno (WORD_BANK) uma única
 *  vez por montagem via useMemo, evitando re-sorteio em re-renders.
 *
 *  Props:
 *    - onSolve: () => void — chamada quando o jogador acerta.
 * ══════════════════════════════════════════════════════════════
 */

// ─── Banco de palavras do dia a dia ─────────────────────────
const WORD_BANK = [
  'COMPUTADOR',
  'TECLADO',
  'INTERNET',
  'CELULAR',
  'MOCHILA',
  'CADERNO',
  'SORVETE',
  'FUTEBOL',
  'GUITARRA',
  'BICICLETA',
  'CHOCOLATE',
  'CAFETEIRA',
]

/**
 * Converte uma string para sua representação hexadecimal
 * (cada caractere vira 2 dígitos hex separados por espaço).
 */
function toHex(str) {
  return str
    .split('')
    .map((ch) => ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))
    .join(' ')
}

export default function ChallengeHexDecode({ onSolve }) {
  // ─── Sorteio da palavra (uma vez por montagem) ────────────
  const chosenWord = useMemo(() => {
    const idx = Math.floor(Math.random() * WORD_BANK.length)
    return WORD_BANK[idx]
  }, [])

  const hexString = useMemo(() => toHex(chosenWord), [chosenWord])

  // ─── Estado local ─────────────────────────────────────────
  const [guess, setGuess] = useState('')
  const [status, setStatus] = useState('idle') // 'idle' | 'wrong' | 'correct'
  const [attempts, setAttempts] = useState(0)
  const [showHint, setShowHint] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = guess.trim().toUpperCase()

    if (trimmed === chosenWord) {
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
          hex_decoder — CipherNet
        </span>
      </div>

      {/* ── Terminal body ────────────────────────────────── */}
      <div className="p-5 font-mono text-sm leading-relaxed">
        {/* Logs de contexto */}
        <div className="space-y-1 mb-5 text-xs">
          <p className="text-term-cyan">&gt; Interceptação de pacote hexadecimal...</p>
          <p className="text-term-muted">&gt; Payload capturado com sucesso.</p>
          <p className="text-term-amber">⚠  Decodificação manual necessária.</p>
          <p className="text-term-muted">
            &gt; Converta o hex abaixo para texto ASCII.
          </p>
        </div>

        <div className="border-t border-term-border/50 my-3" />

        {/* Hex display */}
        <div
          className={`border rounded-md p-5 my-3 text-center transition-all duration-400 ${
            status === 'correct'
              ? 'border-term-green/60 bg-term-green/5'
              : status === 'wrong'
              ? 'border-term-red/60 bg-term-red/5 animate-[shake_0.4s_ease-in-out]'
              : 'border-term-border bg-term-bg/50'
          }`}
        >
          <p className="text-[10px] text-term-muted uppercase tracking-[0.3em] mb-3">
            Payload Hex Interceptado
          </p>
          <p className="text-lg md:text-xl tracking-[0.25em] text-term-amber font-bold break-all">
            {hexString}
          </p>
        </div>

        {/* Dica após 2 erros */}
        {showHint && status !== 'correct' && (
          <div className="my-3 p-3 border border-term-cyan/30 rounded bg-term-cyan/5 animate-fade-in">
            <p className="text-[11px] text-term-cyan">
              <span className="text-term-amber">💡 DICA:</span> Cada par de dígitos hex
              representa um caractere ASCII. Por exemplo,{' '}
              <span className="text-term-green">41</span> = A,{' '}
              <span className="text-term-green">42</span> = B,{' '}
              <span className="text-term-green">5A</span> = Z.
            </p>
          </div>
        )}

        {/* Input form */}
        {status !== 'correct' ? (
          <form onSubmit={handleSubmit} className="mt-4">
            <label
              htmlFor="hex-answer"
              className="text-term-muted text-xs block mb-2"
            >
              &gt; Digite a palavra decodificada:
            </label>
            <div className="flex items-center gap-2">
              <span className="text-term-green select-none">$</span>
              <input
                id="hex-answer"
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="resposta_"
                maxLength={20}
                autoComplete="off"
                autoFocus
                className="flex-1 bg-transparent border-none outline-none text-term-green font-mono text-sm placeholder:text-term-border caret-term-green"
              />
              <span className="text-term-green animate-blink">▊</span>
            </div>

            {status === 'wrong' && (
              <p className="text-term-red text-xs mt-2 animate-fade-in">
                ✗ Decodificação incorreta. Tente novamente. [{attempts} erro{attempts > 1 ? 's' : ''}]
              </p>
            )}

            <button
              type="submit"
              id="btn-hex-submit"
              disabled={guess.trim().length < 1}
              className="w-full mt-4 border border-term-amber/50 text-term-amber font-mono text-sm py-3 rounded transition-all duration-200 hover:bg-term-amber/10 hover:border-term-amber hover:shadow-[0_0_15px_rgba(255,179,0,0.15)] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              [ DECODIFICAR ]
            </button>
          </form>
        ) : (
          /* Mensagem de sucesso */
          <div className="mt-4 text-center animate-slide-up">
            <div className="inline-block border border-term-green/40 rounded-full px-4 py-2 bg-term-green/5 mb-3">
              <span className="text-term-green text-sm">✓ DECODIFICADO COM SUCESSO</span>
            </div>
            <p className="text-term-muted text-xs">
              Palavra recuperada: <span className="text-term-green font-bold">{chosenWord}</span>
            </p>
          </div>
        )}

        {/* Info footer */}
        <div className="border-t border-term-border/30 pt-3 mt-4">
          <p className="text-[11px] text-term-muted leading-relaxed">
            <span className="text-term-cyan">ℹ</span>{' '}
            Hexadecimal é a base 16. Cada byte (par hex) representa um caractere na tabela ASCII.
          </p>
        </div>
      </div>
    </div>
  )
}
