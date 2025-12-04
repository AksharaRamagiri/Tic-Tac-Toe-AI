// script.js (ES module)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  getDatabase,
  ref,
  set,
  get
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// 🔐 Your Firebase config (REPLACE with your real one)
const firebaseConfig = {
  apiKey: "AIzaSyBiv6EFieKXT-hglFtSnnXJha9XQomfra4",
  authDomain: "tic-tac-toe-ai-7025c.firebaseapp.com",
  projectId: "tic-tac-toe-ai-7025c",
  storageBucket: "tic-tac-toe-ai-7025c.firebasestorage.app",
  messagingSenderId: "613128840966",
  appId: "1:613128840966:web:b4e7c729b3ba3c3692e087",
  measurementId: "G-ZN05PMCLQV"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// =======================
// Global State
// =======================
let currentUser = null;
let board = Array(9).fill('');
let gameActive = true;
let moveHistory = [];
let nodesEvaluated = 0;
let maxDepth = 0;
let count = 0;

let stats = {
  gamesPlayed: 0,
  playerWins: 0,
  botWins: 0,
  draws: 0,
  history: []
};

const PLAYER = 'X';
const BOT = 'O';

const winPatterns = [
  [0, 1, 2], [0, 3, 6], [0, 4, 8],
  [1, 4, 7], [2, 5, 8], [2, 4, 6],
  [3, 4, 5], [6, 7, 8]
];

// =======================
// DOM References
// =======================
const boxes = document.querySelectorAll('.box');
const msgContainer = document.getElementById('msg-container');
const msg = document.getElementById('msg');
const newGameBtn = document.getElementById('new-btn');
const resetBtn = document.getElementById('reset-btn');
const resetStatsBtn = document.getElementById('reset-stats');
const difficultySelect = document.getElementById('difficulty');
const botFirstCheckbox = document.getElementById('bot-first');

const thinkingIndicator = document.getElementById('thinking');
const decisionTimeEl = document.getElementById('decision-time');
const nodesEvalEl = document.getElementById('nodes-evaluated');
const depthEl = document.getElementById('search-depth');
const bestScoreEl = document.getElementById('best-score');
const moveListEl = document.getElementById('move-list');
const algoInfoEl = document.getElementById('algorithm-info');

const gamesPlayedEl = document.getElementById('games-played');
const playerWinsEl = document.getElementById('player-wins');
const botWinsEl = document.getElementById('bot-wins');
const drawsEl = document.getElementById('draws');
const winRateEl = document.getElementById('win-rate');
const historyTbody = document.getElementById('history-tbody');

const authButtons = document.getElementById('auth-buttons');
const userInfo = document.getElementById('user-info');
const userEmailSpan = document.getElementById('user-email');
const guestBanner = document.getElementById('guest-banner');
const loginModal = document.getElementById('login-modal');
const signupModal = document.getElementById('signup-modal');
const loginErrorEl = document.getElementById('login-error');
const signupErrorEl = document.getElementById('signup-error');

// =======================
// Helper Functions
// =======================
function clearAuthErrors() {
  if (loginErrorEl) {
    loginErrorEl.textContent = '';
    loginErrorEl.classList.remove('active');
  }
  if (signupErrorEl) {
    signupErrorEl.textContent = '';
    signupErrorEl.classList.remove('active');
  }
}

// Modals
function openLoginModal() {
  clearAuthErrors();
  loginModal?.classList.add('active');
  signupModal?.classList.remove('active');
}

function openSignupModal() {
  clearAuthErrors();
  signupModal?.classList.add('active');
  loginModal?.classList.remove('active');
}

function closeModals() {
  loginModal?.classList.remove('active');
  signupModal?.classList.remove('active');
  clearAuthErrors();
}

function switchToSignup() {
  closeModals();
  openSignupModal();
}

function switchToLogin() {
  closeModals();
  openLoginModal();
}

// Close modals when clicking outside
window.addEventListener('click', (event) => {
  if (event.target === loginModal || event.target === signupModal) {
    closeModals();
  }
});

// Auth UI
function showLoggedIn(user) {
  if (authButtons) authButtons.style.display = 'none';
  if (userInfo) userInfo.style.display = 'flex';
  if (userEmailSpan) userEmailSpan.textContent = user.email || '';
  if (guestBanner) guestBanner.style.display = 'none';
  currentUser = user;
}

function showLoggedOut() {
  if (authButtons) authButtons.style.display = 'flex';
  if (userInfo) userInfo.style.display = 'none';
  if (guestBanner) guestBanner.style.display = 'block';
  if (userEmailSpan) userEmailSpan.textContent = '';
  currentUser = null;
}

// Stats storage
function saveStats() {
  if (currentUser) {
    const statsRef = ref(database, 'stats/' + currentUser.uid);
    set(statsRef, stats).catch(console.error);
  } else {
    localStorage.setItem('tictactoeStats', JSON.stringify(stats));
  }
}

function loadUserStats(uid) {
  const statsRef = ref(database, 'stats/' + uid);
  get(statsRef)
    .then((snapshot) => {
      if (snapshot.exists()) {
        stats = snapshot.val();
        if (!stats.history) stats.history = [];
      } else {
        stats = {
          gamesPlayed: 0,
          playerWins: 0,
          botWins: 0,
          draws: 0,
          history: []
        };
      }
      applyStatsToUI();
    })
    .catch(console.error);
}

function loadGuestStats() {
  const raw = localStorage.getItem('tictactoeStats');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      stats = Object.assign(
        { gamesPlayed: 0, playerWins: 0, botWins: 0, draws: 0, history: [] },
        parsed
      );
    } catch (e) {
      console.error(e);
    }
  }
  applyStatsToUI();
}

function applyStatsToUI() {
  if (!stats.history) stats.history = [];

  if (gamesPlayedEl) gamesPlayedEl.textContent = stats.gamesPlayed || 0;
  if (playerWinsEl) playerWinsEl.textContent = stats.playerWins || 0;
  if (botWinsEl) botWinsEl.textContent = stats.botWins || 0;
  if (drawsEl) drawsEl.textContent = stats.draws || 0;

  const total = stats.gamesPlayed || 0;
  let rate = 0;
  if (total > 0) {
    rate = Math.round(((stats.playerWins || 0) / total) * 100);
  }
  if (winRateEl) winRateEl.textContent = rate + '%';

  if (historyTbody) {
    historyTbody.innerHTML = '';
    stats.history.slice(0, 10).forEach((game, idx) => {
      const tr = document.createElement('tr');
      const numTd = document.createElement('td');
      const resTd = document.createElement('td');
      const diffTd = document.createElement('td');
      numTd.textContent = idx + 1;
      resTd.textContent = game.result;
      diffTd.textContent = game.difficulty;
      tr.appendChild(numTd);
      tr.appendChild(resTd);
      tr.appendChild(diffTd);
      historyTbody.appendChild(tr);
    });
  }
}

// Auth handlers
function handleSignup(event) {
  event.preventDefault();
  clearAuthErrors();

  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  if (!name || !email || !password) return;

  createUserWithEmailAndPassword(auth, email, password)
    .then((cred) => {
      const uid = cred.user.uid;
      const userRef = ref(database, 'users/' + uid);
      return set(userRef, {
        name,
        email,
        createdAt: Date.now()
      });
    })
    .then(() => {
      closeModals();
    })
    .catch((err) => {
      console.error(err);
      let message = 'Could not create account. Please try again.';

      if (err.code === 'auth/email-already-in-use') {
        message = 'An account already exists with this email. Try logging in instead.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password is too weak. Please use at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      }

      signupErrorEl.textContent = message;
      signupErrorEl.classList.add('active');
    });
}


function handleLogin(event) {
  event.preventDefault();
  clearAuthErrors();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      closeModals();
    })
    .catch((err) => {
      console.error(err);

      let message = 'Something went wrong. Please try again.';

      // Newer Firebase uses auth/invalid-credential for "wrong email/password"
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        message = 'Incorrect email or password. Please try again.';
      } else if (err.code === 'auth/user-not-found') {
        message = 'No account found with this email. Please sign up first.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Please wait a bit and try again.';
      }

      loginErrorEl.textContent = message;
      loginErrorEl.classList.add('active');
    });
}


function logout() {
  signOut(auth).catch(console.error);
}

// Expose auth functions to HTML
window.openLoginModal = openLoginModal;
window.openSignupModal = openSignupModal;
window.closeModals = closeModals;
window.switchToLogin = switchToLogin;
window.switchToSignup = switchToSignup;
window.handleSignup = handleSignup;
window.handleLogin = handleLogin;
window.logout = logout;

// =======================
// Game Logic
// =======================
function indexToCoord(index) {
  const row = Math.floor(index / 3) + 1;
  const col = (index % 3) + 1;
  return `(${row}, ${col})`;
}

function renderMoveHistory() {
  if (!moveListEl) return;
  moveListEl.innerHTML = '';
  moveHistory.forEach((move, idx) => {
    const div = document.createElement('div');
    div.classList.add('move-item', move.player);
    div.textContent = `${idx + 1}. ${move.player === 'player' ? 'Player' : 'Bot'} → ${indexToCoord(move.index)}`;
    moveListEl.appendChild(div);
  });
}

function updateMetrics(timeMs, nodes, depth, bestScore) {
  if (decisionTimeEl) decisionTimeEl.textContent = timeMs + 'ms';
  if (nodesEvalEl) nodesEvalEl.textContent = nodes;
  if (depthEl) depthEl.textContent = depth;
  if (bestScoreEl) bestScoreEl.textContent = bestScore;
}

function updateAlgorithmInfo() {
  if (!algoInfoEl) return;
  const diff = difficultySelect.value;
  let title = 'Current Algorithm: ';
  let desc = '';

  if (diff === 'easy') {
    title += 'Easy (Random)';
    desc = 'The AI chooses randomly from available moves. Models a non-rational agent.';
  } else if (diff === 'medium') {
    title += 'Medium (Heuristic)';
    desc = 'The AI tries to win, blocks threats, and prefers center/corner positions.';
  } else {
    title += 'Hard (Minimax)';
    desc = 'The AI uses minimax to search all future game states and play optimally.';
  }

  algoInfoEl.innerHTML = `
    <h3>${title}</h3>
    <p style="font-size: 0.9em; color: #666;">${desc}</p>
  `;
}

function resetBoard() {
  board = Array(9).fill('');
  count = 0;
  gameActive = true;
  moveHistory = [];
  nodesEvaluated = 0;
  maxDepth = 0;

  boxes.forEach((box) => {
    box.textContent = '';
    box.disabled = false;
    box.classList.remove('player', 'bot');
  });

  if (msgContainer) msgContainer.classList.add('hide');
  if (thinkingIndicator) thinkingIndicator.classList.remove('active');

  renderMoveHistory();
  updateMetrics(0, 0, 'N/A', 'N/A');

  if (botFirstCheckbox && botFirstCheckbox.checked) {
    setTimeout(botMove, 300);
  }
}

function getWinner() {
  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return board[a]; // 'X' or 'O'
    }
  }
  if (board.every((cell) => cell !== '')) {
    return 'draw';
  }
  return null;
}

function endGame(winner) {
  gameActive = false;
  boxes.forEach((box) => (box.disabled = true));

  let text = '';
  let result = '';

  if (winner === PLAYER) {
    text = '🎉 You win!';
    stats.playerWins += 1;
    result = 'Player Win';
  } else if (winner === BOT) {
    text = '🤖 Bot wins!';
    stats.botWins += 1;
    result = 'Bot Win';
  } else {
    text = '🤝 It\'s a draw.';
    stats.draws += 1;
    result = 'Draw';
  }

  stats.gamesPlayed += 1;
  stats.history.unshift({
    result,
    difficulty: difficultySelect.value,
    timestamp: Date.now()
  });

  applyStatsToUI();
  saveStats();

  if (msgContainer && msg) {
    msg.textContent = text;
    msgContainer.classList.remove('hide');
  }
}

function handleBoxClick(event) {
  const index = parseInt(event.target.getAttribute('data-index'), 10);
  if (!gameActive || board[index]) return;
  makeMove(index, 'player');
}

function makeMove(index, who) {
  const symbol = who === 'player' ? PLAYER : BOT;
  board[index] = symbol;
  count++;

  const box = boxes[index];
  if (box) {
    box.textContent = symbol;
    box.classList.add(who === 'player' ? 'player' : 'bot');
    box.disabled = true;
  }

  moveHistory.push({ player: who, index });
  renderMoveHistory();

  const winner = getWinner();
  if (winner) {
    endGame(winner === 'draw' ? 'draw' : winner);
    return;
  }

  if (who === 'player') {
    setTimeout(botMove, 300);
  }
}

function getEmptyIndices() {
  const indices = [];
  board.forEach((cell, idx) => {
    if (!cell) indices.push(idx);
  });
  return indices;
}

function randomMove() {
  const empty = getEmptyIndices();
  if (empty.length === 0) return null;
  const choice = empty[Math.floor(Math.random() * empty.length)];
  nodesEvaluated = empty.length;
  maxDepth = 1;
  return choice;
}

function heuristicMove() {
  const empty = getEmptyIndices();
  if (empty.length === 0) return null;

  // 1. Try to win
  for (const idx of empty) {
    nodesEvaluated++;
    board[idx] = BOT;
    if (getWinner() === BOT) {
      board[idx] = '';
      return idx;
    }
    board[idx] = '';
  }

  // 2. Block player win
  for (const idx of empty) {
    nodesEvaluated++;
    board[idx] = PLAYER;
    if (getWinner() === PLAYER) {
      board[idx] = '';
      return idx;
    }
    board[idx] = '';
  }

  // 3. Center
  if (empty.includes(4)) {
    maxDepth = 1;
    return 4;
  }

  // 4. Corners
  const corners = [0, 2, 6, 8].filter((i) => empty.includes(i));
  if (corners.length > 0) {
    maxDepth = 1;
    return corners[Math.floor(Math.random() * corners.length)];
  }

  // 5. Any
  maxDepth = 1;
  return empty[Math.floor(Math.random() * empty.length)];
}

function minimaxRoot() {
  const empty = getEmptyIndices();
  let bestScore = -Infinity;
  let bestIndex = null;
  maxDepth = 0;

  for (const idx of empty) {
    board[idx] = BOT;
    const score = minimax(false, 0);
    board[idx] = '';
    if (score > bestScore) {
      bestScore = score;
      bestIndex = idx;
    }
  }

  return { index: bestIndex, score: bestScore };
}

function minimax(isMaximizing, depth) {
  nodesEvaluated++;
  if (depth > maxDepth) maxDepth = depth;

  const winner = getWinner();
  if (winner === BOT) return 10 - depth;
  if (winner === PLAYER) return depth - 10;
  if (winner === 'draw') return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (const idx of getEmptyIndices()) {
      board[idx] = BOT;
      const val = minimax(false, depth + 1);
      board[idx] = '';
      best = Math.max(best, val);
    }
    return best;
  } else {
    let best = Infinity;
    for (const idx of getEmptyIndices()) {
      board[idx] = PLAYER;
      const val = minimax(true, depth + 1);
      board[idx] = '';
      best = Math.min(best, val);
    }
    return best;
  }
}

function botMove() {
  if (!gameActive) return;

  const diff = difficultySelect.value;
  nodesEvaluated = 0;
  maxDepth = 0;

  if (thinkingIndicator) thinkingIndicator.classList.add('active');

  const start = performance.now();
  let moveIndex = null;
  let bestScoreDisplay = 'N/A';

  if (diff === 'easy') {
    moveIndex = randomMove();
  } else if (diff === 'medium') {
    moveIndex = heuristicMove();
  } else {
    const result = minimaxRoot();
    moveIndex = result.index;
    bestScoreDisplay = result.score;
  }
  const end = performance.now();

  if (thinkingIndicator) thinkingIndicator.classList.remove('active');

  if (moveIndex !== null && board[moveIndex] === '') {
    makeMove(moveIndex, 'bot');
  }

  updateMetrics(
    Math.round(end - start),
    nodesEvaluated,
    maxDepth || 'N/A',
    bestScoreDisplay
  );
}

// =======================
// Event Listeners
// =======================
boxes.forEach((box) => {
  box.addEventListener('click', handleBoxClick);
});

if (newGameBtn) {
  newGameBtn.addEventListener('click', resetBoard);
}

if (resetBtn) {
  resetBtn.addEventListener('click', resetBoard);
}

if (resetStatsBtn) {
  resetStatsBtn.addEventListener('click', () => {
    stats = {
      gamesPlayed: 0,
      playerWins: 0,
      botWins: 0,
      draws: 0,
      history: []
    };
    applyStatsToUI();
    saveStats();
  });
}

// if (difficultySelect) {
//   difficultySelect.addEventListener('change', updateAlgorithmInfo);
// }

if (difficultySelect) {
  difficultySelect.addEventListener('change', () => {
    updateAlgorithmInfo(); // update the AI description text
    resetBoard();          // start a fresh game with empty board
  });
}




if (botFirstCheckbox) {
  botFirstCheckbox.addEventListener('change', () => {
    // Whenever the user toggles "Bot plays first",
    // start a fresh game and let the bot open if it's checked.
    resetBoard();
  });
}



// =======================
// Auth State Listener
// =======================
onAuthStateChanged(auth, (user) => {
  if (user) {
    showLoggedIn(user);
    loadUserStats(user.uid);
  } else {
    showLoggedOut();
    loadGuestStats();
  }
});

// =======================
// Init
// =======================
updateAlgorithmInfo();
resetBoard();
loadGuestStats();
