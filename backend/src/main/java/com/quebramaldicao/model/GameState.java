package com.quebramaldicao.model;

/**
 * Estados globais da partida.
 *
 * Fluxo:
 *   LOBBY_INICIAL  →  JOGANDO_MINIGAMES  →  LOBBY_FINAL  →  SISTEMAS_DISTRIBUIDOS
 *
 * Transições controladas exclusivamente pelo Admin (professor).
 */
public enum GameState {

    /** Alunos conectados aguardando o professor iniciar os minijogos. */
    LOBBY_INICIAL,

    /** Minijogos em andamento — cada aluno progride no seu ritmo. */
    JOGANDO_MINIGAMES,

    /** Alunos que terminaram os minijogos aguardam os restantes. */
    LOBBY_FINAL,

    /** Fase de sistemas distribuídos — todos quebram a senha simultaneamente. */
    SISTEMAS_DISTRIBUIDOS
}
