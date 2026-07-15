# Quebra de Maldição — Arquitetura de Computadores II

Aplicação educacional interativa que ensina conceitos de **Criptografia** e **Sistemas Distribuídos** através de um jogo gamificado com estética dark/terminal, acessível pelo celular.

## Conceito

Os alunos acessam a aplicação pelo celular e percorrem fases sincronizadas pelo professor (Admin):

1. **Login** — Tela de entrada com nome do aluno.
2. **Lobby Inicial** — Sala de espera onde todos aguardam o professor iniciar.
3. **Fase 1 — Cifra de César** — Decifram uma mensagem codificada ajustando um slider de deslocamento. Cada aluno recebe uma **palavra e shift aleatórios**.
4. **Mini-Enigmas Aleatórios** — 3 desafios sorteados de um pool (Load Balancer, Enigma Macabro, Lógica de Sequência).
5. **Lobby Final** — Sala de espera pós-minijogos onde alunos aguardam os colegas terminarem.
6. **Fase 2 — Força Bruta Distribuída** — Os celulares conectam-se via WebSocket ao servidor Java e recebem, cada um, uma **senha alfanumérica aleatória de 8 caracteres** para quebrar, simulando um sistema distribuído real.

## Arquitetura

```
┌─────────────────────┐                          ┌──────────────────────┐
│   Frontend (React)  │        WebSocket          │  Backend (Spring Boot)│
│   Vite · Tailwind   │ ◄───────────────────────► │  Java 17 · Maven     │
│   Porta 5173        │   /ghost-network          │  Porta 8080           │
└─────────────────────┘                           └──────────────────────┘
       Alunos                                      Master Node
```

### Fluxo de Estados (controlado pelo Admin)

```
LOBBY_INICIAL  ──► JOGANDO_MINIGAMES  ──► LOBBY_FINAL  ──► SISTEMAS_DISTRIBUIDOS
   (Admin: Iniciar)                       (Admin: Iniciar Quebra)
```

## Como Executar

### Pré-requisitos

- **Node.js** 18+
- **Java** 17+
- **Maven** 3.8+

### Backend (Terminal 1)

```bash
cd backend
mvn clean package -DskipTests
java -jar target/quebra-maldicao-api-1.0.0.jar
```

### Frontend (Terminal 2)

```bash
npm install
npm run dev
```

Acesse `http://localhost:5173` no browser ou celular (mesma rede Wi-Fi).

## Modo Admin (Professor)

O professor controla o fluxo do jogo através de um mecanismo oculto:

1. Na tela de login, **clique 3 vezes rapidamente** (< 600ms) no título `interceptor — CipherNet` (barra superior do terminal).
2. Um banner amarelo `⚡ Modo Admin ativo` aparece e o botão muda para `[ ENTRAR COMO ADMIN ]`.
3. No **Lobby Inicial**, o Admin vê o botão `Iniciar Minijogos`.
4. No **Lobby Final**, o Admin vê quem já terminou e tem o botão `Iniciar Quebra de Senha`.

> O mecanismo é invisível para os alunos — não há botões visíveis.

## Estrutura do Projeto

```
quebra-maldicao/
├── src/                              # Frontend React
│   ├── components/
│   │   ├── LoginScreen.jsx           # Login + mecanismo oculto de Admin
│   │   ├── LobbyScreen.jsx          # Lobby inicial (lista de alunos + botão Admin)
│   │   ├── Phase1Cipher.jsx          # Fase 1: Cifra de César
│   │   ├── RandomChallengeManager.jsx# Gerenciador de desafios aleatórios
│   │   ├── WaitingScreen.jsx         # Lobby final (pós-minijogos)
│   │   ├── Phase2Distributed.jsx     # Fase 2: Força bruta distribuída
│   │   └── challenges/              # Mini-enigmas modulares
│   │       ├── ChallengeHexDecode.jsx
│   │       ├── ChallengeLoadBalancer.jsx
│   │       ├── ChallengeRiddle.jsx
│   │       └── ChallengeTerminalLogic.jsx
│   ├── App.jsx                       # Router + WebSocket central de lobby
│   ├── index.css                     # Estilos globais
│   └── main.jsx                      # Entry point
│
├── backend/                          # Backend Java
│   ├── pom.xml                       # Maven + Spring Boot 3.2
│   └── src/main/java/com/quebramaldicao/
│       ├── QuebraMaldicaoApplication.java
│       ├── config/                   # WebSocket + CORS
│       ├── controller/               # REST: /api/health, /api/estado, /api/reset
│       ├── handler/                  # WebSocket message router
│       ├── model/                    # WorkChunk, ConnectedStudent, ChunkStatus, GameState
│       └── service/                  # GameService (Job Tracker + Lobby Manager)
│
├── test-ws.js                        # Teste de carga k6 (com suporte a lobby)
├── vite.config.js
└── package.json
```

## Protocolo WebSocket — Mensagens de Lobby

### Cliente → Servidor

| Tipo | Payload | Quem |
|---|---|---|
| `REGISTAR` | `{ nome, isAdmin }` | Todos |
| `ADMIN_INICIAR_MINIGAMES` | `{}` | Admin |
| `MINIGAMES_CONCLUIDOS` | `{}` | Aluno |
| `ADMIN_INICIAR_DISTRIBUIDO` | `{}` | Admin |

### Servidor → Cliente

| Tipo | Payload | Destino |
|---|---|---|
| `REGISTO_LOBBY` | `{ alunoId, nome, isAdmin, estadoPartida }` | Individual |
| `LOBBY_ATUALIZADO` | `{ jogadores[], totalJogadores, minigamesConcluidos }` | Broadcast |
| `MUDAR_ESTADO` | `{ novoEstado }` | Broadcast |

## Senhas Alfanuméricas

Cada aluno recebe uma **senha alfanumérica aleatória de 8 caracteres** gerada no momento do registro (ex: `k9f2m1xp`, `ab3z7w2q`).

- **Charset**: `a-z0-9` (36 caracteres)
- **Espaço de procura**: **36⁸ = 2.821.109.907.456 combinações** (~2,8 trilhões)
- **Lotes por aluno**: 94 (configurável)
- Cada aluno recebe uma senha **única** — não há repetição

## Desafios Aleatórios (Fase Intermediária)

O `RandomChallengeManager` sorteia 3 desafios de um pool modular:

| Desafio | Descrição |
|---|---|
| **Load Balancer** | Distribuir requisições entre servidores |
| **Enigma Macabro** | Resolver charadas temáticas |
| **Lógica de Sequência** | Completar padrões lógicos no terminal |

Para adicionar um novo desafio, crie o componente em `src/components/challenges/` (com prop `onSolve`) e registre-o no `CHALLENGE_REGISTRY` do `RandomChallengeManager.jsx`.

## Teste de Carga (k6)

```bash
# Teste padrão (alunos sem lobby)
k6 run test-ws.js

# Teste com fluxo completo de lobby (1 Admin + alunos)
k6 run -e SIMULATE_ADMIN=true test-ws.js

# URL customizada
k6 run -e WS_URL=wss://meu-dominio.com/api/ghost-network test-ws.js
```

## Configuração

Editável em `backend/src/main/resources/application.properties`:

| Propriedade | Default | Descrição |
|---|---|---|
| `game.num-chunks` | `94` | Lotes por aluno (~500ms cada ≈ 47s total) |
| `game.chunk-timeout-seconds` | `240` | Timeout para lotes órfãos |
| `server.port` | `8080` | Porta do servidor |

## Segurança

- **Anti-batota**: O servidor valida todas as respostas — não aceita senhas incorretas.
- **Estado centralizado**: O progresso e o resultado pertencem exclusivamente ao servidor Java.
- **Tolerância a falhas**: Lotes sem resposta no tempo configurado voltam à fila.
- **Admin protegido**: Apenas sessões com flag `isAdmin` podem mudar o estado da partida.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 · Vite · Tailwind CSS |
| Backend | Java 17 · Spring Boot 3.2 · WebSocket |
| Comunicação | WebSocket JSON (`/ghost-network`) |
| Armazenamento | Em memória (`ConcurrentHashMap`) |
| Testes de Carga | k6 |
