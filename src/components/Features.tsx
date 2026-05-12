import { useState } from 'react'
import { Sparkles, Globe, Lock, Users, Zap, Code, Layout, Layers } from 'lucide-react'

const detailedFeatures = [
  {
    icon: <Sparkles size={24} />,
    title: 'AI-Powered Workflows',
    description: 'Integrate state-of-the-art AI models directly into your development process for smarter code generation and testing.',
    color: '#6366f1'
  },
  {
    icon: <Globe size={24} />,
    title: 'Global Edge Network',
    description: 'Deploy your applications to over 100+ locations worldwide with zero configuration for sub-millisecond latency.',
    color: '#a855f7'
  },
  {
    icon: <Lock size={24} />,
    title: 'Enterprise Security',
    description: 'End-to-end encryption, automated vulnerability scanning, and SOC2 compliance out of the box.',
    color: '#ec4899'
  },
  {
    icon: <Users size={24} />,
    title: 'Team Collaboration',
    description: 'Real-time multi-player editing and advanced version control designed for high-performing engineering teams.',
    color: '#3b82f6'
  },
  {
    icon: <Zap size={24} />,
    title: 'Instant Previews',
    description: 'See every change in real-time with instant hot-module replacement and automated preview deployments.',
    color: '#eab308'
  },
  {
    icon: <Code size={24} />,
    title: 'Type-Safe Everything',
    description: 'First-class TypeScript support throughout the entire stack, from frontend to edge functions.',
    color: '#10b981'
  }
]

export default function Features() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <main style={{ paddingTop: '8rem' }}>
      <section style={{ textAlign: 'center', marginBottom: '4rem' }} className="animate-fade-in">
        <h1 className="hero-h1" style={{ fontSize: '3.5rem' }}>Core Capabilities</h1>
        <p className="hero-p">
          Discover the powerful features that make Astra the leading <br />
          choice for modern web development.
        </p>
      </section>

      <section className="features" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))' }}>
        {detailedFeatures.map((feature, index) => (
          <div 
            key={index}
            className="card animate-fade-in"
            style={{ 
              animationDelay: `${0.1 + index * 0.1}s`,
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Background Accent */}
            <div style={{
              position: 'absolute',
              top: '-20%',
              right: '-20%',
              width: '150px',
              height: '150px',
              background: feature.color,
              filter: 'blur(60px)',
              opacity: hoveredIndex === index ? 0.3 : 0.1,
              transition: 'var(--transition-smooth)',
              zIndex: 0
            }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="card-icon" style={{ 
                background: hoveredIndex === index ? feature.color : 'var(--glass-bg)',
                color: hoveredIndex === index ? 'white' : feature.color,
                border: `1px solid ${hoveredIndex === index ? feature.color : 'var(--glass-border)'}`,
                transition: 'var(--transition-smooth)'
              }}>
                {feature.icon}
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{feature.title}</h3>
              <p style={{ lineHeight: '1.6' }}>{feature.description}</p>
              
              <div style={{ 
                marginTop: '1.5rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                color: hoveredIndex === index ? feature.color : 'var(--color-text-dim)',
                fontSize: '0.875rem',
                fontWeight: 600,
                transition: 'var(--transition-smooth)',
                cursor: 'pointer'
              }}>
                Learn more <Sparkles size={14} />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="animate-fade-in" style={{ padding: '6rem 2rem', textAlign: 'center', animationDelay: '0.8s' }}>
        <div style={{ 
          background: 'var(--glass-bg)', 
          border: '1px solid var(--glass-border)', 
          borderRadius: '32px', 
          padding: '4rem 2rem',
          maxWidth: '1000px',
          margin: '0 auto',
          backdropFilter: 'var(--glass-blur)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--color-primary)' }}>99.9%</div>
              <div style={{ color: 'var(--color-text-dim)' }}>Uptime SLA</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--color-secondary)' }}>50ms</div>
              <div style={{ color: 'var(--color-text-dim)' }}>Avg. Latency</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 700, color: '#ec4899' }}>24/7</div>
              <div style={{ color: 'var(--color-text-dim)' }}>Support</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
