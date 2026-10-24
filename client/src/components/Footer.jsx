import { RESTAURANT_INFO } from '../data/aiKnowledgeBase';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <strong>{RESTAURANT_INFO.name}</strong> — {RESTAURANT_INFO.tagline}
        </div>
        <div>
          {RESTAURANT_INFO.address} · {RESTAURANT_INFO.phone}
        </div>
        <div>SRMS · SODV2201 course project · © {year}</div>
      </div>
    </footer>
  );
}
