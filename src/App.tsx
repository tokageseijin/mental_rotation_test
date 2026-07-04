import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home';
import { Quiz } from './pages/Quiz';
import { Stats } from './pages/Stats';
import { Settings } from './pages/Settings';
import { useSession } from './store/sessionStore';
import { confirmLeaveQuiz } from './quiz/leaveGuard';

// A persistent left nav gives every top-level feature a fixed, one-click home.
// Rationale: illustrators return to the same 3-4 destinations repeatedly, so a
// stable spatial menu beats hidden/hamburger navigation (recognition > recall).
const NAV = [
  { to: '/quiz', label: 'クイズ' },
  { to: '/', label: 'ライブラリ', end: true },
  { to: '/stats', label: '成績' },
  { to: '/settings', label: '設定' },
];

export default function App() {
  const playing = useSession((s) => s.playing);
  const endSession = useSession((s) => s.endSession);

  // While a quiz session is running, navigating away from it must confirm first
  // (leaving discards the session). Cancel keeps you in the quiz.
  function handleNavClick(e: React.MouseEvent) {
    if (!playing) return;
    if (confirmLeaveQuiz()) endSession();
    else e.preventDefault();
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          Mental Rotation
          <small>立体回転トレーナー</small>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={handleNavClick}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
