import { useState, useMemo } from 'react'

/**
 * ══════════════════════════════════════════════════════════════
 *  ChallengeTerminalLogic.jsx
 * ──────────────────────────────────────────────────────────────
 *  Um painel imitando um terminal onde o usuário precisa encontrar
 *  o próximo número de uma sequência lógica.
 *
 *  A sequência é gerada proceduralmente via JavaScript a cada
 *  montagem usando useMemo. As possibilidades incluem:
 *    - Progressão aritmética (diferença constante)
 *    - Progressão geométrica (razão constante)
 *    - Fibonacci demoníaca (soma dos dois anteriores, offset aleatório)
 *    - Sequência de potências
 *
 *  Props:
 *    - onSolve: () => void — chamada quando o jogador acerta.
 * ══════════════════════════════════════════════════════════════
 */

// ─── Geradores de sequências ────────────────────────────────

/**
 * Progressão Aritmética: a(n) = start + n * diff
 * Mostra 5 termos, esconde o 6º.
 */
function generateArithmetic() {
  const start = Math.floor(Math.random() * 10) + 1
  const diff = Math.floor(Math.random() * 7) + 2 // diff entre 2-8
  const seq = []
  for (let i = 0; i < 6; i++) seq.push(start + i * diff)
  return {
    visible: seq.slice(0, 5),
    answer: seq[5],
    type: 'Progressão Aritmética',
    hint: `Observe a diferença constante entre os termos consecutivos.`,
  }
}

/**
 * Progressão Geométrica: a(n) = start * ratio^n
 * Mostra 5 termos, esconde o 6º.
 */
function generateGeometric() {
  const start = Math.floor(Math.random() * 3) + 2 // 2-4
  const ratio = Math.floor(Math.random() * 2) + 2 // 2-3
  const seq = []
  for (let i = 0; i < 6; i++) seq.push(start * Math.pow(ratio, i))
  return {
    visible: seq.slice(0, 5),
    answer: seq[5],
    type: 'Progressão Geométrica',
    hint: `Cada termo é multiplicado por uma razão constante.`,
  }
}

/**
 * Fibonacci Demoníaca: a(n) = a(n-1) + a(n-2), com seeds aleatórios.
 * Mostra 6 termos, esconde o 7º.
 */
function generateFibonacci() {
  const a = Math.floor(Math.random() * 5) + 1
  const b = Math.floor(Math.random() * 5) + 1
  const seq = [a, b]
  for (let i = 2; i < 7; i++) seq.push(seq[i - 1] + seq[i - 2])
  return {
    visible: seq.slice(0, 6),
    answer: seq[6],
    type: 'Fibonacci Demoníaca',
    hint: `Cada termo é a soma dos dois termos anteriores.`,
  }
}

/**
 * Potências: a(n) = base^n
 * Mostra 5 termos, esconde o 6º.
 */
function generatePowers() {
  const base = Math.floor(Math.random() * 3) + 2 // 2-4
  const seq = []
  for (let i = 1; i <= 6; i++) seq.push(Math.pow(base, i))
  return {
    visible: seq.slice(0, 5),
    answer: seq[5],
    type: 'Sequência de Potências',
    hint: `Cada termo é uma potência crescente de um número fixo.`,
  }
}

// ─── Registro de geradores ──────────────────────────────────
const GENERATORS = [
  generateArithmetic,
  generateGeometric,
  generateFibonacci,
  generatePowers,
]

export default function ChallengeTerminalLogic({ onSolve }) {
  // ─── Geração da sequência (uma vez por montagem) ──────────
  const sequence = useMemo(() => {
    const gen = GENERATORS[Math.floor(Math.random() * GENERATORS.length)]
    return gen()
  }, [])

  // ─── Estado local ─────────────────────────────────────────
  const [guess, setGuess] = useState('')
  const [status, setStatus] = useState('idle') // 'idle' | 'wrong' | 'correct'
  const [attempts, setAttempts] = useState(0)
  const [showHint, setShowHint] = useState(false)

  // Linhas do "terminal" para efeito visual
  const terminalLines = useMemo(() => [
    { text: '$ ./analyze_pattern --mode=decrypt', color: 'text-term-green' },
    { text: '> Carregando módulo de análise sequencial...', color: 'text-term-muted' },
    { text: '> Padrão numérico detectado no stream de dados.', color: 'text-term-cyan' },
    { text: `> Classificação: [${sequence.type}]`, color: 'text-term-amber' },
    { text: '> Recuperando fragmentos da sequência...', color: 'text-term-muted' },
    { text: '> ALERTA: Último termo corrompido. Reconstrução necessária.', color: 'text-term-red' },
  ], [sequence.type])

  const handleSubmit = (e) => {
    e.preventDefault()
    const parsed = parseInt(guess.trim(), 10)

    if (parsed === sequence.answer) {
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
          pattern_analyzer — CipherNet
        </span>
      </div>

      {/* ── Terminal body ────────────────────────────────── */}
      <div className="p-5 font-mono text-sm leading-relaxed">
        {/* Terminal log lines */}
        <div className="space-y-1 mb-5 text-xs">
          {terminalLines.map((line, i) => (
            <p key={i} className={line.color}>
              {line.text}
            </p>
          ))}
        </div>

        <div className="border-t border-term-border/50 my-3" />

        {/* Sequence display */}
        <div
          className={`border rounded-md p-5 my-3 transition-all duration-400 ${
            status === 'correct'
              ? 'border-term-green/60 bg-term-green/5'
              : status === 'wrong'
              ? 'border-term-red/60 bg-term-red/5 animate-[shake_0.4s_ease-in-out]'
              : 'border-term-border bg-term-bg/50'
          }`}
        >
          <p className="text-[10px] text-term-muted uppercase tracking-[0.3em] mb-4 text-center">
            Sequência Corrompida
          </p>

          <div className="flex items-center justify-center gap-2 md:gap-3 flex-wrap">
            {sequence.visible.map((num, i) => (
              <span
                key={i}
                className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 border border-term-green/40 rounded bg-term-bg text-term-green text-base md:text-lg font-bold"
              >
                {num}
              </span>
            ))}

            {/* O termo escondido */}
            <span
              className={`inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 border-2 rounded font-bold text-base md:text-lg transition-all duration-300 ${
                status === 'correct'
                  ? 'border-term-green bg-term-green/10 text-term-green'
                  : 'border-term-red/60 bg-term-red/5 text-term-red animate-pulse-slow border-dashed'
              }`}
            >
              {status === 'correct' ? sequence.answer : '??'}
            </span>
          </div>
        </div>

        {/* Dica após 2 erros */}
        {showHint && status !== 'correct' && (
          <div className="my-3 p-3 border border-term-cyan/30 rounded bg-term-cyan/5 animate-fade-in">
            <p className="text-[11px] text-term-cyan">
              <span className="text-term-amber">💡 DICA:</span>{' '}
              <span className="text-term-white">{sequence.hint}</span>
            </p>
          </div>
        )}

        {/* Input form */}
        {status !== 'correct' ? (
          <form onSubmit={handleSubmit} className="mt-4">
            <label
              htmlFor="logic-answer"
              className="text-term-muted text-xs block mb-2"
            >
              &gt; Reconstrua o termo corrompido:
            </label>
            <div className="flex items-center gap-2">
              <span className="text-term-green select-none">$</span>
              <input
                id="logic-answer"
                type="text"
                value={guess}
                onChange={(e) => {
                  // Aceita apenas números e sinal negativo
                  const val = e.target.value.replace(/[^0-9-]/g, '')
                  setGuess(val)
                }}
                placeholder="número_"
                maxLength={10}
                autoComplete="off"
                autoFocus
                className="flex-1 bg-transparent border-none outline-none text-term-green font-mono text-sm placeholder:text-term-border caret-term-green"
              />
              <span className="text-term-green animate-blink">▊</span>
            </div>

            {status === 'wrong' && (
              <p className="text-term-red text-xs mt-2 animate-fade-in">
                ✗ Valor incorreto. Sequência ainda corrompida. [{attempts} erro{attempts > 1 ? 's' : ''}]
              </p>
            )}

            <button
              type="submit"
              id="btn-logic-submit"
              disabled={guess.trim().length < 1}
              className="w-full mt-4 border border-term-green/50 text-term-green font-mono text-sm py-3 rounded transition-all duration-200 hover:bg-term-green/10 hover:border-term-green hover:shadow-[0_0_15px_rgba(57,255,20,0.15)] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              [ RECONSTRUIR TERMO ]
            </button>
          </form>
        ) : (
          /* Mensagem de sucesso */
          <div className="mt-4 text-center animate-slide-up">
            <div className="inline-block border border-term-green/40 rounded-full px-4 py-2 bg-term-green/5 mb-3">
              <span className="text-term-green text-sm">✓ SEQUÊNCIA RESTAURADA</span>
            </div>
            <p className="text-term-muted text-xs">
              Termo reconstruído: <span className="text-term-green font-bold">{sequence.answer}</span>
            </p>
          </div>
        )}

        {/* Info footer */}
        <div className="border-t border-term-border/30 pt-3 mt-4">
          <p className="text-[11px] text-term-muted leading-relaxed">
            <span className="text-term-cyan">ℹ</span>{' '}
            Sequências numéricas guardam padrões ocultos. Analise as diferenças entre termos consecutivos.
          </p>
        </div>
      </div>
    </div>
  )
}
