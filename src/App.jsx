import { useState } from 'react'
import LoginScreen from './components/LoginScreen'
import Phase1Cipher from './components/Phase1Cipher'
import Phase2Distributed from './components/Phase2Distributed'
import './App.css'

function App() {
  const [screen, setScreen] = useState('login') // 'login' | 'phase1' | 'phase2'
  const [playerName, setPlayerName] = useState('')

  const handleLogin = (name) => {
    setPlayerName(name)
    setScreen('phase1')
  }

  const handlePhase1Complete = () => {
    setScreen('phase2')
  }

  // Phase 1 uses terminal bg, Phase 2 uses modern dark bg
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
        {screen === 'phase2' && (
          <Phase2Distributed playerName={playerName} />
        )}
      </main>
    </div>
  )
}

export default App
