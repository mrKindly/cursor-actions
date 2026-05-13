import { useState } from 'react'
import { Home } from './components/Home'
import { Features } from './components/Features'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'features'>('home')

  return (
    <div className="app-container">
      <div className="bg-glow" />
      <div className="bg-glow-secondary" />
      
      <nav className="navbar">
        <div className="nav-logo" onClick={() => setCurrentPage('home')}>ASTRA</div>
        <div className="nav-links">
          <button 
            className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => setCurrentPage('home')}
          >
            Home
          </button>
          <button 
            className={`nav-link ${currentPage === 'features' ? 'active' : ''}`}
            onClick={() => setCurrentPage('features')}
          >
            Features
          </button>
          <button className="nav-link">About</button>
          <button className="btn-primary" style={{ padding: '0.5rem 1.5rem', fontSize: '0.875rem' }}>Login</button>
        </div>
      </nav>

      {currentPage === 'home' ? <Home /> : <Features onBack={() => setCurrentPage('home')} />}

      <footer style={{ padding: '4rem 2rem', borderTop: '1px solid var(--glass-border)', textAlign: 'center', color: 'var(--color-text-dim)', fontSize: '0.875rem', marginTop: '4rem' }}>
        <p>© 2026 Astra Framework. Built with passion for developers.</p>
      </footer>
    </div>
  )
}

export default App
