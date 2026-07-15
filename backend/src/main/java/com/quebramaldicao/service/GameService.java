package com.quebramaldicao.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.quebramaldicao.model.ChunkStatus;
import com.quebramaldicao.model.ConnectedStudent;
import com.quebramaldicao.model.GameState;
import com.quebramaldicao.model.WorkChunk;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Motor do Sistema Distribuído — O "Job Tracker".
 *
 * Cada aluno recebe uma senha alfanumérica aleatória de 8 caracteres
 * e deve quebrá-la via força bruta sobre o espaço de 36^8 ≈ 2.8 trilhões de combinações.
 *
 * Agora também gerencia o estado global da partida (lobby/sincronização).
 */
@Service
public class GameService {

    private static final Logger log = LoggerFactory.getLogger(GameService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    // =====================================================
    // Charset e configuração
    // =====================================================

    /** Charset para a força bruta: letras minúsculas + dígitos (36 caracteres) */
    private static final String CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";

    /** Comprimento fixo das senhas (8 caracteres alfanuméricos) */
    private static final int WORD_LENGTH = 8;

    // =====================================================
    // Configuração
    // =====================================================

    @Value("${game.num-chunks:94}")
    private int numChunks;

    @Value("${game.chunk-timeout-seconds:15}")
    private int chunkTimeoutSeconds;

    /** Tamanho total do espaço de procura: 26^8 */
    private long totalSearchSpace;

    /** Tamanho de cada chunk */
    private long chunkSize;

    // =====================================================
    // Estado Global da Partida
    // =====================================================

    /** Estado atual da partida — controlado pelo Admin. */
    private volatile GameState estadoPartida = GameState.LOBBY_INICIAL;

    // =====================================================
    // Estado em memória (thread-safe)
    // =====================================================

    private final ConcurrentHashMap<String, ConnectedStudent> students = new ConcurrentHashMap<>();

    // =====================================================
    // Inicialização
    // =====================================================

    @PostConstruct
    public void init() {
        totalSearchSpace = (long) Math.pow(CHARSET.length(), WORD_LENGTH);
        chunkSize = totalSearchSpace / numChunks;

        log.info("=== QUEBRA DE MALDIÇÃO API INICIADA ===");
        log.info("Charset: a-z0-9 ({} caracteres)", CHARSET.length());
        log.info("Comprimento da senha: {}", WORD_LENGTH);
        log.info("Espaço de procura: {} combinações (36^8)", String.format("%,d", totalSearchSpace));
        log.info("Chunks por aluno: {}", numChunks);
        log.info("Tamanho do chunk: {} combinações", String.format("%,d", chunkSize));
        log.info("Timeout de lote: {}s", chunkTimeoutSeconds);
    }

    // =====================================================
    // Geração de Senhas Aleatórias
    // =====================================================

    /**
     * Gera uma senha alfanumérica aleatória de 8 caracteres.
     * Cada aluno recebe uma senha única.
     * Retorna [normalizada, display] (ambas iguais, pois são alfanuméricas).
     */
    private String[] gerarSenhaAleatoria() {
        StringBuilder sb = new StringBuilder(WORD_LENGTH);
        ThreadLocalRandom rng = ThreadLocalRandom.current();
        for (int i = 0; i < WORD_LENGTH; i++) {
            sb.append(CHARSET.charAt(rng.nextInt(CHARSET.length())));
        }
        String senha = sb.toString();
        return new String[]{senha, senha};
    }

    /**
     * Converte uma palavra normalizada para o seu índice no espaço de procura.
     * Ex: "cachorro" → índice numérico usando base 26.
     */
    private long palavraParaIndice(String palavra) {
        long index = 0;
        int base = CHARSET.length();
        for (int i = 0; i < palavra.length(); i++) {
            int charPos = CHARSET.indexOf(palavra.charAt(i));
            if (charPos < 0) charPos = 0; // fallback
            index = index * base + charPos;
        }
        return index;
    }

    /**
     * Converte um índice numérico para a string correspondente.
     */
    private String indiceParaPalavra(long index) {
        char[] result = new char[WORD_LENGTH];
        int base = CHARSET.length();
        for (int i = WORD_LENGTH - 1; i >= 0; i--) {
            result[i] = CHARSET.charAt((int) (index % base));
            index /= base;
        }
        return new String(result);
    }

    /**
     * Cria a fila de chunks para um aluno.
     */
    private void criarChunksParaAluno(ConnectedStudent student) {
        student.getChunks().clear();
        for (int i = 0; i < numChunks; i++) {
            long start = (long) i * chunkSize;
            long end = (i == numChunks - 1) ? totalSearchSpace - 1 : start + chunkSize - 1;
            student.getChunks().add(new WorkChunk(i, start, end));
        }
    }

    // =====================================================
    // Gestão de Sessões (com suporte a Admin)
    // =====================================================

    /**
     * Regista um aluno (ou Admin) no jogo.
     * @param isAdmin true se o jogador ativou o modo Admin no frontend
     */
    public String registarAluno(WebSocketSession session, String nome, boolean isAdmin) {
        String alunoId = UUID.randomUUID().toString();
        ConnectedStudent student = new ConnectedStudent(alunoId, nome, session);
        student.setAdmin(isAdmin);

        // Gerar senha alfanumérica aleatória para este aluno
        String[] senha = gerarSenhaAleatoria();
        student.setTargetPassword(senha[0]);  // normalizada
        student.setDisplayPassword(senha[1]); // para exibição

        // Criar chunks
        criarChunksParaAluno(student);

        students.put(session.getId(), student);

        log.info("✦ {} conectado: {} (ID: {}) — Senha: '{}' — Total nós: {}",
                isAdmin ? "ADMIN" : "Aluno", nome, alunoId, senha[1], students.size());

        // Enviar confirmação individual com o estado atual da partida
        enviarParaSessao(session, criarMensagemRegistoLobby(student));

        // Se estamos na fase distribuída, enviar também REGISTO_CONFIRMADO
        // para que o Phase2Distributed possa iniciar o trabalho de força bruta
        if (estadoPartida == GameState.SISTEMAS_DISTRIBUIDOS) {
            enviarParaSessao(session, criarMensagemRegisto(student));
        }

        // Broadcast atualização do lobby para todos
        broadcastLobbyAtualizado();

        return alunoId;
    }

    /** Mantém compatibilidade com o método antigo (sem flag admin). */
    public String registarAluno(WebSocketSession session, String nome) {
        return registarAluno(session, nome, false);
    }

    public void removerAluno(WebSocketSession session) {
        ConnectedStudent student = students.get(session.getId());
        if (student == null) return;

        // Na fase distribuída, o lobby WS fecha e o Phase2 WS reconecta logo a seguir.
        // Não remover o aluno para evitar "0 nós" transitório — o Phase2 vai
        // re-registar com uma nova sessão imediatamente.
        if (estadoPartida == GameState.SISTEMAS_DISTRIBUIDOS) {
            log.info("✦ Sessão lobby fechada (fase distribuída — não removido): {}", student.getNome());
            students.remove(session.getId());
            // Sem broadcast — evita flicker de "0 nós"
            return;
        }

        students.remove(session.getId());
        log.info("✦ Aluno desconectado: {} — Restam: {}", student.getNome(), students.size());
        broadcastLobbyAtualizado();
    }

    public ConnectedStudent obterAluno(WebSocketSession session) {
        return students.get(session.getId());
    }

    // =====================================================
    // Atualização de Fase e Heartbeat
    // =====================================================

    /**
     * Atualiza a fase/tela atual de um aluno (para monitoramento do Admin).
     */
    public void atualizarFase(WebSocketSession session, String fase) {
        ConnectedStudent student = students.get(session.getId());
        if (student != null) {
            student.setFaseAtual(fase);
            broadcastLobbyAtualizado();
        }
    }

    /**
     * Responde a um PING com PONG para manter a conexão viva.
     */
    public void handlePing(WebSocketSession session) {
        enviarParaSessao(session, "{\"tipo\":\"PONG\"}");
    }

    // =====================================================
    // Controle de Estado Global (Admin)
    // =====================================================

    /**
     * Admin inicia os minijogos: LOBBY_INICIAL → JOGANDO_MINIGAMES.
     * Faz broadcast para todos os clientes mudarem de tela.
     */
    public synchronized void iniciarMinigames(WebSocketSession adminSession) {
        ConnectedStudent admin = students.get(adminSession.getId());
        if (admin == null || !admin.isAdmin()) {
            log.warn(" Tentativa de iniciar minijogos por não-admin: {}", adminSession.getId());
            return;
        }

        if (estadoPartida != GameState.LOBBY_INICIAL) {
            log.warn(" Estado inválido para iniciar minijogos: {}", estadoPartida);
            return;
        }

        estadoPartida = GameState.JOGANDO_MINIGAMES;
        log.info(" MINIJOGOS INICIADOS pelo Admin {} — {} alunos", admin.getNome(), students.size());

        broadcastMudarEstado(GameState.JOGANDO_MINIGAMES);
    }

    /**
     * Um aluno concluiu os minijogos: entra no LOBBY_FINAL.
     */
    public synchronized void marcarMinigamesConcluidos(WebSocketSession session) {
        ConnectedStudent student = students.get(session.getId());
        if (student == null) return;

        if (estadoPartida != GameState.JOGANDO_MINIGAMES) {
            log.warn(" Aluno {} tentou concluir minigames fora do estado correto: {}",
                    student.getNome(), estadoPartida);
            return;
        }

        student.setMinigamesConcluidos(true);
        log.info("✓ {} concluiu os minijogos — {}/{} concluíram",
                student.getNome(), contarMinigamesConcluidos(), students.size());

        // Enviar para o aluno que ele agora está no lobby final
        enviarParaSessao(session, criarMensagemMudarEstado(GameState.LOBBY_FINAL));

        // Broadcast atualização do lobby para todos (Admin vê quem terminou)
        broadcastLobbyAtualizado();
    }

    /**
     * Admin inicia a fase distribuída: JOGANDO_MINIGAMES/LOBBY_FINAL → SISTEMAS_DISTRIBUIDOS.
     * Faz broadcast para todos os clientes montarem Phase2Distributed.
     */
    public synchronized void iniciarDistribuido(WebSocketSession adminSession) {
        ConnectedStudent admin = students.get(adminSession.getId());
        if (admin == null || !admin.isAdmin()) {
            log.warn(" Tentativa de iniciar distribuído por não-admin: {}", adminSession.getId());
            return;
        }

        // Aceitar transição tanto de JOGANDO_MINIGAMES quanto de LOBBY_FINAL
        if (estadoPartida != GameState.JOGANDO_MINIGAMES && estadoPartida != GameState.LOBBY_FINAL) {
            log.warn(" Estado inválido para iniciar distribuído: {}", estadoPartida);
            return;
        }

        estadoPartida = GameState.SISTEMAS_DISTRIBUIDOS;
        log.info("🌐 SISTEMAS DISTRIBUÍDOS INICIADOS pelo Admin {} — {} alunos",
                admin.getNome(), students.size());

        broadcastMudarEstado(GameState.SISTEMAS_DISTRIBUIDOS);
    }

    /**
     * Retorna o estado atual da partida.
     */
    public GameState getEstadoPartida() {
        return estadoPartida;
    }

    // =====================================================
    // Distribuição de Trabalho
    // =====================================================

    public synchronized void atribuirTrabalho(WebSocketSession session) {
        ConnectedStudent student = students.get(session.getId());
        if (student == null) return;

        if (student.isSenhaEncontrada()) {
            enviarParaSessao(session, criarMensagemFimDeJogo(student));
            return;
        }

        WorkChunk chunk = null;
        for (WorkChunk c : student.getChunks()) {
            if (c.getStatus() == ChunkStatus.PENDENTE) {
                chunk = c;
                break;
            }
        }

        if (chunk == null) {
            enviarParaSessao(session, criarMensagemSemTrabalho());
            return;
        }

        chunk.atribuirPara(student.getId());

        log.info("→ Lote {} atribuído a {} [{}..{}]",
                chunk.getId(), student.getNome(),
                indiceParaPalavra(chunk.getInicio()),
                indiceParaPalavra(chunk.getFim()));

        enviarParaSessao(session, criarMensagemNovoLote(chunk, student));
    }

    // =====================================================
    // Receção de Resultados
    // =====================================================

    public synchronized void processarResultado(WebSocketSession session,
                                                  int chunkId,
                                                  boolean encontrou,
                                                  String senhaCandidata) {
        ConnectedStudent student = students.get(session.getId());
        if (student == null) return;

        WorkChunk chunk = null;
        if (chunkId >= 0 && chunkId < student.getChunks().size()) {
            chunk = student.getChunks().get(chunkId);
        }

        if (chunk == null || chunk.getStatus() != ChunkStatus.EM_PROCESSAMENTO) {
            log.warn(" Resultado inválido do aluno {} para chunk {}", student.getNome(), chunkId);
            return;
        }

        if (encontrou && senhaCandidata != null) {

            boolean senhaValida = validarSenha(student, senhaCandidata);

            if (senhaValida) {
                chunk.concluir();
                student.incrementarLotesProcessados();
                student.setSenhaEncontrada(true);

                log.info(" PALAVRA ENCONTRADA por {} — '{}'",
                        student.getNome(), student.getDisplayPassword());

                enviarParaSessao(session, criarMensagemVitoriaPessoal(student));
                broadcastEstadoGlobal();
                verificarTodosConcluidos();
            } else {
                log.warn(" BATOTA! Aluno {} enviou '{}' (esperada: '{}')",
                        student.getNome(), senhaCandidata, student.getTargetPassword());
                chunk.concluir();
                student.incrementarLotesProcessados();
                broadcastEstadoGlobal();
                atribuirTrabalho(session);
            }
        } else {
            chunk.concluir();
            student.incrementarLotesProcessados();

            log.info("✓ Lote {} de {} — Progresso: {}%",
                    chunkId, student.getNome(),
                    String.format("%.1f", student.calcularProgresso()));

            broadcastEstadoGlobal();
            atribuirTrabalho(session);
        }
    }

    // =====================================================
    // Validação Anti-Batota
    // =====================================================

    private boolean validarSenha(ConnectedStudent student, String senhaCandidata) {
        return student.getTargetPassword().equals(senhaCandidata.trim().toLowerCase());
    }

    // =====================================================
    // Tolerância a Falhas
    // =====================================================

    @Scheduled(fixedRate = 5000)
    public void verificarTimeouts() {
        Instant agora = Instant.now();
        int totalReatribuidos = 0;

        for (ConnectedStudent student : students.values()) {
            if (student.isSenhaEncontrada()) continue;

            for (WorkChunk chunk : student.getChunks()) {
                if (chunk.getStatus() == ChunkStatus.EM_PROCESSAMENTO
                        && chunk.getAtribuidoEm() != null) {
                    Duration tempo = Duration.between(chunk.getAtribuidoEm(), agora);
                    if (tempo.getSeconds() >= chunkTimeoutSeconds) {
                        log.info("⏱ Timeout! Lote {} do aluno {} — {}s",
                                chunk.getId(), student.getNome(), tempo.getSeconds());
                        chunk.resetar();
                        totalReatribuidos++;
                    }
                }
            }
        }

        if (totalReatribuidos > 0) {
            log.info("↻ {} lotes órfãos retornados à fila", totalReatribuidos);
        }
    }

    // =====================================================
    // Verificação de Conclusão Global
    // =====================================================

    private void verificarTodosConcluidos() {
        if (students.isEmpty()) return;
        boolean todos = students.values().stream().allMatch(ConnectedStudent::isSenhaEncontrada);
        if (todos) {
            log.info(" TODOS OS ALUNOS CONCLUÍRAM!");
            broadcast(criarMensagemTodosConcluidos());
        }
    }

    // =====================================================
    // Contadores auxiliares
    // =====================================================

    private long contarMinigamesConcluidos() {
        return students.values().stream()
                .filter(ConnectedStudent::isMinigamesConcluidos)
                .count();
    }

    // =====================================================
    // Reset do Jogo
    // =====================================================

    public synchronized void resetarJogo() {
        estadoPartida = GameState.LOBBY_INICIAL;

        for (ConnectedStudent student : students.values()) {
            // Gerar nova senha aleatória para cada aluno
            String[] senha = gerarSenhaAleatoria();
            student.setTargetPassword(senha[0]);
            student.setDisplayPassword(senha[1]);
            student.setSenhaEncontrada(false);
            student.setMinigamesConcluidos(false);
            criarChunksParaAluno(student);
        }
        log.info(" Jogo reiniciado — {} alunos com novas senhas", students.size());
        broadcastMudarEstado(GameState.LOBBY_INICIAL);
        broadcastLobbyAtualizado();
    }

    // =====================================================
    // Cálculos de Progresso
    // =====================================================

    private double calcularProgressoGlobal() {
        if (students.isEmpty()) return 0.0;
        long totalChunks = 0;
        long totalConcluidos = 0;
        for (ConnectedStudent s : students.values()) {
            totalChunks += s.getChunks().size();
            totalConcluidos += s.contarChunksConcluidos();
        }
        if (totalChunks == 0) return 0.0;
        return (totalConcluidos * 100.0) / totalChunks;
    }

    private long contarAlunosConcluidos() {
        return students.values().stream()
                .filter(ConnectedStudent::isSenhaEncontrada)
                .count();
    }

    // =====================================================
    // Construção de Mensagens JSON — Lobby
    // =====================================================

    /**
     * Mensagem de confirmação de registo no lobby (enviada apenas ao aluno que se registou).
     */
    private String criarMensagemRegistoLobby(ConnectedStudent student) {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "REGISTO_LOBBY");
        msg.put("alunoId", student.getId());
        msg.put("nome", student.getNome());
        msg.put("isAdmin", student.isAdmin());
        msg.put("estadoPartida", estadoPartida.name());
        return msg.toString();
    }

    /**
     * Broadcast: atualização do lobby (lista de jogadores, estado da partida).
     * Enviado a TODOS sempre que alguém entra/sai ou muda o estado.
     */
    private String criarMensagemLobbyAtualizado() {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "LOBBY_ATUALIZADO");
        msg.put("estadoPartida", estadoPartida.name());
        msg.put("totalJogadores", students.size());
        msg.put("minigamesConcluidos", contarMinigamesConcluidos());

        ArrayNode jogadores = objectMapper.createArrayNode();
        for (ConnectedStudent s : students.values()) {
            ObjectNode jogador = objectMapper.createObjectNode();
            jogador.put("id", s.getId());
            jogador.put("nome", s.getNome());
            jogador.put("isAdmin", s.isAdmin());
            jogador.put("minigamesConcluidos", s.isMinigamesConcluidos());
            jogador.put("senhaEncontrada", s.isSenhaEncontrada());
            jogador.put("faseAtual", s.getFaseAtual());
            jogadores.add(jogador);
        }
        msg.set("jogadores", jogadores);

        return msg.toString();
    }

    /**
     * Broadcast: mudança de estado global da partida.
     */
    private String criarMensagemMudarEstado(GameState novoEstado) {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "MUDAR_ESTADO");
        msg.put("novoEstado", novoEstado.name());
        return msg.toString();
    }

    // =====================================================
    // Construção de Mensagens JSON — Jogo Distribuído
    // =====================================================

    private String criarMensagemRegisto(ConnectedStudent student) {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "REGISTO_CONFIRMADO");
        msg.put("alunoId", student.getId());
        msg.put("nome", student.getNome());
        msg.put("totalNos", students.size());
        msg.put("charset", CHARSET);
        msg.put("comprimento", WORD_LENGTH);
        msg.put("totalChunks", numChunks);
        msg.put("totalCombinacoes", totalSearchSpace);
        return msg.toString();
    }

    private String criarMensagemNovoLote(WorkChunk chunk, ConnectedStudent student) {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "NOVO_LOTE");
        msg.put("chunkId", chunk.getId());
        msg.put("inicio", chunk.getInicio());
        msg.put("fim", chunk.getFim());
        msg.put("alvoSenha", student.getTargetPassword());
        msg.put("charset", CHARSET);
        msg.put("comprimento", WORD_LENGTH);
        return msg.toString();
    }

    private String criarMensagemSemTrabalho() {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "SEM_TRABALHO");
        msg.put("mensagem", "Aguarde...");
        return msg.toString();
    }

    private String criarMensagemFimDeJogo(ConnectedStudent student) {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "FIM_DE_JOGO");
        msg.put("senha", student.getDisplayPassword());
        msg.put("concluido", true);
        return msg.toString();
    }

    private String criarMensagemVitoriaPessoal(ConnectedStudent student) {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "SENHA_QUEBRADA_PESSOAL");
        msg.put("senha", student.getDisplayPassword());
        msg.put("senhaNormalizada", student.getTargetPassword());
        msg.put("lotesProcessados", student.getLotesProcessados());
        return msg.toString();
    }

    private String criarMensagemAtualizacaoGlobal() {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "ATUALIZACAO_GLOBAL");
        msg.put("progressoPercentagem", Math.round(calcularProgressoGlobal() * 10.0) / 10.0);
        msg.put("totalNos", students.size());
        msg.put("alunosConcluidos", contarAlunosConcluidos());
        msg.put("concluido", students.size() > 0
                && contarAlunosConcluidos() == students.size());
        return msg.toString();
    }

    private String criarMensagemTodosConcluidos() {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "TODOS_CONCLUIDOS");
        msg.put("totalNos", students.size());
        msg.put("progressoPercentagem", 100.0);
        msg.put("concluido", true);
        return msg.toString();
    }

    // =====================================================
    // Comunicação WebSocket
    // =====================================================

    private void enviarParaSessao(WebSocketSession session, String jsonMessage) {
        if (session != null && session.isOpen()) {
            try {
                session.sendMessage(new TextMessage(jsonMessage));
            } catch (IOException e) {
                log.error("Erro ao enviar para sessão {}: {}", session.getId(), e.getMessage());
            }
        }
    }

    private void broadcast(String jsonMessage) {
        for (ConnectedStudent student : students.values()) {
            enviarParaSessao(student.getSession(), jsonMessage);
        }
    }

    public void broadcastEstadoGlobal() {
        broadcast(criarMensagemAtualizacaoGlobal());
    }

    public void broadcastLobbyAtualizado() {
        broadcast(criarMensagemLobbyAtualizado());
    }

    private void broadcastMudarEstado(GameState novoEstado) {
        broadcast(criarMensagemMudarEstado(novoEstado));
    }

    // =====================================================
    // Getters para REST
    // =====================================================

    public Map<String, Object> getEstadoCompleto() {
        Map<String, Object> estado = new LinkedHashMap<>();
        estado.put("estadoPartida", estadoPartida.name());
        estado.put("totalAlunos", students.size());
        estado.put("senhasTipo", "alfanumérica aleatória 8 chars");
        estado.put("totalCombinacoes", String.format("%,d", totalSearchSpace));
        estado.put("chunksPerAluno", numChunks);
        estado.put("progressoGlobal", Math.round(calcularProgressoGlobal() * 10.0) / 10.0);
        estado.put("alunosConcluidos", contarAlunosConcluidos());
        estado.put("minigamesConcluidos", contarMinigamesConcluidos());

        List<Map<String, Object>> alunosList = new ArrayList<>();
        for (ConnectedStudent s : students.values()) {
            Map<String, Object> aluno = new LinkedHashMap<>();
            aluno.put("id", s.getId());
            aluno.put("nome", s.getNome());
            aluno.put("isAdmin", s.isAdmin());
            aluno.put("palavra", s.getDisplayPassword());
            aluno.put("lotesProcessados", s.getLotesProcessados());
            aluno.put("progresso", Math.round(s.calcularProgresso() * 10.0) / 10.0);
            aluno.put("encontrada", s.isSenhaEncontrada());
            aluno.put("minigamesConcluidos", s.isMinigamesConcluidos());
            alunosList.add(aluno);
        }
        estado.put("alunos", alunosList);

        return estado;
    }
}
