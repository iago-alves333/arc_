import { useState, useEffect, useRef, useCallback } from 'react'
import LoginScreen from './components/LoginScreen'
import LobbyScreen from './components/LobbyScreen'
import AdminDashboard from './components/AdminDashboard'
import Phase1Cipher from './components/Phase1Cipher'
import RandomChallengeManager from './components/RandomChallengeManager'
import WaitingScreen from './components/WaitingScreen'
import Phase2Distributed from './components/Phase2Distributed'
import './App.css'

/**
 * ══════════════════════════════════════════════════════════════
 *  App.jsx — Fluxo principal do jogo "Quebra de Maldição"
 * ──────────────────────────────────────────────────────────────
 *  Fluxo ALUNO:
 *    login → lobby_inicial → phase1 → challenges → lobby_final → phase2
 *
 *  Fluxo ADMIN (professor):
 *    login → lobby_inicial → admin_dashboard (permanece monitorando)
 *
 *  O Admin NÃO joga — apenas observa e controla as transições.
 *  Cada aluno reporta sua fase atual via ATUALIZAR_FASE.
 *  Heartbeat PING a cada 20s mantém conexões vivas em abas de fundo.
 * ══════════════════════════════════════════════════════════════
 */

// =========================================
// WEBSOCKET URL — Detecção dinâmica
// =========================================
function getWebSocketUrl() {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL
  }
  const { protocol, host, hostname } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'ws://localhost:8080/ghost-network'
  }
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${host}/api/ghost-network`
}

const WS_URL = getWebSocketUrl()

/** Intervalo de heartbeat em ms (20 segundos) */
const HEARTBEAT_INTERVAL = 20000

function App() {
  // Telas possíveis:
  //   Aluno: 'login' | 'lobby_inicial' | 'phase1' | 'challenges' | 'lobby_final' | 'phase2'
  //   Admin: 'login' | 'lobby_inicial' | 'admin_dashboard'
  const [screen, setScreen] = useState('login')
  const [playerName, setPlayerName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [jogadores, setJogadores] = useState([])
  const [estadoPartida, setEstadoPartida] = useState('LOBBY_INICIAL')

  // WebSocket ref para a comunicação de lobby
  const wsRef = useRef(null)
  const reconnectRef = useRef(null)
  const heartbeatRef = useRef(null)
  const isAdminRef = useRef(false) // ref para closures

  // ─── WebSocket: enviar mensagem ────────────────────────────
  const wsSend = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  // ─── Heartbeat: manter conexão viva ────────────────────────
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    heartbeatRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ tipo: 'PING' }))
      }
    }, HEARTBEAT_INTERVAL)
  }, [])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  // ─── Notificar fase atual ao servidor ──────────────────────
  const sendFaseAtual = useCallback((fase) => {
    wsSend({ tipo: 'ATUALIZAR_FASE', fase })
  }, [wsSend])

  // ─── WebSocket: processar mensagens do servidor ────────────
  const handleServerMessage = useCallback((data) => {
    switch (data.tipo) {
      case 'REGISTO_LOBBY':
        setIsAdmin(data.isAdmin)
        isAdminRef.current = data.isAdmin
        handleEstadoPartida(data.estadoPartida, data.isAdmin)
        break

      case 'LOBBY_ATUALIZADO':
        setJogadores(data.jogadores || [])
        setEstadoPartida(data.estadoPartida || 'LOBBY_INICIAL')
        break

      case 'MUDAR_ESTADO':
        setEstadoPartida(data.novoEstado)
        handleEstadoPartida(data.novoEstado, isAdminRef.current)
        break

      case 'PONG':
        // Heartbeat response — nothing to do
        break

      default:
        break
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Mapear estado do servidor para tela ───────────────────
  const handleEstadoPartida = useCallback((estado, admin) => {
    switch (estado) {
      case 'LOBBY_INICIAL':
        setScreen('lobby_inicial')
        break

      case 'JOGANDO_MINIGAMES':
        if (admin) {
          // Admin vai para o dashboard — não joga
          setScreen('admin_dashboard')
        } else {
          // Aluno avança para phase1 (se ainda está no lobby)
          setScreen(prev => {
            if (prev === 'lobby_inicial' || prev === 'login') return 'phase1'
            return prev
          })
        }
        break

      case 'LOBBY_FINAL':
        if (!admin) {
          setScreen('lobby_final')
        }
        // Admin fica no dashboard
        break

      case 'SISTEMAS_DISTRIBUIDOS':
        if (admin) {
          // Admin permanece no dashboard — monitora a fase distribuída
          setScreen('admin_dashboard')
        } else {
          // Fechar a WS do lobby — Phase2Distributed cria a sua própria conexão
          stopHeartbeat()
          if (reconnectRef.current) {
            clearTimeout(reconnectRef.current)
            reconnectRef.current = null
          }
          if (wsRef.current) {
            wsRef.current.close(1000)
            wsRef.current = null
          }
          setScreen('phase2')
        }
        break

      default:
        break
    }
  }, [stopHeartbeat])

  // ─── WebSocket: conectar ao servidor ───────────────────────
  const connectWs = useCallback((name, admin) => {
    if (wsRef.current) {
      wsRef.current.close()
    }

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[Lobby WS] Conectado')
      ws.send(JSON.stringify({
        tipo: 'REGISTAR',
        nome: name,
        isAdmin: admin,
      }))
      // Iniciar heartbeat
      startHeartbeat()
    }

    ws.onmessage = (event) => {
      try {
        handleServerMessage(JSON.parse(event.data))
      } catch (e) {
        console.error('[Lobby WS] Erro ao processar mensagem:', e)
      }
    }

    ws.onclose = (event) => {
      console.log('[Lobby WS] Desconectado, código:', event.code)
      stopHeartbeat()
      if (event.code !== 1000) {
        reconnectRef.current = setTimeout(() => {
          console.log('[Lobby WS] Reconectando...')
          connectWs(name, admin)
        }, 3000)
      }
    }

    ws.onerror = () => {
      console.error('[Lobby WS] Erro de conexão')
    }
  }, [handleServerMessage, startHeartbeat, stopHeartbeat])

  // ─── Cleanup ao desmontar ──────────────────────────────────
  useEffect(() => {
    return () => {
      stopHeartbeat()
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (wsRef.current) wsRef.current.close(1000)
    }
  }, [stopHeartbeat])

  // ─── Handlers de navegação ─────────────────────────────────

  const handleLogin = (name, admin) => {
    setPlayerName(name)
    setIsAdmin(admin)
    isAdminRef.current = admin
    setScreen('lobby_inicial')
    connectWs(name, admin)
  }

  const handleAdminStartMinigames = () => {
    wsSend({ tipo: 'ADMIN_INICIAR_MINIGAMES' })
  }

  const handlePhase1Complete = () => {
    setScreen('challenges')
    sendFaseAtual('DESAFIOS_ALEATORIOS')
  }

  const handleChallengesComplete = () => {
    wsSend({ tipo: 'MINIGAMES_CONCLUIDOS' })
    setScreen('lobby_final')
    sendFaseAtual('LOBBY_FINAL')
  }

  const handleAdminStartDistributed = () => {
    wsSend({ tipo: 'ADMIN_INICIAR_DISTRIBUIDO' })
  }

  const handleResetGame = () => {
    wsSend({ tipo: 'RESET_JOGO' })
  }

  // ─── Enviar fase atual quando a tela muda (alunos) ─────────
  useEffect(() => {
    if (isAdmin) return
    const faseMap = {
      'lobby_inicial': 'LOBBY_INICIAL',
      'phase1':        'FASE_1_CIFRA',
      'challenges':    'DESAFIOS_ALEATORIOS',
      'lobby_final':   'LOBBY_FINAL',
      'phase2':        'SISTEMAS_DISTRIBUIDOS',
    }
    const fase = faseMap[screen]
    if (fase) sendFaseAtual(fase)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen])

  // Background: Phase 1 + challenges + lobbies = terminal bg; Phase 2 = modern dark bg
  const bgClass = screen === 'phase2' ? 'bg-dark-bg' : 'bg-term-bg'

  return (
    <div className={`min-h-screen ${bgClass} transition-colors duration-700`}>
      {screen !== 'phase2' && <div className="terminal-scanline" />}

      <main className="relative z-10">
        {screen === 'login' && (
          <LoginScreen onLogin={handleLogin} />
        )}

        {screen === 'lobby_inicial' && (
          <LobbyScreen
            playerName={playerName}
            isAdmin={isAdmin}
            jogadores={jogadores}
            onStart={handleAdminStartMinigames}
          />
        )}

        {screen === 'admin_dashboard' && (
          <AdminDashboard
            playerName={playerName}
            jogadores={jogadores}
            estadoPartida={estadoPartida}
            onStartMinigames={handleAdminStartMinigames}
            onStartDistributed={handleAdminStartDistributed}
            onResetGame={handleResetGame}
          />
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

        {screen === 'lobby_final' && (
          <WaitingScreen
            playerName={playerName}
            isAdmin={isAdmin}
            jogadores={jogadores}
            onStartDistributed={handleAdminStartDistributed}
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
