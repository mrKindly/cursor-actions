import { useState } from 'react'
import './App.css'
import Home from './components/Home'
import Features from './components/Features'

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'features'>('home')

  return (
    <div className="app-container">
      <div className="bg-glow" />
      
      <nav className="navbar">
        <div 
          className="nav-logo" 
          onClick={() => setCurrentPage('home')} 
          style={{ cursor: 'pointer' }}
        >
          ASTRA
        </div>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <button 
            onClick={() => setCurrentPage('features')}
            style={{ 
              color: currentPage === 'features' ? 'var(--color-primary)' : 'var(--color-text-dim)',
              fontWeight: currentPage === 'features' ? 600 : 400,
              transition: 'var(--transition-smooth)'
            }}
          >
            Features
          </button>
          <button style={{ color: 'var(--color-text-dim)' }}>About</button>
          <button className="btn-primary" style={{ padding: '0.5rem 1.5rem' }}>Login</button>
        </div>
      </nav>

      {currentPage === 'home' ? <Home /> : <Features />}

      <footer style={{ padding: '4rem 2rem', borderTop: '1px solid var(--glass-border)', textAlign: 'center', color: 'var(--color-text-dim)', fontSize: '0.875rem' }}>
        <p>© 2026 Astra Framework. Built with passion for developers.</p>
      </footer>
    </div>
  )
}

export default App
