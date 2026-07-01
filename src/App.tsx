import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home';
import { Quiz } from './pages/Quiz';
import { Stats } from './pages/Stats';
import { Settings } from './pages/Settings';

// A persistent left nav gives every top-level feature a fixed, one-click home.
// Rationale: illustrators return to the same 3-4 destinations repeatedly, so a
// stable spatial menu beats hidden/hamburger navigation (recognition > recall).
const NAV = [
  { to: '/', label: 'ライブラリ', end: true },
  { to: '/quiz', label: 'クイズ' },
  { to: '/stats', label: '成績' },
  { to: '/settings', label: '設定' },
];

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          Mental Rotation
          <small>立体回転トレーナー</small>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
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
