import { useState } from 'react'
import { Rocket, MousePointer2, ChevronRight, Zap, Shield, Cpu } from 'lucide-react'

const features = [
  {
    icon: <Zap size={24} />,
    title: 'Blazing Fast',
    description: 'Optimized for speed and performance, ensuring your application stays ahead of the curve.'
  },
  {
    icon: <Shield size={24} />,
    title: 'Secure by Design',
    description: 'Built-in security protocols to keep your data and users safe from day one.'
  },
  {
    icon: <Cpu size={24} />,
    title: 'Intelligent Logic',
    description: 'Leveraging modern AI patterns to provide smarter interactions and workflows.'
  }
]

export default function Home() {
  const [isHovered, setIsHovered] = useState<number | null>(null)

  return (
    <main>
      <section className="hero animate-fade-in">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--glass-bg)', padding: '0.5rem 1rem', borderRadius: '99px', border: '1px solid var(--glass-border)', marginBottom: '2rem', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--color-primary)' }}>New</span>
          <span style={{ color: 'var(--color-text-dim)' }}>Version 2.0 is now live</span>
          <ChevronRight size={14} color="var(--color-text-dim)" />
        </div>
        <h1 className="hero-h1">
          Build the Future <br /> 
          with <span style={{ color: 'var(--color-primary)' }}>Astra</span>
        </h1>
        <p className="hero-p">
          The next generation framework for building high-performance, 
          visually stunning web applications with React and TypeScript.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="btn-primary">Get Started</button>
          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 2rem', borderRadius: '99px', border: '1px solid var(--glass-border)', color: 'white', background: 'var(--glass-bg)' }}>
            <MousePointer2 size={18} />
            Live Demo
          </button>
        </div>
      </section>

      <section className="features">
        {features.map((feature, index) => (
          <div 
            key={index} 
            className="card animate-fade-in" 
            style={{ animationDelay: `${0.2 + index * 0.1}s` }}
            onMouseEnter={() => setIsHovered(index)}
            onMouseLeave={() => setIsHovered(null)}
          >
            <div className="card-icon" style={{ 
              background: isHovered === index ? 'var(--color-primary)' : 'var(--color-primary-glow)',
              color: isHovered === index ? 'white' : 'var(--color-primary)',
              transition: 'var(--transition-smooth)'
            }}>
              {feature.icon}
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </section>

      <section style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ padding: '1rem', background: 'var(--color-primary-glow)', borderRadius: '50%' }}>
            <Rocket size={32} color="var(--color-primary)" />
          </div>
          <h2>Ready to launch?</h2>
          <p style={{ color: 'var(--color-text-dim)', maxWidth: '500px' }}>
            Join thousands of developers building the next generation of web applications.
          </p>
          <button className="btn-primary">Deploy Now</button>
        </div>
      </section>
    </main>
  )
}
