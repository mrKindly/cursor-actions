import { Users, Target, Rocket, Heart, ArrowLeft, Github, Twitter, Linkedin } from 'lucide-react'

interface AboutProps {
  onBack: () => void
}

export function About({ onBack }: AboutProps) {
  const team = [
    {
      name: 'Alex Rivera',
      role: 'Lead Architect',
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200&h=200'
    },
    {
      name: 'Sarah Chen',
      role: 'Design Director',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200&h=200'
    },
    {
      name: 'Marcus Thorne',
      role: 'Security Engineer',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200&h=200'
    }
  ]

  return (
    <div className="about-page animate-fade-in">
      <header className="about-header">
        <h1 className="hero-h1">The Story Behind <br /><span style={{ color: 'var(--color-primary)' }}>Astra Framework</span></h1>
        <p className="hero-p">We're on a mission to redefine how the world builds for the web.</p>
      </header>

      <section className="about-grid">
        <div className="card glass-card about-mission">
          <div className="card-icon" style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>
            <Target size={24} />
          </div>
          <h2>Our Mission</h2>
          <p>
            To empower developers with the tools they need to create exceptionally fast, 
            secure, and beautiful applications without the traditional complexity. 
            We believe the future of the web is bright, and we're building the foundation 
            to help you get there faster.
          </p>
        </div>

        <div className="card glass-card about-values">
          <div className="card-icon" style={{ background: 'rgba(168, 85, 247, 0.2)', color: 'var(--color-secondary)' }}>
            <Heart size={24} />
          </div>
          <h2>Core Values</h2>
          <ul className="values-list">
            <li><strong>Performance First:</strong> Every millisecond counts.</li>
            <li><strong>Security by Default:</strong> Safety is not an afterthought.</li>
            <li><strong>Aesthetic Excellence:</strong> Beauty is a functional requirement.</li>
            <li><strong>Developer Joy:</strong> Tools should inspire, not hinder.</li>
          </ul>
        </div>
      </section>

      <section className="team-section">
        <h2 className="section-title">Meet the Visionaries</h2>
        <div className="team-grid">
          {team.map((member, index) => (
            <div key={index} className="team-card card">
              <div className="member-image">
                <img src={member.image} alt={member.name} />
              </div>
              <h3>{member.name}</h3>
              <p className="member-role">{member.role}</p>
              <div className="member-socials">
                <Github size={18} />
                <Twitter size={18} />
                <Linkedin size={18} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <div className="card glass-card">
          <Rocket size={40} color="var(--color-primary)" style={{ marginBottom: '1rem' }} />
          <h2>Join the Journey</h2>
          <p>We are always looking for passionate people to help us build the future.</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className="btn-primary">View Openings</button>
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
