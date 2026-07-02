import { useState, useEffect } from 'react'

// Simulates the typing effect for the terminal boot sequence
function useTypewriter(lines, speed = 30, lineDelay = 150) {
  const [displayedLines, setDisplayedLines] = useState([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    let lineIndex = 0
    let charIndex = 0
    let currentLines = []

    const tick = () => {
      if (lineIndex >= lines.length) {
        setDone(true)
        return
      }

      const currentLine = lines[lineIndex]

      if (charIndex <= currentLine.length) {
        const updatedLines = [...currentLines]
        updatedLines[lineIndex] = currentLine.slice(0, charIndex)
        setDisplayedLines([...updatedLines])
        charIndex++
        setTimeout(tick, speed)
      } else {
        currentLines = [...currentLines, currentLine]
        lineIndex++
        charIndex = 0
        setTimeout(tick, lineDelay)
      }
    }

    setTimeout(tick, 400)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { displayedLines, done }
}

const BOOT_LINES = [
  '$ ssh interceptor@192.168.0.42',
  'Connecting to secure channel...',
  'Connection established.',
  '',
  '> Loading CipherNet v2.7...',
  '> Scanning encrypted traffic...',
  '> ⚠  ENCRYPTED MESSAGE INTERCEPTED',
  '',
  'Identificação necessária para continuar.',
]

export default function LoginScreen({ onLogin }) {
  const [name, setName] = useState('')
  const [shake, setShake] = useState(false)
  const { displayedLines, done } = useTypewriter(BOOT_LINES)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (name.trim().length < 2) {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }
    onLogin(name.trim())
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-md">

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
              interceptor — CipherNet
            </span>
          </div>

          {/* Terminal body */}
          <div className="p-5 font-mono text-sm leading-relaxed min-h-[280px]">
            {/* Boot sequence */}
            {displayedLines.map((line, i) => (
              <div
                key={i}
                className={`${
                  line.includes('⚠') ? 'text-term-amber font-bold' :
                  line.startsWith('$') ? 'text-term-green' :
                  line.startsWith('>') ? 'text-term-cyan' :
                  'text-term-muted'
                }`}
              >
                {line}
                {line === '' && <br />}
              </div>
            ))}

            {/* Cursor while typing */}
            {!done && (
              <span className="text-term-green animate-blink">▊</span>
            )}

            {/* Login prompt — appears after boot sequence */}
            {done && (
              <form onSubmit={handleSubmit} className="mt-4 animate-fade-in">
                <div className="mb-4">
                  <label htmlFor="investigator-name" className="text-term-muted text-xs block mb-2">
                    &gt; Digite seu codinome de operador:
                  </label>
                  <div className={`flex items-center gap-2 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
                    style={shake ? { animation: 'shake 0.4s ease-in-out' } : {}}>
                    <span className="text-term-green select-none">$</span>
                    <input
                      id="investigator-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="operador_"
                      maxLength={20}
                      autoComplete="off"
                      autoFocus
                      className="flex-1 bg-transparent border-none outline-none text-term-green font-mono text-sm placeholder:text-term-border caret-term-green"
                    />
                    <span className="text-term-green animate-blink">▊</span>
                  </div>
                </div>

                {shake && (
                  <p className="text-term-red text-xs mb-3 animate-fade-in">
                    Erro: codinome deve ter pelo menos 2 caracteres.
                  </p>
                )}

                <button
                  type="submit"
                  id="btn-enter-session"
                  disabled={name.trim().length < 1}
                  className="w-full border border-term-green/50 text-term-green font-mono text-sm py-3 rounded transition-all duration-200 hover:bg-term-green/10 hover:border-term-green hover:shadow-[0_0_15px_rgba(57,255,20,0.15)] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-term-green/50 disabled:hover:shadow-none"
                >
                  [ ENTRAR NA SESSÃO ]
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] font-mono text-term-border mt-4 tracking-wider">
          CipherNet Secure Terminal • v2.7.1
        </p>
      </div>
    </div>
  )
}
