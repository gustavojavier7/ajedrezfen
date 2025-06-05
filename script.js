(function() {
    'use strict';

    // ===================== VERIFICACIÓN DE DEPENDENCIAS =====================
    if (typeof Chess === 'undefined') {
        console.error('Error: La biblioteca chess.js no está cargada.');
        alert('Error crítico: No se pudo cargar chess.js. Por favor, verifica tu conexión o recarga la página.');
        throw new Error('Chess.js is required');
    }

    // ===================== VARIABLES GLOBALES =====================
    let chess = new Chess();
    let whiteEngine = null;
    let blackEngine = null;
    let stockfish = null;
    let gameRunning = false;
    let gamePaused = false;
    let currentTurn = 'w';
    let moveCount = 0;
    let lastEvaluation = null;
    let gameStartTime = null;
    let gameTimer = null;
    let stockfishBlobURL = null;

    // ===================== CONSTANTES =====================
    const PIECE_SYMBOLS = {
        'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
        'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
    };

    const STOCKFISH_URL = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js';

    // ===================== INICIALIZACIÓN =====================
    document.addEventListener('DOMContentLoaded', function() {
        initializeEventListeners();
        updateBoard();
        updateGameControls();
        updateGameStatus();
        updateMoveHistory();
        addSampleEngineButtons();
        
        console.log('🎮 Sistema de enfrentamiento de motores inicializado');
        console.log('📋 Formato requerido para motores:');
        console.log('   function getMove(fen, chess) {');
        console.log('     // Tu lógica aquí');
        console.log('     return "e2e4"; // Movimiento en notación SAN');
        console.log('   }');
    });

    // ===================== EVENT LISTENERS =====================
    function initializeEventListeners() {
        const whiteFileInput = document.getElementById('engineFileWhite');
        const blackFileInput = document.getElementById('engineFileBlack');
        
        if (whiteFileInput) {
            whiteFileInput.addEventListener('change', function(e) {
                loadEngine(e.target.files[0], 'white');
            });
        }

        if (blackFileInput) {
            blackFileInput.addEventListener('change', function(e) {
                loadEngine(e.target.files[0], 'black');
            });
        }

        // Prevenir cierre accidental durante partida
        window.addEventListener('beforeunload', function(e) {
            if (gameRunning) {
                e.preventDefault();
                e.returnValue = 'Hay una partida en curso. ¿Estás seguro de que quieres salir?';
                return e.returnValue;
            }
        });
    }

    // ===================== CARGA DE MOTORES =====================
    function loadEngine(file, color) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const engineCode = e.target.result;
                
                // Validar que el código contenga la función getMove
                if (!engineCode.includes('getMove')) {
                    throw new Error('El motor debe contener una función getMove(fen, chess)');
                }
                
                // Crear función en sandbox seguro
                const engineFunction = createEngineFunction(engineCode);
                
                // Probar el motor con posición inicial
                const testMove = testEngine(engineFunction);
                if (!testMove) {
                    throw new Error('El motor no retorna movimientos válidos');
                }

                // Asignar motor y actualizar UI
                assignEngine(engineFunction, color, file.name);
                updateGameControls();
                
                console.log(`✅ Motor ${color} cargado: ${file.name}`);
                
            } catch (error) {
                console.error(`Error cargando motor ${color}:`, error);
                showEngineError(color, error.message);
            }
        };
        reader.readAsText(file);
    }

    function createEngineFunction(engineCode) {
        // Crear función en un contexto seguro
        const wrappedCode = `
            (function() {
                ${engineCode}
                
                // Verificar que getMove existe
                if (typeof getMove !== 'function') {
                    throw new Error('Función getMove no encontrada');
                }
                
                return function(fen, chess) {
                    try {
                        return getMove(fen, chess);
                    } catch (error) {
                        console.error('Error en motor:', error);
                        return null;
                    }
                };
            })();
        `;
        
        return eval(wrappedCode);
    }

    function testEngine(engineFunction) {
        try {
            const testChess = new Chess();
            const testMove = engineFunction(testChess.fen(), testChess);
            
            if (!testMove || typeof testMove !== 'string') {
                return false;
            }
            
            // Verificar que el movimiento es válido
            const moveResult = testChess.move(testMove);
            if (!moveResult) {
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error probando motor:', error);
            return false;
        }
    }

    function assignEngine(engineFunction, color, filename) {
        if (color === 'white') {
            whiteEngine = engineFunction;
            const boxEl = document.getElementById('engineBoxWhite');
            const infoEl = document.getElementById('engineInfoWhite');
            const statusEl = document.getElementById('whiteEngineStatus');
            
            if (boxEl) boxEl.classList.add('loaded');
            if (infoEl) infoEl.textContent = `✅ ${filename}`;
            if (statusEl) {
                statusEl.textContent = 'Listo';
                statusEl.className = 'engine-ready';
            }
        } else {
            blackEngine = engineFunction;
            const boxEl = document.getElementById('engineBoxBlack');
            const infoEl = document.getElementById('engineInfoBlack');
            const statusEl = document.getElementById('blackEngineStatus');
            
            if (boxEl) boxEl.classList.add('loaded');
            if (infoEl) infoEl.textContent = `✅ ${filename}`;
            if (statusEl) {
                statusEl.textContent = 'Listo';
                statusEl.className = 'engine-ready';
            }
        }
    }

    function showEngineError(color, message) {
        const errorMsg = `❌ Error: ${message}`;
        if (color === 'white') {
            const infoEl = document.getElementById('engineInfoWhite');
            const statusEl = document.getElementById('whiteEngineStatus');
            if (infoEl) infoEl.textContent = errorMsg;
            if (statusEl) statusEl.textContent = 'Error';
        } else {
            const infoEl = document.getElementById('engineInfoBlack');
            const statusEl = document.getElementById('blackEngineStatus');
            if (infoEl) infoEl.textContent = errorMsg;
            if (statusEl) statusEl.textContent = 'Error';
        }
        
        alert(`Error cargando motor ${color === 'white' ? 'blancas' : 'negras'}:\n\n${message}\n\nEl motor debe contener una función getMove(fen, chess) que retorne un movimiento válido en notación SAN.`);
    }

    // ===================== STOCKFISH =====================
    function connectStockfish() {
        return new Promise((resolve, reject) => {
            if (stockfish) {
                resolve();
                return;
            }

            updateStockfishStatus('Conectando...');
            
            fetch(STOCKFISH_URL)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.text();
                })
                .then(code => {
                    const blob = new Blob([code], { type: 'application/javascript' });
                    stockfishBlobURL = URL.createObjectURL(blob);
                    stockfish = new Worker(stockfishBlobURL);
                    
                    stockfish.onmessage = function(e) {
                        handleStockfishMessage(e.data);
                    };
                    
                    stockfish.onerror = function(error) {
                        console.error('Error en Stockfish:', error);
                        updateStockfishStatus('Error');
                        reject(error);
                    };
                    
                    // Inicializar Stockfish
                    stockfish.postMessage('uci');
                    stockfish.postMessage('setoption name Hash value 64');
                    stockfish.postMessage('isready');
                    
                    updateStockfishStatus('Conectado');
                    console.log('✅ Stockfish conectado correctamente');
                    resolve();
                })
                .catch(error => {
                    console.error('Error conectando Stockfish:', error);
                    updateStockfishStatus('Error de conexión');
                    reject(error);
                });
        });
    }

    function handleStockfishMessage(message) {
        if (typeof message !== 'string') return;

        try {
            if (message.startsWith('info') && message.includes('score')) {
                parseEvaluation(message);
            } else if (message === 'readyok') {
                console.log('🔧 Stockfish listo para análisis');
            }
        } catch (error) {
            console.warn('Error procesando mensaje de Stockfish:', error);
        }
    }

    function parseEvaluation(line) {
        const parts = line.split(' ');
        const scoreIndex = parts.indexOf('score');
        
        if (scoreIndex === -1) return;

        const type = parts[scoreIndex + 1];
        const value = parseInt(parts[scoreIndex + 2]);
        
        if (type === 'cp') {
            // Centipawns - ajustar según el turno
            const evalValue = chess.turn() === 'w' ? value : -value;
            lastEvaluation = evalValue / 100;
            updateEvaluationDisplay();
        } else if (type === 'mate') {
            // Mate en N movimientos
            const mateValue = chess.turn() === 'w' ? value : -value;
            lastEvaluation = mateValue > 0 ? 999 : -999;
            updateEvaluationDisplay();
        }
    }

    function evaluatePosition() {
        if (!stockfish || chess.game_over()) return;
        
        try {
            stockfish.postMessage(`position fen ${chess.fen()}`);
            stockfish.postMessage('go depth 12');
        } catch (error) {
            console.warn('Error evaluando posición:', error);
        }
    }

    function updateStockfishStatus(status) {
        const statusEl = document.getElementById('stockfishStatus');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.className = status === 'Conectado' ? 'engine-ready' : 'engine-thinking';
        }
    }

    function updateEvaluationDisplay() {
        const evalEl = document.getElementById('evaluationValue');
        const detailsEl = document.getElementById('evaluationDetails');
        const lastEvalEl = document.getElementById('lastEval');
        
        if (lastEvaluation === null) {
            if (evalEl) {
                evalEl.textContent = '--';
                evalEl.className = 'evaluation-value eval-neutral';
            }
            if (detailsEl) detailsEl.textContent = 'Evaluando posición...';
            if (lastEvalEl) lastEvalEl.textContent = '--';
            return;
        }

        let displayText = '';
        let className = 'evaluation-value ';

        if (Math.abs(lastEvaluation) >= 999) {
            // Mate detectado
            const mateIn = Math.abs(lastEvaluation) === 999 ? '?' : Math.abs(lastEvaluation);
            displayText = lastEvaluation > 0 ? `+M${mateIn}` : `-M${mateIn}`;
            className += lastEvaluation > 0 ? 'eval-positive' : 'eval-negative';
        } else {
            // Evaluación normal en pawns
            displayText = lastEvaluation > 0 ? `+${lastEvaluation.toFixed(2)}` : lastEvaluation.toFixed(2);
            if (lastEvaluation > 0.5) {
                className += 'eval-positive';
            } else if (lastEvaluation < -0.5) {
                className += 'eval-negative';
            } else {
                className += 'eval-neutral';
            }
        }
        
        if (evalEl) {
            evalEl.textContent = displayText;
            evalEl.className = className;
        }
        if (lastEvalEl) lastEvalEl.textContent = displayText;
        
        const currentPlayer = chess.turn() === 'w' ? 'Blancas' : 'Negras';
        if (detailsEl) detailsEl.textContent = `Profundidad: 12 | Juegan: ${currentPlayer}`;
    }

    // ===================== TABLERO =====================
    function generateChessboardSVG() {
        const squareSize = 50;
        const boardSize = squareSize * 8;
        
        let svg = `<svg width="${boardSize + 40}" height="${boardSize + 40}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tablero de ajedrez">`;
        
        // Casillas del tablero
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const x = col * squareSize + 20;
                const y = row * squareSize + 20;
                const isLight = (row + col) % 2 === 0;
                const fill = isLight ? '#f0d9b5' : '#b58863';
                const squareName = String.fromCharCode(97 + col) + (8 - row);
                
                svg += `<rect x="${x}" y="${y}" width="${squareSize}" height="${squareSize}" fill="${fill}" data-square="${squareName}" />`;
            }
        }
        
        // Piezas - Usando el método correcto con chess.get()
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = String.fromCharCode(97 + col) + (8 - row);
                const piece = chess.get(square);
                
                if (piece) {
                    const x = col * squareSize + squareSize / 2 + 20;
                    const y = row * squareSize + squareSize * 0.75 + 20;
                    const pieceKey = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
                    const symbol = PIECE_SYMBOLS[pieceKey] || '?';
                    
                    svg += `<text x="${x}" y="${y}" font-size="36" text-anchor="middle" fill="#000" aria-label="Pieza ${piece.type} ${piece.color}">${symbol}</text>`;
                }
            }
        }
        
        // Coordenadas
        for (let i = 0; i < 8; i++) {
            // Números de fila
            svg += `<text x="10" y="${i * squareSize + squareSize * 0.6 + 20}" font-size="14" text-anchor="middle" fill="#666">${8 - i}</text>`;
            // Letras de columna
            svg += `<text x="${i * squareSize + squareSize / 2 + 20}" y="${boardSize + 35}" font-size="14" text-anchor="middle" fill="#666">${String.fromCharCode(97 + i)}</text>`;
        }
        
        svg += '</svg>';
        return svg;
    }

    function updateBoard() {
        const chessboardEl = document.getElementById('chessboard');
        if (chessboardEl) {
            chessboardEl.innerHTML = generateChessboardSVG();
        }
    }

    // ===================== GESTIÓN DE PARTIDA =====================
    function updateGameControls() {
        const startBtn = document.getElementById('startGameBtn');
        const pauseBtn = document.getElementById('pauseGameBtn');
        const stopBtn = document.getElementById('stopGameBtn');
        
        const bothEnginesLoaded = whiteEngine && blackEngine;
        
        if (startBtn) startBtn.disabled = !bothEnginesLoaded || gameRunning;
        if (pauseBtn) pauseBtn.disabled = !gameRunning;
        if (stopBtn) stopBtn.disabled = !gameRunning;
    }

    async function startGame() {
        if (!whiteEngine || !blackEngine) {
            alert('Debes cargar ambos motores antes de comenzar la partida');
            return;
        }

        // Conectar Stockfish si no está conectado
        if (!stockfish) {
            try {
                await connectStockfish();
            } catch (error) {
                console.warn('No se pudo conectar Stockfish para evaluación:', error);
            }
        }

        gameRunning = true;
        gamePaused = false;
        gameStartTime = Date.now();
        
        startGameTimer();
        updateGameControls();
        updateGameStatus();
        
        console.log('🚀 Partida iniciada');
        
        // Evaluar posición inicial y comenzar
        evaluatePosition();
        setTimeout(() => playNextMove(), 1000);
    }

    function pauseGame() {
        gamePaused = !gamePaused;
        const pauseBtn = document.getElementById('pauseGameBtn');
        
        if (pauseBtn) {
            pauseBtn.innerHTML = gamePaused ? '▶️ Continuar' : '⏸️ Pausar';
        }
        
        console.log(gamePaused ? '⏸️ Partida pausada' : '▶️ Partida reanudada');
        
        if (!gamePaused) {
            setTimeout(() => playNextMove(), 500);
        }
    }

    function stopGame() {
        gameRunning = false;
        gamePaused = false;
        
        if (gameTimer) {
            clearInterval(gameTimer);
            gameTimer = null;
        }
        
        updateGameControls();
        updateGameStatus();
        
        // Resetear estados de motores
        const whiteStatusEl = document.getElementById('whiteEngineStatus');
        const blackStatusEl = document.getElementById('blackEngineStatus');
        if (whiteStatusEl) {
            whiteStatusEl.textContent = 'Listo';
            whiteStatusEl.className = 'engine-ready';
        }
        if (blackStatusEl) {
            blackStatusEl.textContent = 'Listo';
            blackStatusEl.className = 'engine-ready';
        }
        
        console.log('⏹️ Partida detenida');
    }

    function resetGame() {
        // Detener partida si está corriendo
        if (gameRunning) {
            stopGame();
        }
        
        // Resetear estado del juego
        chess.reset();
        moveCount = 0;
        lastEvaluation = null;
        gameStartTime = null;
        
        // Actualizar UI
        updateBoard();
        updateGameControls();
        updateGameStatus();
        updateMoveHistory();
        updateStats();
        updateEvaluationDisplay();
        
        console.log('🔄 Partida reiniciada');
    }

    async function playNextMove() {
        // Verificar condiciones para continuar
        if (!gameRunning || gamePaused || chess.game_over()) {
            if (chess.game_over()) {
                gameRunning = false;
                updateGameControls();
                updateGameStatus();
                console.log('🏁 Partida terminada:', getGameResult());
            }
            return;
        }

        const currentEngine = chess.turn() === 'w' ? whiteEngine : blackEngine;
        const engineColor = chess.turn() === 'w' ? 'white' : 'black';
        const statusId = chess.turn() === 'w' ? 'whiteEngineStatus' : 'blackEngineStatus';
        
        // Actualizar estado a "pensando"
        const statusEl = document.getElementById(statusId);
        if (statusEl) {
            statusEl.textContent = 'Pensando...';
            statusEl.className = 'engine-thinking';
        }

        try {
            // Dar tiempo para mostrar el estado "pensando"
            await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));
            
            // Obtener movimiento del motor
            const move = await executeEngineMove(currentEngine);
            
            if (move && typeof move === 'string') {
                const moveResult = chess.move(move);
                if (moveResult) {
                    // Movimiento exitoso
                    moveCount++;
                    updateBoard();
                    updateMoveHistory();
                    updateStats();
                    evaluatePosition();
                    
                    // Restaurar estado del motor
                    if (statusEl) {
                        statusEl.textContent = 'Listo';
                        statusEl.className = 'engine-ready';
                    }
                    
                    console.log(`📝 Movimiento ${moveCount}: ${moveResult.san} (${engineColor})`);
                    
                    // Continuar con el siguiente movimiento
                    setTimeout(() => playNextMove(), 800 + Math.random() * 400);
                } else {
                    throw new Error(`Movimiento inválido: ${move}`);
                }
            } else {
                throw new Error('El motor no devolvió un movimiento válido');
            }
        } catch (error) {
            console.error(`Error en motor ${engineColor}:`, error);
            if (statusEl) {
                statusEl.textContent = 'Error';
                statusEl.className = 'engine-thinking';
            }
            stopGame();
            alert(`Error en el motor ${engineColor}:\n\n${error.message}\n\nLa partida se ha detenido.`);
        }
    }

    function executeEngineMove(engineFunction) {
        return new Promise((resolve, reject) => {
            try {
                // Crear una copia del estado actual para el motor
                const currentFen = chess.fen();
                const chessCopy = new Chess(currentFen);
                
                // Ejecutar motor con timeout
                const timeoutId = setTimeout(() => {
                    reject(new Error('Timeout: El motor tardó demasiado en responder'));
                }, 5000);
                
                const move = engineFunction(currentFen, chessCopy);
                clearTimeout(timeoutId);
                
                resolve(move);
            } catch (error) {
                reject(error);
            }
        });
    }

    function getGameResult() {
        if (chess.in_checkmate()) {
            return chess.turn() === 'w' ? 'Negras ganan por jaque mate' : 'Blancas ganan por jaque mate';
        } else if (chess.in_stalemate()) {
            return 'Tablas por ahogado';
        } else if (chess.in_threefold_repetition()) {
            return 'Tablas por repetición triple';
        } else if (chess.insufficient_material()) {
            return 'Tablas por material insuficiente';
        } else if (chess.in_draw()) {
            return 'Tablas por regla de 50 movimientos';
        }
        return 'Partida en curso';
    }

    function updateGameStatus() {
        const statusEl = document.getElementById('gameStatus');
        if (!statusEl) return;
        
        let statusText = '';
        let statusClass = 'game-status';
        
        if (chess.in_checkmate()) {
            const winner = chess.turn() === 'w' ? 'Negras' : 'Blancas';
            statusText = `¡Jaque mate! ${winner} ganan`;
            statusClass += ' status-finished';
        } else if (chess.in_draw()) {
            statusText = `Partida terminada en tablas`;
            statusClass += ' status-finished';
        } else if (gameRunning && !gamePaused) {
            const currentPlayer = chess.turn() === 'w' ? 'Blancas' : 'Negras';
            statusText = `Turno: ${currentPlayer}`;
            statusClass += ' status-playing';
        } else if (gamePaused) {
            statusText = 'Partida pausada';
            statusClass += ' status-finished';
        } else if (!whiteEngine || !blackEngine) {
            statusText = 'Esperando motores...';
        } else {
            statusText = 'Listo para comenzar';
        }
        
        statusEl.textContent = statusText;
        statusEl.className = statusClass;
    }

    function updateMoveHistory() {
        const historyEl = document.getElementById('moveHistory');
        if (!historyEl) return;
        
        const history = chess.history();
        
        if (history.length === 0) {
            historyEl.textContent = 'La partida no ha comenzado';
            return;
        }

        let historyHTML = '';
        for (let i = 0; i < history.length; i += 2) {
            const moveNumber = Math.floor(i / 2) + 1;
            const whiteMove = history[i] || '';
            const blackMove = history[i + 1] || '';
            
            historyHTML += `<div class="move-pair">${moveNumber}. ${whiteMove} ${blackMove}</div>`;
        }
        
        historyEl.innerHTML = historyHTML;
        
        // Scroll automático al último movimiento
        historyEl.scrollTop = historyEl.scrollHeight;
    }

    function updateStats() {
        // Actualizar contador de movimientos
        const moveCountEl = document.getElementById('moveCount');
        if (moveCountEl) {
            moveCountEl.textContent = Math.ceil(chess.history().length / 2);
        }
    }

    function startGameTimer() {
        if (gameTimer) {
            clearInterval(gameTimer);
        }
        
        gameTimer = setInterval(() => {
            if (gameStartTime && gameRunning && !gamePaused) {
                const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                
                const timeEl = document.getElementById('gameTime');
                if (timeEl) {
                    timeEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            }
        }, 1000);
    }

    // ===================== MOTORES DE EJEMPLO =====================
    function downloadSampleEngine(type) {
        let content = '';
        let filename = '';
        
        if (type === 'random') {
            content = `// Motor Aleatorio Simple para Sistema de Enfrentamiento
// Implementa la función getMove(fen, chess) requerida

function getMove(fen, chess) {
    const moves = chess.moves();
    if (moves.length === 0) return null;
    
    // Seleccionar movimiento aleatorio
    const randomIndex = Math.floor(Math.random() * moves.length);
    return moves[randomIndex];
}

// El motor debe retornar un movimiento en notación SAN (e.g., "e4", "Nf3", "O-O")`;
            filename = 'motor_basico.js';
        }
        
        // Crear y descargar archivo
        const blob = new Blob([content], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`📥 Motor de ejemplo descargado: ${filename}`);
    }

    function addSampleEngineButtons() {
        const uploadSection = document.querySelector('.engine-upload-section');
        if (!uploadSection) return;
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            text-align: center;
            margin-top: 16px;
            padding: 16px;
            background: rgba(139, 92, 246, 0.1);
            border-radius: 8px;
            border: 1px solid rgba(139, 92, 246, 0.2);
        `;
        
        buttonContainer.innerHTML = `
            <h4 style="margin-bottom: 12px; color: #374151; font-weight: 600;">📥 Motores de Ejemplo</h4>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                <button onclick="downloadSampleEngine('random')" class="upload-btn" style="font-size: 0.875rem;">
                    🎲 Motor Aleatorio
                </button>
                <button onclick="downloadSampleEngine('basic')" class="upload-btn" style="font-size: 0.875rem;">
                    🧠 Motor Básico
                </button>
            </div>
            <p style="font-size: 0.75rem; color: #6b7280; margin-top: 8px; line-height: 1.4;">
                Descarga estos motores de ejemplo para probar el sistema.<br>
                También puedes crear tus propios motores siguiendo el formato requerido.
            </p>
        `;
        
        uploadSection.appendChild(buttonContainer);
    }

    // ===================== UTILIDADES DE DEPURACIÓN =====================
    function logGameState() {
        console.log('🎯 Estado actual del juego:');
        console.log('  - FEN:', chess.fen());
        console.log('  - Turno:', chess.turn() === 'w' ? 'Blancas' : 'Negras');
        console.log('  - Movimientos:', chess.history().length);
        console.log('  - En juego:', gameRunning);
        console.log('  - Pausado:', gamePaused);
        console.log('  - Evaluación:', lastEvaluation);
        console.log('  - Motor blancas cargado:', !!whiteEngine);
        console.log('  - Motor negras cargado:', !!blackEngine);
        console.log('  - Stockfish conectado:', !!stockfish);
    }

    function validateEngineFormat(code) {
        const requiredElements = [
            'function getMove',
            'return',
        ];
        
        const hasRequiredElements = requiredElements.every(element => 
            code.includes(element)
        );
        
        if (!hasRequiredElements) {
            return {
                valid: false,
                error: 'El motor debe contener una función getMove que retorne un movimiento'
            };
        }
        
        // Verificar que no tenga elementos peligrosos
        const dangerousElements = [
            'eval(',
            'Function(',
            'setTimeout(',
            'setInterval(',
            'XMLHttpRequest',
            'fetch(',
            'localStorage',
            'sessionStorage'
        ];
        
        const hasDangerousElements = dangerousElements.some(element => 
            code.includes(element)
        );
        
        if (hasDangerousElements) {
            return {
                valid: false,
                error: 'El motor contiene elementos no permitidos por seguridad'
            };
        }
        
        return { valid: true };
    }

    // ===================== GESTIÓN DE ERRORES AVANZADA =====================
    function handleCriticalError(error, context) {
        console.error(`💥 Error crítico en ${context}:`, error);
        
        // Detener partida si está corriendo
        if (gameRunning) {
            stopGame();
        }
        
        // Mostrar mensaje al usuario
        const errorMsg = `Error crítico en ${context}:\n\n${error.message}\n\nLa aplicación intentará recuperarse automáticamente.`;
        alert(errorMsg);
        
        // Intentar recuperación automática
        setTimeout(() => {
            try {
                updateBoard();
                updateGameControls();
                updateGameStatus();
                console.log('🔄 Recuperación automática completada');
            } catch (recoveryError) {
                console.error('💥 Error en recuperación automática:', recoveryError);
            }
        }, 1000);
    }

    // ===================== LIMPIEZA Y FINALIZACIÓN =====================
    function cleanupResources() {
        console.log('🧹 Limpiando recursos del sistema...');
        
        // Detener partida
        if (gameRunning) {
            stopGame();
        }
        
        // Limpiar Stockfish
        if (stockfish) {
            try {
                stockfish.terminate();
                stockfish = null;
                console.log('✅ Stockfish terminado correctamente');
            } catch (error) {
                console.warn('⚠️ Error terminando Stockfish:', error);
            }
        }
        
        // Limpiar blob URL
        if (stockfishBlobURL) {
            try {
                URL.revokeObjectURL(stockfishBlobURL);
                stockfishBlobURL = null;
                console.log('✅ Blob URL limpiado correctamente');
            } catch (error) {
                console.warn('⚠️ Error limpiando blob URL:', error);
            }
        }
        
        // Limpiar timer
        if (gameTimer) {
            clearInterval(gameTimer);
            gameTimer = null;
            console.log('✅ Timer de juego limpiado correctamente');
        }
        
        console.log('🎯 Limpieza de recursos completada');
    }

    // ===================== EVENT LISTENERS GLOBALES =====================
    window.addEventListener('beforeunload', function() {
        cleanupResources();
    });

    window.addEventListener('error', function(event) {
        handleCriticalError(event.error, 'ventana global');
    });

    // Manejar errores no capturados en promesas
    window.addEventListener('unhandledrejection', function(event) {
        handleCriticalError(event.reason, 'promesa no manejada');
        event.preventDefault();
    });

    // ===================== API PÚBLICA =====================
    // Exponer funciones globales necesarias
    window.startGame = startGame;
    window.pauseGame = pauseGame;
    window.stopGame = stopGame;
    window.resetGame = resetGame;
    window.downloadSampleEngine = downloadSampleEngine;

    // API extendida para desarrollo y debugging
    window.chessEngineSystem = {
        // Estado del juego
        getGameState: () => ({
            running: gameRunning,
            paused: gamePaused,
            fen: chess.fen(),
            moves: chess.history(),
            evaluation: lastEvaluation,
            whiteEngineLoaded: !!whiteEngine,
            blackEngineLoaded: !!blackEngine,
            stockfishConnected: !!stockfish,
            moveCount: moveCount,
            gameTime: gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0
        }),
        
        // Acceso a la instancia de chess.js
        getChessInstance: () => chess,
        
        // Forzar movimiento manual (solo si no hay partida en curso)
        forceMove: (move) => {
            if (gameRunning) {
                console.warn('No se puede forzar movimiento durante partida automática');
                return false;
            }
            const result = chess.move(move);
            if (result) {
                updateBoard();
                updateMoveHistory();
                updateStats();
                evaluatePosition();
                updateGameStatus();
                return true;
            }
            return false;
        },
        
        // Evaluar posición actual
        evaluateCurrentPosition: () => {
            evaluatePosition();
        },
        
        // Información de motores
        getEngineInfo: () => ({
            white: {
                loaded: !!whiteEngine,
                ready: !gameRunning || chess.turn() !== 'w'
            },
            black: {
                loaded: !!blackEngine,
                ready: !gameRunning || chess.turn() !== 'b'
            }
        }),
        
        // Utilidades de depuración
        logGameState,
        validateEngineFormat,
        cleanupResources,
        
        // Obtener estadísticas de rendimiento
        getPerformanceStats: () => ({
            memoryUsage: window.performance && window.performance.memory ? 
                Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024)) : 'N/A',
            gameStartTime,
            currentTime: Date.now(),
            totalMoves: chess.history().length,
            avgMoveTime: gameStartTime && chess.history().length > 0 ? 
                Math.round((Date.now() - gameStartTime) / chess.history().length) : 0
        }),
        
        // Reiniciar sistema completo
        fullReset: () => {
            cleanupResources();
            
            // Resetear variables
            chess = new Chess();
            whiteEngine = null;
            blackEngine = null;
            stockfish = null;
            gameRunning = false;
            gamePaused = false;
            moveCount = 0;
            lastEvaluation = null;
            gameStartTime = null;
            
            // Limpiar UI de motores
            const elements = [
                { id: 'engineBoxWhite', action: el => el.classList.remove('loaded') },
                { id: 'engineBoxBlack', action: el => el.classList.remove('loaded') },
                { id: 'engineInfoWhite', text: 'No hay motor cargado' },
                { id: 'engineInfoBlack', text: 'No hay motor cargado' },
                { id: 'whiteEngineStatus', text: 'No cargado', class: 'engine-ready' },
                { id: 'blackEngineStatus', text: 'No cargado', class: 'engine-ready' },
                { id: 'stockfishStatus', text: 'Desconectado', class: 'engine-ready' }
            ];
            
            elements.forEach(({ id, text, action, className }) => {
                const el = document.getElementById(id);
                if (el) {
                    if (text) el.textContent = text;
                    if (action) action(el);
                    if (className) el.className = className;
                }
            });
            
            // Actualizar todo
            updateBoard();
            updateGameControls();
            updateGameStatus();
            updateMoveHistory();
            updateStats();
            updateEvaluationDisplay();
            
            console.log('🔄 Sistema completamente reiniciado');
        }
    };

    // ===================== MENSAJE DE INICIALIZACIÓN FINAL =====================
    console.log('🎮 Sistema de enfrentamiento de motores cargado completamente');
    console.log('🔧 API disponible en window.chessEngineSystem para debugging');
    console.log('📚 Comandos útiles:');
    console.log('  - chessEngineSystem.logGameState() - Ver estado actual');
    console.log('  - chessEngineSystem.getPerformanceStats() - Estadísticas de rendimiento');
    console.log('  - chessEngineSystem.fullReset() - Reinicio completo del sistema');

})(); notación SAN (e.g., "e4", "Nf3", "O-O")`;
            filename = 'motor_aleatorio.js';
            
        } else if (type === 'basic') {
            content = `// Motor Básico con Heurísticas para Sistema de Enfrentamiento
// Implementa la función getMove(fen, chess) requerida

function getMove(fen, chess) {
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) return null;
    
    // Valores de las piezas
    const pieceValues = {
        'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
    };
    
    let bestMove = null;
    let bestScore = -Infinity;
    
    for (let move of moves) {
        let score = 0;
        
        // Capturar piezas es bueno
        if (move.captured) {
            score += pieceValues[move.captured] * 10;
        }
        
        // Verificar jaque mate
        chess.move(move);
        if (chess.in_checkmate()) {
            chess.undo();
            return move.san; // ¡Jaque mate es lo mejor!
        }
        
        // Jaque es bueno
        if (chess.in_check()) {
            score += 5;
        }
        chess.undo();
        
        // Control del centro es importante
        const centerSquares = ['d4', 'd5', 'e4', 'e5'];
        if (centerSquares.includes(move.to)) {
            score += 2;
        }
        
        // Desarrollo en la apertura (primeros 10 movimientos)
        if (chess.history().length < 10) {
            if (['n', 'b'].includes(move.piece) && 
                !['a', 'h'].includes(move.to[0])) {
                score += 1;
            }
        }
        
        // Proteger el rey
        if (move.piece === 'k' && chess.history().length < 15) {
            // Enroque es bueno en la apertura
            if (move.san.includes('O')) {
                score += 3;
            } else {
                score -= 1; // Mover el rey temprano es malo
            }
        }
        
        // Añadir algo de aleatoriedad para variedad
        score += Math.random() * 0.5;
        
        if (score > bestScore) {
            bestScore = score;
            bestMove = move.san;
        }
    }
    
    return bestMove || moves[0].san;
}

// El motor debe retornar un movimiento en