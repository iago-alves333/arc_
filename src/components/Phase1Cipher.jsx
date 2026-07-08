import { useState, useMemo } from 'react'

/**
 * Caesar Cipher shift: shifts A-Z only, wraps around.
 */
function caesarShift(text, shift) {
  return text
    .split('')
    .map((char) => {
      if (char >= 'A' && char <= 'Z') {
        const code = ((char.charCodeAt(0) - 65 + shift + 26) % 26) + 65
        return String.fromCharCode(code)
      }
      return char
    })
    .join('')
}

// ─── Pool de palavras temáticas (todas UPPERCASE, sem acentos) ─────
// Cada aluno receberá uma palavra aleatória com um shift aleatório
const WORD_POOL = [
  'MALDICAO', 'FANTASMA', 'SOMBRIAS', 'MALDITOS', 'CAVEIRAS',
  'CRIPTADO', 'SEGREDOS', 'CIFRA', 'ABISMO', 'ENIGMA',
  'LABIRINTO', 'ESPECTRO', 'TREVAS', 'SINISTRA', 'MISTERIO',
  'VAMPIROS', 'FANTASMA', 'HORRORES', 'OBSCUROS', 'TENEBROSO',
  'DEMONIO', 'PESADELO', 'SINISTRO', 'LOBISOMEM', 'BRUXARIA',
  'SOMBRIO', 'CRIATURA', 'TORMENTO', 'INFERNAL', 'MACABROS',
]

/**
 * Gera um desafio aleatório: escolhe uma palavra do pool e um shift entre 1-12.
 * Retorna { encrypted, solution, originalShift }.
 */
function generateRandomChallenge() {
  const word = WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)]
  // Shift entre 1 e 12 (evita 0, que não cifra nada)
  const originalShift = 1 + Math.floor(Math.random() * 12)
  const encrypted = caesarShift(word, originalShift)
  return { encrypted, solution: word, originalShift }
}

export default function Phase1Cipher({ playerName, onComplete }) {
  // Gerar desafio único para este aluno (estável durante re-renders)
  const challenge = useMemo(() => generateRandomChallenge(), [])

  const [shift, setShift] = useState(0)
  const [solved, setSolved] = useState(false)
  const [showButton, setShowButton] = useState(false)

  const displayedWord = useMemo(() => caesarShift(challenge.encrypted, shift), [shift, challenge.encrypted])
  const formattedWord = displayedWord.split('').join(' ')
  const isCorrect = displayedWord === challenge.solution

  const handleSliderChange = (e) => {
    const val = parseInt(e.target.value, 10)
    setShift(val)

    if (caesarShift(challenge.encrypted, val) === challenge.solution && !solved) {
      setSolved(true)
      setTimeout(() => setShowButton(true), 500)
    } else if (caesarShift(challenge.encrypted, val) !== challenge.solution) {
      setSolved(false)
      setShowButton(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col px-5 py-6 md:py-10 max-w-lg mx-auto">

      {/* Terminal window */}
      <div className="bg-term-surface border border-term-border rounded-lg overflow-hidden shadow-2xl shadow-black/50 flex-1 flex flex-col animate-fade-in">

        {/* Title bar */}
        <div className="bg-term-card px-4 py-2.5 flex items-center gap-3 border-b border-term-border shrink-0">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-term-red/80" />
            <div className="w-3 h-3 rounded-full bg-term-amber/80" />
            <div className="w-3 h-3 rounded-full bg-term-green/60" />
          </div>
          <span className="font-mono text-[11px] text-term-muted">
            cipher_decoder — CipherNet
          </span>
        </div>

        {/* Terminal content */}
        <div className="p-5 font-mono text-sm leading-relaxed flex-1 flex flex-col">

          {/* Header logs */}
          <div className="space-y-1 mb-5 text-xs">
            <p className="text-term-cyan">&gt; Operador <span className="text-term-green">{playerName}</span> autenticado.</p>
            <p className="text-term-muted">&gt; Analisando tráfego interceptado...</p>
            <p className="text-term-amber">⚠  Mensagem criptografada detectada no pacote #4829</p>
            <p className="text-term-muted">&gt; Algoritmo identificado: <span className="text-term-white">Cifra de César</span></p>
            <p className="text-term-muted">&gt; Use o controle de deslocamento para descriptografar.</p>
          </div>

          {/* Divider */}
          <div className="border-t border-term-border/50 my-3" />

          {/* Intercepted message box */}
          <div className={`border rounded-md p-5 my-3 text-center transition-all duration-400 ${
            isCorrect
              ? 'border-term-green/60 bg-term-green/5'
              : 'border-term-border bg-term-bg/50'
          }`}>
            <p className="text-[10px] text-term-muted uppercase tracking-[0.3em] mb-3">
              Mensagem Interceptada
            </p>

            <p className={`text-2xl md:text-3xl tracking-[0.35em] font-mono font-bold transition-colors duration-300 ${
              isCorrect ? 'text-term-green' : 'text-term-white'
            }`}>
              {formattedWord}
            </p>

            {isCorrect && (
              <div className="mt-3 animate-fade-in">
                <span className="inline-block text-[11px] text-term-green border border-term-green/40 rounded-full px-3 py-1 bg-term-green/5">
                  ✓ DESCRIPTOGRAFADO
                </span>
              </div>
            )}
          </div>

          {/* Slider control */}
          <div className="my-4">
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="text-term-muted">Deslocamento (Cifra de César)</span>
              <span className={`px-2 py-0.5 rounded text-xs ${
                isCorrect
                  ? 'text-term-green bg-term-green/10'
                  : 'text-term-amber bg-term-amber/10'
              }`}>
                shift: {shift > 0 ? '+' : ''}{shift}
              </span>
            </div>

            <input
              id="cipher-slider"
              type="range"
              min={-13}
              max={13}
              value={shift}
              onChange={handleSliderChange}
              className="slider-terminal w-full"
            />

            <div className="flex justify-between text-[10px] text-term-border mt-1">
              <span>-13</span>
              <span>0</span>
              <span>+13</span>
            </div>
          </div>

          {/* Hint */}
          <div className="border-t border-term-border/30 pt-3 mt-auto">
            <p className="text-[11px] text-term-muted leading-relaxed">
              <span className="text-term-cyan">ℹ</span>{' '}
              Na Cifra de César, cada letra é substituída por outra a uma distância fixa no alfabeto. 
              Exemplo: com deslocamento -1, a letra "B" vira "A".
            </p>
          </div>

          {/* Advance button — only when solved */}
          {showButton && (
            <div className="mt-4 animate-slide-up">
              <button
                id="btn-advance-phase2"
                onClick={onComplete}
                className="w-full border border-term-green text-term-green font-mono text-sm py-3.5 rounded transition-all duration-200 hover:bg-term-green/10 hover:shadow-[0_0_20px_rgba(57,255,20,0.15)] active:scale-[0.98]"
              >
                [ DESCRIPTOGRAFAR E AVANÇAR → ]
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-[10px] font-mono text-term-border mt-3 tracking-wider">
        CipherNet Decoder Module • Fase 1
      </p>
    </div>
  )
}
