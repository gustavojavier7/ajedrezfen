function getMove(fen, chess) {
    // Obtener movimientos legales
    const moves = chess.moves({ verbose: true });

    // Evaluar movimientos y elegir el mejor
    let bestMove = null;
    let bestScore = -Infinity;

    // Peso relativo de las piezas
    const pieceValues = {
        'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0,
        'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 0
    };

    // Evaluar cada movimiento
    for (const move of moves) {
        // Crear una copia del tablero y aplicar el movimiento
        const newChess = new chess.Chess(fen);
        newChess.move(move.san);

        // Calcular el score del movimiento actual
        let moveScore = 0;

        // Evaluación de material
        if (move.captured) {
            moveScore += (move.color === 'w' ? 1 : -1) * pieceValues[move.captured.toLowerCase()];
        }

        // Prevención táctica: evitar movimientos que permitan al oponente capturar piezas valiosas
        const opponentMoves = newChess.moves({ verbose: true });
        for (const opponentMove of opponentMoves) {
            if (opponentMove.captured) {
                moveScore -= (opponentMove.color === 'w' ? 1 : -1) * pieceValues[opponentMove.captured.toLowerCase()];
            }
        }

        // Desarrollo y control del centro
        const centerSquares = ['d4', 'e4', 'd5', 'e5'];
        if (centerSquares.includes(move.to)) {
            moveScore += 0.5; // Bonus por mover al centro
        }

        // Detección de jaque mate
        if (newChess.in_checkmate()) {
            moveScore += 100; // Alto bonus por jaque mate
        }

        // Actualizar el mejor movimiento si el score actual es mejor
        if (moveScore > bestScore) {
            bestScore = moveScore;
            bestMove = move.san;
        }
    }

    // Retornar el mejor movimiento
    return bestMove;
}
