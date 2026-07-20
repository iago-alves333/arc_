import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// =====================================================
// Métricas customizadas
// =====================================================
const wsConnections  = new Counter('ws_connections_total');
const wsMessages     = new Counter('ws_messages_received');
const lotesRecebidos = new Counter('lotes_recebidos');
const lotesEnviados  = new Counter('lotes_enviados');
const senhasQuebradas = new Counter('senhas_quebradas');
const lobbyEvents    = new Counter('lobby_events');
const wsLatency      = new Trend('ws_message_latency_ms');
const wsConnectTime  = new Trend('ws_connect_time_ms');
const successRate    = new Rate('ws_success_rate');

// =====================================================
// Opções do teste k6
// =====================================================
export let options = {
    scenarios: {
        alunos_quebrando_senha: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 10  },
                { duration: '30s', target: 50  },
                { duration: '30s', target: 100 },
                { duration: '20s', target: 100 },
                { duration: '10s', target: 0   },
            ],
            gracefulRampDown: '5s',
        },
    },
    thresholds: {
        'ws_success_rate':        ['rate>0.95'],
        'ws_connect_time_ms':     ['p(95)<2000'],
        'ws_message_latency_ms':  ['p(95)<500'],
    },
};

// =====================================================
// Configuração
// =====================================================
const WS_URL = __ENV.WS_URL || 'wss://arc2-abfjhpb9gndvhzd3.brazilsouth-01.azurewebsites.net/ghost-network';
const SIMULATE_ADMIN = (__ENV.SIMULATE_ADMIN || 'false') === 'true';
const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const WORD_LENGTH = 8;

// =====================================================
// Funções auxiliares
// =====================================================
function simularBuscaNoChunk(inicio, fim, alvoSenha, charset) {
    let alvoIndex = 0;
    const base = charset.length;
    for (let i = 0; i < alvoSenha.length; i++) {
        const charPos = charset.indexOf(alvoSenha.charAt(i));
        alvoIndex = alvoIndex * base + (charPos >= 0 ? charPos : 0);
    }
    if (alvoIndex >= inicio && alvoIndex <= fim) {
        return { encontrou: true, senha: alvoSenha };
    }
    return { encontrou: false, senha: null };
}

function gerarNomeAluno() {
    const nomes = [
        'Alice', 'Bob', 'Carlos', 'Diana', 'Eduardo',
        'Fernanda', 'Gabriel', 'Helena', 'Igor', 'Julia',
        'Kaio', 'Larissa', 'Marcos', 'Natalia', 'Oscar',
        'Patricia', 'Rafael', 'Sofia', 'Thiago', 'Valentina',
    ];
    const idx = Math.floor(Math.random() * nomes.length);
    return `${nomes[idx]}_k6_${Math.floor(Math.random() * 1000)}`;
}

let adminAlreadyAssigned = false;

// =====================================================
// Função principal (executada por cada VU)
// =====================================================
export default function () {
    const nomeAluno = gerarNomeAluno();
    const connectStart = Date.now();
    const isAdmin = SIMULATE_ADMIN && !adminAlreadyAssigned;
    if (isAdmin) adminAlreadyAssigned = true;

    const res = ws.connect(WS_URL, {}, function (socket) {
        wsConnectTime.add(Date.now() - connectStart);
        wsConnections.add(1);
        successRate.add(1);

        let alunoId = null;
        let senhaJaQuebrada = false;
        let lotesLocal = 0;
        let estadoAtual = 'LOBBY_INICIAL';

        socket.on('open', function () {
            socket.send(JSON.stringify({
                tipo: 'REGISTAR', nome: nomeAluno, isAdmin: isAdmin,
            }));
            if (isAdmin) console.log(`[${nomeAluno}] 🔑 ADMIN`);
        });

        socket.on('message', function (data) {
            const recvTime = Date.now();
            wsMessages.add(1);
            let msg;
            try { msg = JSON.parse(data); } catch (e) { return; }

            switch (msg.tipo) {
                // ── Lobby ──────────────────────────────
                case 'REGISTO_LOBBY': {
                    alunoId = msg.alunoId;
                    estadoAtual = msg.estadoPartida;
                    lobbyEvents.add(1);
                    console.log(`[${nomeAluno}] ✓ Lobby (${estadoAtual}) Admin:${msg.isAdmin}`);
                    if (isAdmin && estadoAtual === 'LOBBY_INICIAL') {
                        sleep(3);
                        console.log(`[${nomeAluno}] 🚀 ADMIN: Iniciando minijogos`);
                        socket.send(JSON.stringify({ tipo: 'ADMIN_INICIAR_MINIGAMES' }));
                    }
                    break;
                }
                case 'LOBBY_ATUALIZADO': {
                    lobbyEvents.add(1);
                    break;
                }
                case 'MUDAR_ESTADO': {
                    estadoAtual = msg.novoEstado;
                    lobbyEvents.add(1);
                    console.log(`[${nomeAluno}] 🔄 → ${estadoAtual}`);
                    if (estadoAtual === 'JOGANDO_MINIGAMES') {
                        const t = 2 + Math.random() * 5;
                        sleep(t);
                        socket.send(JSON.stringify({ tipo: 'MINIGAMES_CONCLUIDOS' }));
                        if (isAdmin) {
                            sleep(5);
                            socket.send(JSON.stringify({ tipo: 'ADMIN_INICIAR_DISTRIBUIDO' }));
                        }
                    }
                    if (estadoAtual === 'SISTEMAS_DISTRIBUIDOS') {
                        sleep(0.2 + Math.random() * 0.5);
                        socket.send(JSON.stringify({ tipo: 'PEDIR_TRABALHO', alunoId }));
                    }
                    break;
                }

                // ── Jogo distribuído ───────────────────
                case 'REGISTO_CONFIRMADO': {
                    alunoId = msg.alunoId;
                    sleep(0.1 + Math.random() * 0.3);
                    socket.send(JSON.stringify({ tipo: 'PEDIR_TRABALHO', alunoId }));
                    break;
                }
                case 'NOVO_LOTE': {
                    lotesRecebidos.add(1);
                    sleep(0.3 + Math.random() * 0.7);
                    const r = simularBuscaNoChunk(msg.inicio, msg.fim, msg.alvoSenha, msg.charset);
                    if (r.encontrou && !senhaJaQuebrada) {
                        senhaJaQuebrada = true;
                        senhasQuebradas.add(1);
                        console.log(`[${nomeAluno}] 🔓 '${r.senha}' chunk#${msg.chunkId}`);
                        socket.send(JSON.stringify({
                            tipo: 'RESULTADO_LOTE', chunkId: msg.chunkId,
                            encontrou: true, senha: r.senha,
                        }));
                    } else {
                        lotesLocal++;
                        lotesEnviados.add(1);
                        socket.send(JSON.stringify({
                            tipo: 'RESULTADO_LOTE', chunkId: msg.chunkId, encontrou: false,
                        }));
                    }
                    wsLatency.add(Date.now() - recvTime);
                    break;
                }
                case 'ATUALIZACAO_GLOBAL': break;
                case 'SENHA_QUEBRADA_PESSOAL': {
                    senhaJaQuebrada = true;
                    sleep(2); socket.close();
                    break;
                }
                case 'FIM_DE_JOGO': { sleep(1); socket.close(); break; }
                case 'SEM_TRABALHO': {
                    sleep(1 + Math.random() * 2);
                    socket.send(JSON.stringify({ tipo: 'PEDIR_TRABALHO', alunoId }));
                    break;
                }
                case 'TODOS_CONCLUIDOS': { sleep(1); socket.close(); break; }
                default: break;
            }
        });

        socket.on('error', function (e) {
            console.error(`[${nomeAluno}] ❌ ${e.error()}`);
            successRate.add(0);
        });

        socket.on('close', function () {
            console.log(`[${nomeAluno}] 🔌 Fechado | Lotes:${lotesLocal} | Estado:${estadoAtual}`);
        });

        socket.setTimeout(function () { socket.close(); }, 120000);
    });

    check(res, { 'WS status 101': (r) => r && r.status === 101 });
    sleep(1 + Math.random() * 2);
}

// =====================================================
// Resumo customizado
// =====================================================
export function handleSummary(data) {
    const m = data.metrics;
    let r = '\n═══════════════════════════════════════════════════════\n';
    r += '  QUEBRA DE MALDIÇÃO — Relatório de Teste de Carga\n';
    r += '═══════════════════════════════════════════════════════\n\n';
    if (m.ws_connections_total) r += `  Conexões WS:       ${m.ws_connections_total.values.count}\n`;
    if (m.ws_success_rate) r += `  Taxa de sucesso:    ${(m.ws_success_rate.values.rate * 100).toFixed(1)}%\n`;
    if (m.ws_connect_time_ms) r += `  Conexão p95:        ${m.ws_connect_time_ms.values['p(95)'].toFixed(0)}ms\n`;
    if (m.lobby_events) r += `  Eventos de lobby:   ${m.lobby_events.values.count}\n`;
    if (m.lotes_recebidos) r += `  Lotes recebidos:    ${m.lotes_recebidos.values.count}\n`;
    if (m.lotes_enviados) r += `  Lotes processados:  ${m.lotes_enviados.values.count}\n`;
    if (m.senhas_quebradas) r += `  Senhas quebradas:   ${m.senhas_quebradas.values.count}\n`;
    if (m.ws_message_latency_ms) r += `  Latência p95:       ${m.ws_message_latency_ms.values['p(95)'].toFixed(0)}ms\n`;
    r += '\n═══════════════════════════════════════════════════════\n';
    console.log(r);
    return { stdout: r };
}