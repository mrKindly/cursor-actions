import { Zap, Shield, Cpu, Cloud, Globe, Lock, BarChart3, Users, Code2, ArrowLeft } from 'lucide-react'
import { useState } from 'react'

interface FeaturesProps {
  onBack: () => void
}

const featureDetails = [
  {
    icon: <Zap size={32} />,
    title: 'Instant Deployment',
    description: 'Deploy your applications to the edge in seconds with our automated CI/CD pipeline.',
    category: 'Performance'
  },
  {
    icon: <Shield size={32} />,
    title: 'Enterprise Security',
    description: 'Advanced encryption and SOC2 compliance built into the core of your infrastructure.',
    category: 'Security'
  },
  {
    icon: <Cpu size={32} />,
    title: 'AI Integration',
    description: 'Native support for leading LLMs and vector databases for intelligent features.',
    category: 'Intelligence'
  },
  {
    icon: <Cloud size={32} />,
    title: 'Global Edge Network',
    description: 'Serve your content from over 300 locations worldwide for minimal latency.',
    category: 'Infrastructure'
  },
  {
    icon: <Globe size={32} />,
    title: 'Universal Scalability',
    description: 'Auto-scaling architecture that grows with your user base without manual intervention.',
    category: 'Infrastructure'
  },
  {
    icon: <Lock size={32} />,
    title: 'Zero Trust Auth',
    description: 'Modern authentication patterns including passkeys and multi-factor security.',
    category: 'Security'
  },
  {
    icon: <BarChart3 size={32} />,
    title: 'Real-time Analytics',
    description: 'Deep insights into your application performance and user behavior in real-time.',
    category: 'Performance'
  },
  {
    icon: <Users size={32} />,
    title: 'Team Collaboration',
    description: 'Built-in tools for seamless developer experience and project management.',
    category: 'Productivity'
  },
  {
    icon: <Code2 size={32} />,
    title: 'Developer First API',
    description: 'Intuitive SDKs and comprehensive documentation for every major programming language.',
    category: 'Productivity'
  }
]

export function Features({ onBack }: FeaturesProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div className="features-page animate-fade-in">
      <header className="features-header">
        <h1 className="hero-h1">Powerful Features for <br /><span style={{ color: 'var(--color-primary)' }}>Modern Developers</span></h1>
        <p className="hero-p">Everything you need to build, scale, and secure your next big idea.</p>
      </header>

      <div className="features-grid">
        {featureDetails.map((feature, index) => (
          <div 
            key={index}
            className="feature-card-detailed"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{ animationDelay: `${0.1 * index}s` }}
          >
            <div className={`feature-icon-wrapper ${hoveredIndex === index ? 'active' : ''}`}>
              {feature.icon}
            </div>
            <div className="feature-content">
              <span className="feature-category">{feature.category}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
            {hoveredIndex === index && (
              <div className="feature-glow" />
            )}
          </div>
        ))}
      </div>

      <section className="cta-section">
        <div className="card glass-card">
          <h2>Ready to explore?</h2>
          <p>Get started today and experience the future of web development.</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className="btn-primary">Start Building Now</button>
            <button className="btn-secondary" onClick={onBack}>
              <ArrowLeft size={18} />
              Back to Home
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
