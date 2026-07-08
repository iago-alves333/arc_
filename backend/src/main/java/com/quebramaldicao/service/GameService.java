package com.quebramaldicao.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.quebramaldicao.model.ChunkStatus;
import com.quebramaldicao.model.ConnectedStudent;
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
    // Gestão de Sessões
    // =====================================================

    public String registarAluno(WebSocketSession session, String nome) {
        String alunoId = UUID.randomUUID().toString();
        ConnectedStudent student = new ConnectedStudent(alunoId, nome, session);

        // Gerar senha alfanumérica aleatória para este aluno
        String[] senha = gerarSenhaAleatoria();
        student.setTargetPassword(senha[0]);  // normalizada
        student.setDisplayPassword(senha[1]); // para exibição

        // Criar chunks
        criarChunksParaAluno(student);

        students.put(session.getId(), student);

        log.info(" Aluno conectado: {} (ID: {}) — Senha: '{}' — Total nós: {}",
                nome, alunoId, senha[1], students.size());

        enviarParaSessao(session, criarMensagemRegisto(student));
        broadcastEstadoGlobal();

        return alunoId;
    }

    public void removerAluno(WebSocketSession session) {
        ConnectedStudent student = students.remove(session.getId());
        if (student != null) {
            log.info(" Aluno desconectado: {} — Restam: {}", student.getNome(), students.size());
            broadcastEstadoGlobal();
        }
    }

    public ConnectedStudent obterAluno(WebSocketSession session) {
        return students.get(session.getId());
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

                log.info("PALAVRA ENCONTRADA por {} — '{}'",
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

            log.info(" Lote {} de {} — Progresso: {}%",
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
    // Reset do Jogo
    // =====================================================

    public synchronized void resetarJogo() {
        for (ConnectedStudent student : students.values()) {
            // Gerar nova senha aleatória para cada aluno
            String[] senha = gerarSenhaAleatoria();
            student.setTargetPassword(senha[0]);
            student.setDisplayPassword(senha[1]);
            student.setSenhaEncontrada(false);
            criarChunksParaAluno(student);
        }
        log.info("🔄 Jogo reiniciado — {} alunos com novas senhas", students.size());
        broadcastEstadoGlobal();
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
    // Construção de Mensagens JSON
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

    // =====================================================
    // Getters para REST
    // =====================================================

    public Map<String, Object> getEstadoCompleto() {
        Map<String, Object> estado = new LinkedHashMap<>();
        estado.put("totalAlunos", students.size());
        estado.put("senhasTipo", "alfanumérica aleatória 8 chars");
        estado.put("totalCombinacoes", String.format("%,d", totalSearchSpace));
        estado.put("chunksPerAluno", numChunks);
        estado.put("progressoGlobal", Math.round(calcularProgressoGlobal() * 10.0) / 10.0);
        estado.put("alunosConcluidos", contarAlunosConcluidos());

        List<Map<String, Object>> alunosList = new ArrayList<>();
        for (ConnectedStudent s : students.values()) {
            Map<String, Object> aluno = new LinkedHashMap<>();
            aluno.put("id", s.getId());
            aluno.put("nome", s.getNome());
            aluno.put("palavra", s.getDisplayPassword());
            aluno.put("lotesProcessados", s.getLotesProcessados());
            aluno.put("progresso", Math.round(s.calcularProgresso() * 10.0) / 10.0);
            aluno.put("encontrada", s.isSenhaEncontrada());
            alunosList.add(aluno);
        }
        estado.put("alunos", alunosList);

        return estado;
    }
}
