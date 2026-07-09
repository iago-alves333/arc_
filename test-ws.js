import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// =====================================================
// Métricas customizadas
// =====================================================
const wsConnections = new Counter('ws_connections_total');
const wsMessages    = new Counter('ws_messages_received');
const lotesRecebidos = new Counter('lotes_recebidos');
const lotesEnviados  = new Counter('lotes_enviados');
const senhasQuebradas = new Counter('senhas_quebradas');
const wsLatency     = new Trend('ws_message_latency_ms');
const wsConnectTime = new Trend('ws_connect_time_ms');
const successRate   = new Rate('ws_success_rate');

// =====================================================
// Opções do teste k6
// =====================================================
export let options = {
    // Cenário: Ramp-up gradual de utilizadores simulando alunos
    scenarios: {
        alunos_quebrando_senha: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 10  },  // Ramp-up: 10 alunos em 10s
                { duration: '30s', target: 50  },  // Escalar para 50 alunos
                { duration: '30s', target: 100 },  // Pico: 100 alunos simultâneos
                { duration: '20s', target: 100 },  // Manter 100 alunos
                { duration: '10s', target: 0   },  // Ramp-down
            ],
            gracefulRampDown: '5s',
        },
    },
    thresholds: {
        'ws_success_rate':        ['rate>0.95'],        // 95%+ de sucesso nas conexões
        'ws_connect_time_ms':     ['p(95)<2000'],       // 95% das conexões < 2s
        'ws_message_latency_ms':  ['p(95)<500'],        // 95% das mensagens < 500ms
    },
};

// =====================================================
// Configuração
// =====================================================
const WS_URL = __ENV.WS_URL || 'ws://localhost:8080/ghost-network';

// Charset e comprimento (devem bater com o backend)
const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const WORD_LENGTH = 8;

// =====================================================
// Funções auxiliares
// =====================================================

/**
 * Converte um índice numérico para a string alfanumérica correspondente.
 * Replica a lógica do backend `indiceParaPalavra()`.
 */
function indiceParaPalavra(index) {
    const base = CHARSET.length;
    let result = [];
    for (let i = WORD_LENGTH - 1; i >= 0; i--) {
        result[i] = CHARSET.charAt(index % base);
        index = Math.floor(index / base);
    }
    return result.join('');
}

/**
 * Simula a busca de força bruta num chunk.
 * Em vez de testar todas as combinações (impossível em k6),
 * simula o tempo de processamento e verifica se a senha
 * está dentro do intervalo do chunk.
 */
function simularBuscaNoChunk(inicio, fim, alvoSenha, charset, comprimento) {
    // Converter a senha alvo para índice
    let alvoIndex = 0;
    const base = charset.length;
    for (let i = 0; i < alvoSenha.length; i++) {
        const charPos = charset.indexOf(alvoSenha.charAt(i));
        alvoIndex = alvoIndex * base + (charPos >= 0 ? charPos : 0);
    }

    // Verificar se a senha está no intervalo deste chunk
    if (alvoIndex >= inicio && alvoIndex <= fim) {
        return { encontrou: true, senha: alvoSenha };
    }

    return { encontrou: false, senha: null };
}

/**
 * Gera um nome aleatório para o aluno virtual.
 */
function gerarNomeAluno() {
    const nomes = [
        'Alice', 'Bob', 'Carlos', 'Diana', 'Eduardo',
        'Fernanda', 'Gabriel', 'Helena', 'Igor', 'Julia',
        'Kaio', 'Larissa', 'Marcos', 'Natalia', 'Oscar',
        'Patricia', 'Rafael', 'Sofia', 'Thiago', 'Valentina',
    ];
    const idx = Math.floor(Math.random() * nomes.length);
    const sufixo = Math.floor(Math.random() * 1000);
    return `${nomes[idx]}_k6_${sufixo}`;
}

// =====================================================
// Função principal do teste (executada por cada VU)
// =====================================================
export default function () {
    const nomeAluno = gerarNomeAluno();
    const connectStart = Date.now();

    const res = ws.connect(WS_URL, {}, function (socket) {
        const connectEnd = Date.now();
        wsConnectTime.add(connectEnd - connectStart);
        wsConnections.add(1);
        successRate.add(1);

        let alunoId = null;
        let alvoSenha = null;
        let senhaJaQuebrada = false;
        let lotesProcessadosLocal = 0;

        // ─── Ao abrir a conexão: registar o aluno ───────
        socket.on('open', function () {
            const msgRegistar = JSON.stringify({
                tipo: 'REGISTAR',
                nome: nomeAluno,
            });
            socket.send(msgRegistar);
        });

        // ─── Processar mensagens recebidas ──────────────
        socket.on('message', function (data) {
            const recvTime = Date.now();
            wsMessages.add(1);

            let msg;
            try {
                msg = JSON.parse(data);
            } catch (e) {
                console.error(`[${nomeAluno}] Erro ao parsear mensagem: ${data}`);
                return;
            }

            switch (msg.tipo) {
                case 'REGISTO_CONFIRMADO': {
                    alunoId = msg.alunoId;
                    console.log(
                        `[${nomeAluno}] ✓ Registado (ID: ${alunoId}) ` +
                        `| Nós: ${msg.totalNos} | Chunks: ${msg.totalChunks} ` +
                        `| Combinações: ${msg.totalCombinacoes}`
                    );
                    // Pedir o primeiro lote de trabalho
                    sleep(0.1 + Math.random() * 0.3); // Jitter para não sobrecarregar
                    socket.send(JSON.stringify({
                        tipo: 'PEDIR_TRABALHO',
                        alunoId: alunoId,
                    }));
                    break;
                }

                case 'NOVO_LOTE': {
                    lotesRecebidos.add(1);
                    alvoSenha = msg.alvoSenha;

                    // Simular processamento do chunk (latência realista)
                    const tempoProcessamento = 0.3 + Math.random() * 0.7; // 300-1000ms
                    sleep(tempoProcessamento);

                    // Simular a busca de força bruta
                    const resultado = simularBuscaNoChunk(
                        msg.inicio, msg.fim, alvoSenha, msg.charset, msg.comprimento
                    );

                    if (resultado.encontrou && !senhaJaQuebrada) {
                        // Senha encontrada neste chunk!
                        senhaJaQuebrada = true;
                        senhasQuebradas.add(1);
                        console.log(
                            `[${nomeAluno}] 🔓 SENHA ENCONTRADA: '${resultado.senha}' ` +
                            `no chunk ${msg.chunkId} após ${lotesProcessadosLocal + 1} lotes`
                        );
                        socket.send(JSON.stringify({
                            tipo: 'RESULTADO_LOTE',
                            chunkId: msg.chunkId,
                            encontrou: true,
                            senha: resultado.senha,
                        }));
                    } else {
                        // Chunk processado sem encontrar a senha
                        lotesProcessadosLocal++;
                        lotesEnviados.add(1);
                        socket.send(JSON.stringify({
                            tipo: 'RESULTADO_LOTE',
                            chunkId: msg.chunkId,
                            encontrou: false,
                        }));
                    }

                    wsLatency.add(Date.now() - recvTime);
                    break;
                }

                case 'ATUALIZACAO_GLOBAL': {
                    // Log periódico do estado global
                    if (Math.random() < 0.05) { // Log 5% das vezes para não poluir
                        console.log(
                            `[${nomeAluno}] 📊 Global: ` +
                            `${msg.progressoPercentagem}% | ` +
                            `Nós: ${msg.totalNos} | ` +
                            `Concluídos: ${msg.alunosConcluidos}`
                        );
                    }
                    break;
                }

                case 'SENHA_QUEBRADA_PESSOAL': {
                    console.log(
                        `[${nomeAluno}] SENHA QUEBRADA: '${msg.senha}' ` +
                        `após ${msg.lotesProcessados} lotes processados`
                    );
                    senhaJaQuebrada = true;
                    // Manter conexão aberta por um tempo para simular o aluno
                    // ainda visualizando a tela de vitória
                    sleep(2 + Math.random() * 3);
                    socket.close();
                    break;
                }

                case 'FIM_DE_JOGO': {
                    console.log(`[${nomeAluno}] 🏁 Fim de jogo — senha: '${msg.senha}'`);
                    sleep(1);
                    socket.close();
                    break;
                }

                case 'SEM_TRABALHO': {
                    // Todos os chunks já foram distribuídos, aguardar
                    console.log(`[${nomeAluno}] ⏳ Sem trabalho — aguardando...`);
                    sleep(1 + Math.random() * 2);
                    // Tentar pedir trabalho novamente
                    socket.send(JSON.stringify({
                        tipo: 'PEDIR_TRABALHO',
                        alunoId: alunoId,
                    }));
                    break;
                }

                case 'TODOS_CONCLUIDOS': {
                    console.log(`[${nomeAluno}] 🏆 Todos os alunos concluíram!`);
                    sleep(1);
                    socket.close();
                    break;
                }

                default:
                    console.log(`[${nomeAluno}] ❓ Mensagem desconhecida: ${msg.tipo}`);
            }
        });

        // ─── Tratamento de erros ────────────────────────
        socket.on('error', function (e) {
            console.error(`[${nomeAluno}] ❌ Erro WebSocket: ${e.error()}`);
            successRate.add(0);
        });

        socket.on('close', function () {
            console.log(
                `[${nomeAluno}]  Conexão fechada ` +
                `| Lotes processados: ${lotesProcessadosLocal} ` +
                `| Senha quebrada: ${senhaJaQuebrada}`
            );
        });

        // ─── Timeout: fechar após 90s se ainda conectado ─
        socket.setTimeout(function () {
            if (!senhaJaQuebrada) {
                console.log(`[${nomeAluno}] ⏱ Timeout — encerrando conexão`);
            }
            socket.close();
        }, 90000);
    });

    // Verificar se a conexão WebSocket foi bem-sucedida
    check(res, {
        'Conexão WebSocket estabelecida (status 101)': (r) => r && r.status === 101,
    });

    // Pequeno intervalo entre iterações do mesmo VU
    sleep(1 + Math.random() * 2);
}

// =====================================================
// Resumo customizado
// =====================================================
export function handleSummary(data) {
    const summary = {
        '═══════════════════════════════════════════════': '',
        '  QUEBRA DE MALDIÇÃO — Relatório de Carga': '',

    };

    // Extrair métricas para o console
    const metrics = data.metrics;

    let report = '\n';
    report += '═══════════════════════════════════════════════════════\n';
    report += '  QUEBRA DE MALDIÇÃO — Relatório de Teste de Carga\n';
    report += '═══════════════════════════════════════════════════════\n\n';

    if (metrics.ws_connections_total) {
        report += `   Conexões WS totais:    ${metrics.ws_connections_total.values.count}\n`;
    }
    if (metrics.ws_messages_received) {
        report += `  Mensagens recebidas:   ${metrics.ws_messages_received.values.count}\n`;
    }
    if (metrics.lotes_recebidos) {
        report += `   Lotes recebidos:       ${metrics.lotes_recebidos.values.count}\n`;
    }
    if (metrics.lotes_enviados) {
        report += `   Lotes processados:     ${metrics.lotes_enviados.values.count}\n`;
    }
    if (metrics.senhas_quebradas) {
        report += `  Senhas quebradas:      ${metrics.senhas_quebradas.values.count}\n`;
    }
    if (metrics.ws_success_rate) {
        report += `  Taxa de sucesso:       ${(metrics.ws_success_rate.values.rate * 100).toFixed(1)}%\n`;
    }
    if (metrics.ws_connect_time_ms) {
        report += `  Tempo de conexão (p95): ${metrics.ws_connect_time_ms.values['p(95)'].toFixed(0)}ms\n`;
    }
    if (metrics.ws_message_latency_ms) {
        report += `   Latência msg (p95):    ${metrics.ws_message_latency_ms.values['p(95)'].toFixed(0)}ms\n`;
    }

    report += '\n═══════════════════════════════════════════════════════\n';

    console.log(report);

    return {
        stdout: report,
    };
}