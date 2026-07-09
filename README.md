# Quebra de Maldição — Arquitetura de Computadores II

Aplicação educacional interativa que ensina conceitos de **Criptografia** e **Sistemas Distribuídos** através de um jogo gamificado com estética dark/terminal, acessível pelo celular.

## Conceito

Os alunos acessam a aplicação pelo celular e percorrem quatro fases:

1. **Login** — Tela de entrada com nome do aluno.
2. **Fase 1 — Cifra de César** — Decifram uma mensagem codificada ajustando um slider de deslocamento. Cada aluno recebe uma **palavra e shift aleatórios**, tornando o desafio único.
3. **Mini-Enigmas Aleatórios** — 3 desafios sorteados de um pool (Decodificação Hex, Enigma Macabro, Lógica de Sequência) que devem ser resolvidos em sequência.
4. **Fase 2 — Força Bruta Distribuída** — Os celulares da turma conectam-se via WebSocket ao servidor Java e recebem, cada um, uma **senha alfanumérica aleatória de 8 caracteres** para quebrar por força bruta, simulando um sistema distribuído real.

## Arquitetura

```
┌─────────────────────┐                          ┌──────────────────────┐
│   Frontend (React)  │        WebSocket          │  Backend (Spring Boot)│
│   Vite · Tailwind   │ ◄───────────────────────► │  Java 17 · Maven     │
│   Porta 5173        │   /ghost-network          │  Porta 8080           │
└─────────────────────┘                           └──────────────────────┘
       Alunos                                      Master Node
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

## Estrutura do Projeto

```
quebra-maldicao/
├── src/                              # Frontend React
│   ├── components/
│   │   ├── LoginScreen.jsx           # Tela de entrada (nome do aluno)
│   │   ├── Phase1Cipher.jsx          # Fase 1: Cifra de César (palavra + shift aleatórios)
│   │   ├── RandomChallengeManager.jsx# Gerenciador de desafios aleatórios
│   │   ├── Phase2Distributed.jsx     # Fase 2: Força bruta distribuída
│   │   └── challenges/              # Mini-enigmas modulares
│   │       ├── ChallengeHexDecode.jsx    # Decodificação hexadecimal
│   │       ├── ChallengeRiddle.jsx       # Enigma temático
│   │       └── ChallengeTerminalLogic.jsx# Lógica de sequência
│   ├── App.jsx                       # Router de fases
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
│       ├── model/                    # WorkChunk, ConnectedStudent, ChunkStatus
│       └── service/                  # GameService (Job Tracker)
│
├── vite.config.js                    # Config Vite 
└── package.json
```

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
| **Decodificação Hex** | Converter valores hexadecimais para texto |
| **Enigma Macabro** | Resolver charadas temáticas |
| **Lógica de Sequência** | Completar padrões lógicos no terminal |

Para adicionar um novo desafio, basta criar o componente em `src/components/challenges/` (com prop `onSolve`) e registrá-lo no array `CHALLENGE_REGISTRY` do `RandomChallengeManager.jsx`.

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
- **Tolerância a falhas**: Lotes sem resposta no tempo configurado voltam à fila para reatribuição.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 · Vite · Tailwind CSS |
| Backend | Java 17 · Spring Boot 3.2 · WebSocket |
| Comunicação | WebSocket JSON (`/ghost-network`) |
| Armazenamento | Em memória (`ConcurrentHashMap`) |
