import { useState, useEffect, useRef, useCallback } from 'react'

// =========================================
// WEBSOCKET URL — Detecção dinâmica para ngrok/nginx
// =========================================
function getWebSocketUrl() {
  // Se a variável de ambiente estiver definida, usar diretamente
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL
  }

  const { protocol, host, hostname } = window.location

  // Acesso local direto (dev server) -> conectar diretamente ao backend
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'ws://localhost:8080/ghost-network'
  }

  // Acesso via ngrok/domínio externo -> usar o proxy reverso do nginx
  // O nginx roteia /api/ → localhost:8080/ (já com suporte a WebSocket)
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${host}/api/ghost-network`
}

const WS_URL = getWebSocketUrl()

// =========================================
// CONFETTI
// =========================================
function Confetti() {
  const colors = ['#6366F1', '#818CF8', '#10B981', '#34D399', '#F59E0B', '#E2E8F0']
  const particles = Array.from({ length: 35 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 2 + Math.random() * 3,
    size: 4 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
  }))

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle absolute"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            top: '-10px',
          }}
        />
      ))}
    </div>
  )
}

// =========================================
// VICTORY SCREEN
// =========================================
function VictoryScreen({ playerName, senha, stats }) {
  return (
    <div className="fixed inset-0 z-40 bg-dark-bg/95 backdrop-blur-sm flex items-center justify-center px-6">
      <Confetti />
      <div className="text-center max-w-md animate-slide-up">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-dark-success to-dark-successLight flex items-center justify-center text-4xl shadow-lg shadow-dark-success/20">
          🛡️
        </div>

        <h2 className="font-body text-3xl md:text-4xl font-bold text-dark-text mb-2">
          Palavra Quebrada!
        </h2>
        <p className="text-dark-muted text-sm mb-3">
          A força bruta encontrou a sua palavra secreta
        </p>

        {/* Palavra encontrada */}
        <div className="bg-dark-surface border border-dark-accent/30 rounded-xl p-4 mb-6 inline-block">
          <p className="text-[10px] text-dark-muted uppercase tracking-widest mb-1">Palavra Descoberta</p>
          <p className="text-dark-accent font-mono text-3xl font-bold tracking-widest">{senha}</p>
        </div>

        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-dark-accent to-transparent mx-auto mb-6" />

        <p className="text-dark-text mb-2">
          Parabéns, <span className="text-dark-accent font-semibold">{playerName}</span>!
        </p>

        <p className="text-sm text-dark-muted leading-relaxed mb-8">
          O seu dispositivo testou <span className="text-dark-accentLight">208 mil milhões</span> de
          combinações de 8 letras para encontrar a sua palavra. Cada aluno tinha
          uma palavra <span className="text-dark-accentLight">diferente</span> para descobrir!
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { value: stats.totalNos, label: 'Nós' },
            { value: stats.lotesProcessados, label: 'Lotes' },
            { value: stats.alunosConcluidos, label: 'Concluídos' },
          ].map((stat) => (
            <div key={stat.label} className="bg-dark-card border border-dark-border rounded-xl p-3">
              <p className="text-xl font-bold text-dark-accent">{stat.value}</p>
              <p className="text-[10px] text-dark-muted uppercase tracking-wider mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Educational note */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-4 text-left">
          <p className="text-xs text-dark-muted leading-relaxed">
            <span className="text-dark-success font-semibold">💡 Conceito:</span> Uma palavra de 8 letras
            tem 26⁸ = 208.827.064.576 combinações possíveis. Dividir este trabalho entre vários
            computadores é a base dos <em>Sistemas Distribuídos</em>!
          </p>
        </div>
      </div>
    </div>
  )
}

// =========================================
// WORKER: Converte string para índice numérico (base 26)
// =========================================
function stringToIndex(str, charset) {
  let index = 0
  const base = charset.length
  for (let i = 0; i < str.length; i++) {
    index = index * base + charset.indexOf(str[i])
  }
  return index
}

// =========================================
// WORKER: Converte índice numérico para string
// =========================================
function indexToString(index, charset, length) {
  let result = ''
  const base = charset.length
  for (let i = 0; i < length; i++) {
    result = charset[index % base] + result
    index = Math.floor(index / base)
  }
  return result
}

// =========================================
// WORKER: Gera string aleatória para os logs do terminal
// =========================================
function randomString(charset, length) {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += charset[Math.floor(Math.random() * charset.length)]
  }
  return result
}

// =========================================
// WORKER: Processa um chunk (O(1) — compara índice)
// O espaço de 26^8 é demasiado grande para iterar.
// Verificamos se o índice da palavra-alvo cai no intervalo.
// =========================================
function processChunk(inicio, fim, alvoSenha, charset) {
  const targetIndex = stringToIndex(alvoSenha, charset)
  if (targetIndex >= inicio && targetIndex <= fim) {
    return { encontrou: true, senha: alvoSenha }
  }
  return { encontrou: false, senha: null }
}

// =========================================
// PHASE 2 COMPONENT
// =========================================
export default function Phase2Distributed({ playerName }) {
  const [globalProgress, setGlobalProgress] = useState(0)
  const [totalNos, setTotalNos] = useState(0)
  const [alunosConcluidos, setAlunosConcluidos] = useState(0)
  const [logs, setLogs] = useState([])
  const [isVictory, setIsVictory] = useState(false)
  const [victoryData, setVictoryData] = useState({})
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [localProcessed, setLocalProcessed] = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const [totalCombinacoes, setTotalCombinacoes] = useState(0)

  const terminalRef = useRef(null)
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const heartbeatRef = useRef(null)
  const alunoIdRef = useRef(null)
  const charsetRef = useRef('abcdefghijklmnopqrstuvwxyz')
  const comprimentoRef = useRef(8)

  const addLog = useCallback((message, type = 'info') => {
    const ts = new Date().toLocaleTimeString('pt-BR', { hour12: false })
    setLogs((prev) => {
      const updated = [...prev, { ts, message, type }]
      return updated.length > 80 ? updated.slice(-80) : updated
    })
  }, [])

  // =========================================
  // WebSocket Connection
  // =========================================
  useEffect(() => {
    let isMounted = true

    function connect() {
      if (!isMounted) return

      addLog('Conectando ao servidor...', 'system')
      setConnectionStatus('connecting')

      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (!isMounted) return
        setConnectionStatus('connected')
        addLog('✓ Conexão WebSocket estabelecida', 'success')

        ws.send(JSON.stringify({ tipo: 'REGISTAR', nome: playerName }))

        // Heartbeat para manter conexão viva em abas de fundo
        if (heartbeatRef.current) clearInterval(heartbeatRef.current)
        heartbeatRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ tipo: 'PING' }))
          }
        }, 20000)
      }

      ws.onmessage = (event) => {
        if (!isMounted) return
        try {
          handleServerMessage(JSON.parse(event.data))
        } catch (e) {
          addLog(`Erro: ${e.message}`, 'error')
        }
      }

      ws.onclose = (event) => {
        if (!isMounted) return
        setConnectionStatus('disconnected')
        addLog(`Conexão perdida (código: ${event.code})`, 'error')
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMounted) { addLog('Reconectando...', 'system'); connect() }
        }, 3000)
      }

      ws.onerror = () => {
        if (!isMounted) return
        setConnectionStatus('error')
        addLog('Erro na conexão WebSocket', 'error')
      }
    }

    function handleServerMessage(data) {
      switch (data.tipo) {
        case 'REGISTO_CONFIRMADO':
          alunoIdRef.current = data.alunoId
          charsetRef.current = data.charset
          comprimentoRef.current = data.comprimento
          setTotalNos(data.totalNos)
          setTotalChunks(data.totalChunks)
          setTotalCombinacoes(data.totalCombinacoes)
          addLog(`Registado como "${data.nome}"`, 'success')
          addLog(`Espaço: ${Number(data.totalCombinacoes).toLocaleString()} combinações de ${data.comprimento} letras`, 'info')
          addLog(`${data.totalNos} nó(s) na rede`, 'info')

          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ tipo: 'PEDIR_TRABALHO', alunoId: data.alunoId }))
          }
          break

        case 'NOVO_LOTE':
          handleNovoLote(data)
          break

        case 'ATUALIZACAO_GLOBAL':
          setGlobalProgress(data.progressoPercentagem)
          setTotalNos(data.totalNos)
          setAlunosConcluidos(data.alunosConcluidos || 0)
          break

        case 'SENHA_QUEBRADA_PESSOAL':
          addLog('████████████████████████████', 'highlight')
          addLog(`✓ PALAVRA ENCONTRADA: "${data.senha}"`, 'success')
          addLog(`✓ ${data.lotesProcessados} lotes processados`, 'success')
          addLog('✓ PROCESSAMENTO CONCLUÍDO', 'success')
          setVictoryData({ senha: data.senha, lotesProcessados: data.lotesProcessados })
          setTimeout(() => setIsVictory(true), 1200)
          break

        case 'TODOS_CONCLUIDOS':
          addLog('Todos os alunos concluíram!', 'success')
          setGlobalProgress(100)
          break

        case 'FIM_DE_JOGO':
          setIsVictory(true)
          break

        case 'SEM_TRABALHO':
          addLog('Aguardando lotes...', 'system')
          setTimeout(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ tipo: 'PEDIR_TRABALHO', alunoId: alunoIdRef.current }))
            }
          }, 2000)
          break

        // Mensagens de lobby — ignorar silenciosamente na fase distribuída
        case 'REGISTO_LOBBY':
        case 'LOBBY_ATUALIZADO':
        case 'MUDAR_ESTADO':
        case 'PONG':
          break

        default:
          addLog(`Mensagem: ${data.tipo}`, 'system')
      }
    }

    function handleNovoLote(data) {
      const { chunkId, inicio, fim, alvoSenha, charset, comprimento } = data
      const cs = charset || charsetRef.current
      const len = comprimento || comprimentoRef.current

      // Mostrar intervalo no log com strings aleatórias representativas
      const startStr = indexToString(inicio, cs, len)
      const endStr = indexToString(fim, cs, len)
      addLog(`Lote #${chunkId}: "${startStr}" → "${endStr}"`, 'info')

      // Simular processamento — gerar logs falsos de "tentativas"
      const delay = 300 + Math.random() * 700
      const numFakeLogs = 2 + Math.floor(Math.random() * 3)

      // Gerar algumas tentativas "falsas" para efeito visual
      for (let i = 0; i < numFakeLogs; i++) {
        setTimeout(() => {
          addLog(`Testando "${randomString(cs, len)}"...`, 'info')
        }, (delay / numFakeLogs) * i)
      }

      setTimeout(() => {
        const result = processChunk(inicio, fim, alvoSenha, cs)
        setLocalProcessed(prev => prev + 1)

        if (result.encontrou) {
          addLog(`🔑 ENCONTRADA: "${result.senha}"!`, 'success')
        } else {
          addLog(`Lote #${chunkId} — não encontrada`, 'info')
        }

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            tipo: 'RESULTADO_LOTE',
            chunkId, encontrou: result.encontrou, senha: result.senha
          }))
        }
      }, delay)
    }

    connect()

    return () => {
      isMounted = false
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [playerName, addLog])

  // Auto-scroll
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight
  }, [logs])

  const statusConfig = {
    connecting: { color: 'bg-dark-warn', text: 'Conectando...', pulse: true },
    connected: { color: 'bg-dark-success', text: 'Conectado ao Servidor', pulse: true },
    disconnected: { color: 'bg-term-red', text: 'Desconectado', pulse: false },
    error: { color: 'bg-term-red', text: 'Erro de Conexão', pulse: false },
  }
  const status = statusConfig[connectionStatus]
  const localProgress = totalChunks > 0 ? (localProcessed / totalChunks) * 100 : 0

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text flex flex-col px-5 py-6 md:py-10 max-w-lg mx-auto">
      {isVictory && (
        <VictoryScreen
          playerName={playerName}
          senha={victoryData.senha}
          stats={{ totalNos, lotesProcessados: victoryData.lotesProcessados || localProcessed, alunosConcluidos }}
        />
      )}

      {/* Header */}
      <div className="mb-5 animate-fade-in">
        <p className="text-[10px] font-mono text-dark-muted uppercase tracking-widest mb-1">Fase 2 — Sistemas Distribuídos</p>
        <h1 className="font-body text-2xl md:text-3xl font-bold text-dark-text">Processamento em Rede</h1>
      </div>

      {/* Description */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <p className="text-sm text-dark-muted leading-relaxed">
          <span className="text-dark-accent font-semibold">{playerName}</span>, cada dispositivo recebeu
          uma <span className="text-dark-warn font-semibold">palavra secreta diferente</span>.
          O seu celular está a testar{' '}
          <span className="text-dark-warn font-semibold">
            {totalCombinacoes > 0 ? Number(totalCombinacoes).toLocaleString() : '...'} combinações
          </span>{' '}
          de 8 letras para encontrar a sua!
        </p>
      </div>

      {/* Network status */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-2.5 h-2.5 rounded-full ${status.color} ${status.pulse ? 'animate-pulse-slow' : ''} shadow-[0_0_8px_rgba(16,185,129,0.5)]`} />
            <span className={`text-sm font-medium ${connectionStatus === 'connected' ? 'text-dark-success' : connectionStatus === 'connecting' ? 'text-dark-warn' : 'text-term-red'}`}>
              {status.text}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`w-1 rounded-full ${connectionStatus === 'connected' ? 'bg-dark-success' : 'bg-dark-subtle'}`} style={{ height: `${i * 3 + 4}px` }} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-border">
          <span className="text-xs text-dark-muted">Dispositivos na rede</span>
          <span className="text-sm font-semibold text-dark-text">{totalNos} nó{totalNos !== 1 ? 's' : ''}</span>
        </div>
        {alunosConcluidos > 0 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-border">
            <span className="text-xs text-dark-muted">Palavras descobertas</span>
            <span className="text-sm font-semibold text-dark-success">{alunosConcluidos}/{totalNos}</span>
          </div>
        )}
      </div>

      {/* Progress bars */}
      <div className="space-y-4 mb-5 animate-slide-up" style={{ animationDelay: '0.3s' }}>
        {/* Local */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-dark-muted">Sua Palavra (Nó Local)</span>
            <span className={`text-[10px] font-mono font-semibold ${isVictory ? 'text-dark-success' : 'text-dark-warn'}`}>
              {isVictory ? 'ENCONTRADA ✓' : localProcessed > 0 ? `${localProcessed}/${totalChunks}` : 'ATIVO'}
            </span>
          </div>
          <div className="h-2.5 bg-dark-surface rounded-full overflow-hidden border border-dark-border">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-linear ${localProcessed === 0 && !isVictory ? 'local-progress-bar bg-gradient-to-r from-dark-warn to-amber-400' : ''}`}
              style={localProcessed > 0 || isVictory ? {
                width: `${isVictory ? 100 : localProgress}%`,
                background: isVictory ? 'linear-gradient(to right, #10B981, #34D399)' : 'linear-gradient(to right, #F59E0B, #FBBF24)',
              } : {}}
            />
          </div>
          <p className="text-[10px] text-dark-subtle mt-1">
            {localProcessed > 0 ? `${localProcessed}/${totalChunks} lotes processados` : 'Força bruta — testando combinações de 8 letras'}
          </p>
        </div>

        {/* Global */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-dark-muted">Processamento da Turma (Global)</span>
            <span className={`text-[10px] font-mono font-semibold ${globalProgress >= 100 ? 'text-dark-success' : 'text-dark-accent'}`}>
              {Math.floor(globalProgress)}%
            </span>
          </div>
          <div className="h-2.5 bg-dark-surface rounded-full overflow-hidden border border-dark-border">
            <div
              className="h-full rounded-full transition-all duration-200 ease-linear"
              style={{
                width: `${globalProgress}%`,
                background: globalProgress >= 100
                  ? 'linear-gradient(to right, #10B981, #34D399)'
                  : 'linear-gradient(to right, #6366F1, #818CF8)',
              }}
            />
          </div>
          <p className="text-[10px] text-dark-subtle mt-1">
            {globalProgress < 100
              ? `${alunosConcluidos}/${totalNos} palavras descobertas — cada nó com palavra diferente`
              : '✓ Todas as palavras encontradas!'}
          </p>
        </div>
      </div>

      {/* Terminal */}
      <div className="flex-1 min-h-0 animate-slide-up" style={{ animationDelay: '0.4s' }}>
        <div className="bg-dark-surface border border-dark-border rounded-xl overflow-hidden h-full flex flex-col">
          <div className="px-4 py-2 flex items-center justify-between border-b border-dark-border bg-dark-card">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-term-red/60" />
                <div className="w-2 h-2 rounded-full bg-term-amber/60" />
                <div className="w-2 h-2 rounded-full bg-dark-success/60" />
              </div>
              <span className="text-[10px] text-dark-muted font-mono ml-1">brute_force.log</span>
            </div>
            <span className={`text-[10px] ${connectionStatus === 'connected' ? 'text-dark-success' : 'text-term-red'} animate-blink font-mono`}>●</span>
          </div>

          <div
            ref={terminalRef}
            className="terminal-scroll flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed"
            style={{ maxHeight: '220px', minHeight: '160px' }}
          >
            {logs.map((log, i) => (
              <div key={i} className={
                log.type === 'success' ? 'text-dark-success font-semibold' :
                  log.type === 'error' ? 'text-term-red' :
                    log.type === 'highlight' ? 'text-dark-accent' :
                      log.type === 'system' ? 'text-dark-warn' : 'text-dark-subtle'
              }>
                {log.ts}  {log.message}
              </div>
            ))}
            {!isVictory && <span className="text-dark-accent animate-blink">▊</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
