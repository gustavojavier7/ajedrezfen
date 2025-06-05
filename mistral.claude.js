function getMove(fen, chess) {
    const game = new chess.Chess(fen);
    const maximizing = game.turn() === 'w';
    const maxDepth = 3;

    const pieceValues = {
        p: 100, n: 320, b: 330, r: 500, q: 900, k: 0
    };

    const pstOpening = {
        p: [
            0, 0, 0, 0, 0, 0, 0, 0,
            50, 50, 50, 50, 50, 50, 50, 50,
            10, 10, 20, 30, 30, 20, 10, 10,
            5, 5, 10, 25, 25, 10, 5, 5,
            0, 0, 0, 20, 20, 0, 0, 0,
            5, -5, -10, 0, 0, -10, -5, 5,
            5, 10, 10, -20, -20, 10, 10, 5,
            0, 0, 0, 0, 0, 0, 0, 0
        ],
        n: [
            -50, -40, -30, -30, -30, -30, -40, -50,
            -40, -20, 0, 0, 0, 0, -20, -40,
            -30, 0, 10, 15, 15, 10, 0, -30,
            -30, 5, 15, 20, 20, 15, 5, -30,
            -30, 0, 15, 20, 20, 15, 0, -30,
            -30, 5, 10, 15, 15, 10, 5, -30,
            -40, -20, 0, 5, 5, 0, -20, -40,
            -50, -40, -30, -30, -30, -30, -40, -50
        ],
        b: [
            -20,-10,-10,-10,-10,-10,-10,-20,
            -10,0,0,0,0,0,0,-10,
            -10,0,5,10,10,5,0,-10,
            -10,5,5,10,10,5,5,-10,
            -10,0,10,10,10,10,0,-10,
            -10,10,10,10,10,10,10,-10,
            -10,5,0,0,0,0,5,-10,
            -20,-10,-10,-10,-10,-10,-10,-20
        ],
        r: [
            0,0,0,5,5,0,0,0,
            -5,0,0,0,0,0,0,-5,
            -5,0,0,0,0,0,0,-5,
            -5,0,0,0,0,0,0,-5,
            -5,0,0,0,0,0,0,-5,
            -5,0,0,0,0,0,0,-5,
            5,10,10,10,10,10,10,5,
            0,0,0,0,0,0,0,0
        ],
        q: [
            -20,-10,-10,-5,-5,-10,-10,-20,
            -10,0,0,0,0,0,0,-10,
            -10,0,5,5,5,5,0,-10,
            -5,0,5,5,5,5,0,-5,
            0,0,5,5,5,5,0,-5,
            -10,5,5,5,5,5,0,-10,
            -10,0,5,0,0,0,0,-10,
            -20,-10,-10,-5,-5,-10,-10,-20
        ],
        k: [
            20,30,10,0,0,10,30,20,
            20,20,0,0,0,0,20,20,
            -10,-20,-20,-20,-20,-20,-20,-10,
            -20,-30,-30,-40,-40,-30,-30,-20,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30
        ],
        k_e: [
            -50,-40,-30,-20,-20,-30,-40,-50,
            -30,-20,-10,0,0,-10,-20,-30,
            -30,-10,20,30,30,20,-10,-30,
            -30,-10,30,40,40,30,-10,-30,
            -30,-10,30,40,40,30,-10,-30,
            -30,-10,20,30,30,20,-10,-30,
            -30,-30,0,0,0,0,-30,-30,
            -50,-30,-30,-30,-30,-30,-30,-50
        ]
    };

    function isEndgame(g) {
        const pieces = g.board().flat().filter(p => p && p.type !== 'k');
        let material = 0;
        for (const p of pieces) material += pieceValues[p.type];
        return material < 2400; // roughly queens off
    }

    function pstValue(piece, squareIndex, endgame) {
        const table = pstOpening[piece.type === 'k' ? (endgame ? 'k_e' : 'k') : piece.type];
        const index = piece.color === 'w' ? squareIndex : 63 - squareIndex;
        return table ? table[index] : 0;
    }

    function evaluateBoard(g) {
        if (g.in_checkmate()) {
            return g.turn() === 'w' ? -Infinity : Infinity;
        }
        if (g.in_draw() || g.insufficient_material() || g.in_stalemate() || g.in_threefold_repetition()) {
            return 0;
        }
        const board = g.board();
        const endgame = isEndgame(g);
        let score = 0;
        const pawnFiles = { w: Array(8).fill(0), b: Array(8).fill(0) };
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[rank][file];
                if (!piece) continue;
                const index = rank * 8 + file;
                const sign = piece.color === 'w' ? 1 : -1;
                score += sign * pieceValues[piece.type];
                score += sign * pstValue(piece, index, endgame);
                if (piece.type === 'p') pawnFiles[piece.color][file]++;
            }
        }
        // Pawn structure penalties/bonuses
        for (const color of ['w', 'b']) {
            for (let file = 0; file < 8; file++) {
                const count = pawnFiles[color][file];
                if (count > 1) score += (color === 'w' ? -1 : 1) * 20 * (count - 1);
                if (count && !pawnFiles[color][file - 1] && !pawnFiles[color][file + 1]) {
                    score += (color === 'w' ? -25 : 25);
                }
            }
        }
        // Mobility
        const mobility = g.moves().length;
        g.turn() === 'w' ? score += mobility : score -= mobility;
        return score;
    }

    function orderMoves(moves) {
        return moves.sort((a, b) => {
            const aScore = (a.captured ? 10 * pieceValues[a.captured.toLowerCase()] : 0) + (a.flags.includes('c') ? 5 : 0) + (a.san.includes('+') ? 1 : 0);
            const bScore = (b.captured ? 10 * pieceValues[b.captured.toLowerCase()] : 0) + (b.flags.includes('c') ? 5 : 0) + (b.san.includes('+') ? 1 : 0);
            return bScore - aScore;
        });
    }

    function minimax(depth, alpha, beta, maximizingPlayer) {
        if (depth === 0 || game.game_over()) return evaluateBoard(game);
        const moves = orderMoves(game.moves({ verbose: true }));
        if (maximizingPlayer) {
            let value = -Infinity;
            for (const move of moves) {
                game.move(move);
                const score = minimax(depth - 1, alpha, beta, false);
                game.undo();
                if (score > value) value = score;
                if (value > alpha) alpha = value;
                if (alpha >= beta) break;
            }
            return value;
        } else {
            let value = Infinity;
            for (const move of moves) {
                game.move(move);
                const score = minimax(depth - 1, alpha, beta, true);
                game.undo();
                if (score < value) value = score;
                if (value < beta) beta = value;
                if (alpha >= beta) break;
            }
            return value;
        }
    }

    const moves = orderMoves(game.moves({ verbose: true }));
    let bestMove = null;
    let bestScore = maximizing ? -Infinity : Infinity;

    for (const move of moves) {
        game.move(move);
        const score = minimax(maxDepth - 1, -Infinity, Infinity, !maximizing);
        game.undo();
        if (maximizing ? score > bestScore : score < bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove ? bestMove.san : null;
}
