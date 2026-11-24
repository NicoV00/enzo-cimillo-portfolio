import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './pill.css';
import './LegalPage.css';

// Portfolio sin actividad comercial: alcanza con la política de privacidad
// (el aviso legal de la LSSI-CE aplica a sitios que venden o contratan online)
const OWNER = {
  name: 'Enzo Cimillo',
  city: 'Barcelona, Spain',
  email: 'cimillo.enzo@gmail.com',
};

const UPDATED = 'November 2026';

const Mail = () => <a href={`mailto:${OWNER.email}`}>{OWNER.email}</a>;

const Privacy = () => (
  <>
    <h1>Privacy</h1>
    <p className="legal__lead">
      This is a portfolio. There are no accounts, no newsletter, no ads and no cookies.
      Here is everything that happens with your data when you visit.
    </p>

    <section>
      <h2>Who is responsible</h2>
      <p>{OWNER.name}, {OWNER.city}. Contact: <Mail />.</p>
    </section>

    <section>
      <h2>What is processed</h2>
      <p>
        <strong>Hosting.</strong> The site runs on Vercel. To deliver pages, Vercel processes
        technical data such as your IP address, browser and the time of the request, and keeps
        it briefly in server logs. See the{' '}
        <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel privacy policy</a>.
      </p>
      <p>
        <strong>Visit statistics.</strong> Vercel Web Analytics counts page views without cookies
        and without identifying you. Data is aggregated and cannot be traced back to a person.
      </p>
      <p>
        <strong>Fonts and scripts.</strong> Served from this same domain. Nothing is loaded from
        third parties when the page opens.
      </p>
      <p>
        <strong>Email.</strong> If you write to me, I use your address and message only to reply,
        and delete them when they are no longer needed.
      </p>
      <p>
        <strong>Your browser.</strong> The site remembers, for the current session only, that you
        already watched the intro. It is stored in your browser and never sent anywhere.
      </p>
    </section>

    <section>
      <h2>What is not processed</h2>
      <p>No advertising, no tracking cookies, no fingerprinting, no social media embeds. Your data is never sold or shared.</p>
    </section>

    <section>
      <h2>Your rights</h2>
      <p>
        Under the GDPR you can ask for access to your data, correct it, delete it, restrict or object
        to its use, and take it with you. In practice this only applies to email you sent me. Write
        to <Mail />. You can also file a complaint with the Spanish data protection authority (
        <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">AEPD</a>).
      </p>
    </section>

    <p className="legal__meta">Last updated {UPDATED}.</p>
  </>
);

const LegalPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const title = document.title;
    document.title = 'Privacy — Enzo Cimillo';
    window.scrollTo(0, 0);
    return () => { document.title = title; };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') navigate('/'); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="legal" data-nav-tone="light">
      <header className="legal__top">
        <Link className="pill pill--soft" to="/">enzo cimillo</Link>
        <Link className="pill pill--solid" to="/">Close</Link>
      </header>
      <article className="legal__body">
        <Privacy />
      </article>
    </div>
  );
};

export default LegalPage;
