#  Quebra de Maldição

Aplicação educacional interativa que ensina conceitos de **Criptografia** e **Sistemas Distribuídos** a alunos do 9.º ano, através de um jogo gamificado em duas fases.

##  Conceito

Os alunos acedem à aplicação pelo telemóvel e percorrem duas fases:

1. **Fase 1 — Cifra de César**: Decifram uma mensagem codificada ajustando um slider de deslocamento.
2. **Fase 2 — Força Bruta Distribuída**: Os telemóveis da turma ligam-se via WebSocket ao servidor Java e recebem, cada um, uma **palavra secreta diferente** para quebrar por força bruta, simulando um sistema distribuído real.

##  Arquitetura

```
┌─────────────────────┐        WebSocket         ┌──────────────────────┐
│   Frontend (React)  │ ◄────────────────────────►│  Backend (Spring Boot)│
│   Vite · Tailwind   │    /ghost-network         │  Java 17 · Maven     │
│   Porta 5173        │                           │  Porta 8080           │
└─────────────────────┘                           └──────────────────────┘
       Alunos                                      Master Node
```

##  Como Executar

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

entre em `http://localhost:5173` no browser ou telefone (mesma rede Wi-Fi).

##  Estrutura do Projeto

```
quebra-maldicao/
├── src/                         # Frontend React
│   ├── components/
│   │   ├── LoginScreen.jsx      # Tela de entrada (nome do aluno)
│   │   ├── Phase1Cipher.jsx     # Fase 1: Cifra de César
│   │   └── Phase2Distributed.jsx# Fase 2: Força bruta distribuída
│   ├── App.jsx                  # Router de fases
│   ├── index.css                # Estilos globais
│   └── main.jsx                 # Entry point
│
├── backend/                     # Backend Java
│   ├── pom.xml                  # Maven + Spring Boot 3.2
│   └── src/main/java/com/quebramaldicao/
│       ├── QuebraMaldicaoApplication.java
│       ├── config/              # WebSocket + CORS
│       ├── controller/          # REST: /api/health, /api/estado
│       ├── handler/             # WebSocket message router
│       ├── model/               # WorkChunk, ConnectedStudent, ChunkStatus
│       └── service/             # GameService (Job Tracker)
│
└── package.json
```

##  Palavras Secretas

Cada aluno recebe uma palavra diferente (atribuída por round-robin):

> Cachorro · Programa · Ambiente · Telefone · Controle · Dinheiro · Paisagem · Biscoito · Natureza · Pesquisa · Maldição

O espaço de procura é de **26⁸ = 208.827.064.576 combinações** de 8 letras, divididas em 94 lotes por aluno.

##  Configuração

Editável em `backend/src/main/resources/application.properties`:

| Propriedade | Default | Descrição |
|---|---|---|
| `game.num-chunks` | `94` | Lotes por aluno (~500ms cada ≈ 47s total) |
| `game.chunk-timeout-seconds` | `15` | Timeout para lotes órfãos |
| `server.port` | `8080` | Porta do servidor |

##  Segurança

- **Anti-batota**: O servidor valida todas as respostas — não aceita senhas incorretas.
- **Estado centralizado**: O progresso e o resultado pertencem exclusivamente ao servidor Java.
- **Tolerância a falhas**: Lotes sem resposta em 15s voltam à fila para reatribuição.

##  Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 · Vite · Tailwind CSS |
| Backend | Java 17 · Spring Boot 3.2 · WebSocket |
| Comunicação | WebSocket JSON (`/ghost-network`) |
| Armazenamento | Em memória (`ConcurrentHashMap`) |
