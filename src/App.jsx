import { useState } from 'react'
import LoginScreen from './components/LoginScreen'
import Phase1Cipher from './components/Phase1Cipher'
import RandomChallengeManager from './components/RandomChallengeManager'
import Phase2Distributed from './components/Phase2Distributed'
import './App.css'

/**
 * ══════════════════════════════════════════════════════════════
 *  App.jsx — Fluxo principal do jogo "Quebra de Maldição"
 * ──────────────────────────────────────────────────────────────
 *  Fluxo atualizado:
 *
 *    1. login       → Tela de entrada (LoginScreen)
 *    2. phase1      → Cifra de César (Phase1Cipher)
 *    3. challenges  → Mini-enigmas aleatórios (RandomChallengeManager)
 *    4. phase2      → Simulação de ataque distribuído (Phase2Distributed)
 *
 *  O RandomChallengeManager sorteia 3 desafios aleatórios que o
 *  jogador precisa resolver em sequência antes de avançar para
 *  a Phase2.
 *
 *  🔧 Para alterar o número de desafios, mude a prop
 *     `challengeCount` no componente RandomChallengeManager.
 *
 *  🔧 Para remover a Phase1 e substituí-la pelos desafios
 *     aleatórios, basta mudar o handleLogin para ir direto
 *     para 'challenges' em vez de 'phase1'.
 * ══════════════════════════════════════════════════════════════
 */

function App() {
  // Telas possíveis: 'login' | 'phase1' | 'challenges' | 'phase2'
  const [screen, setScreen] = useState('login')
  const [playerName, setPlayerName] = useState('')

  const handleLogin = (name) => {
    setPlayerName(name)
    setScreen('phase1')
  }

  const handlePhase1Complete = () => {
    setScreen('challenges')
  }

  const handleChallengesComplete = () => {
    setScreen('phase2')
  }

  // Phase 1 + challenges usam terminal bg, Phase 2 usa modern dark bg
  const bgClass = screen === 'phase2' ? 'bg-dark-bg' : 'bg-term-bg'

  return (
    <div className={`min-h-screen ${bgClass} transition-colors duration-700`}>
      {/* Scanline only on terminal screens */}
      {screen !== 'phase2' && <div className="terminal-scanline" />}

      <main className="relative z-10">
        {screen === 'login' && (
          <LoginScreen onLogin={handleLogin} />
        )}
        {screen === 'phase1' && (
          <Phase1Cipher playerName={playerName} onComplete={handlePhase1Complete} />
        )}
        {screen === 'challenges' && (
          <RandomChallengeManager
            challengeCount={3}
            onComplete={handleChallengesComplete}
          />
        )}
        {screen === 'phase2' && (
          <Phase2Distributed playerName={playerName} />
        )}
      </main>
    </div>
  )
}

export default App
