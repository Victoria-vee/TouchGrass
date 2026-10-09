import { useState } from 'react';

const challenges = [
  { title: 'Take the long way', detail: 'Walk for ten minutes without checking your phone. Notice one thing you have never seen before.', time: '10 min', icon: '↗' },
  { title: 'Find a little green', detail: 'Step outside and find the nearest tree, plant, or patch of grass. Spend a quiet minute with it.', time: '5 min', icon: '✳' },
  { title: 'Follow your ears', detail: 'Pause outdoors and listen. Count three different sounds before you head back in.', time: '3 min', icon: '♫' },
  { title: 'Borrow some sky', detail: 'Find a comfortable spot outside, look up, and watch the clouds drift by for a few minutes.', time: '5 min', icon: '☼' },
];

function LeafMark() {
  return (
    <svg className="leaf-mark" viewBox="0 0 42 42" fill="none" aria-hidden="true">
      <path d="M34.4 7.6C20.2 7.2 10.1 11.5 9.1 21.4c-.6 6.1 4 10.6 9.6 10.1 10.2-1 15.2-11.2 15.7-23.9Z" fill="currentColor" />
      <path d="M8 34c5.6-8.6 11.1-14.1 20-20" stroke="#f6f5ed" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  const [challenge, setChallenge] = useState(null);
  const [lastIndex, setLastIndex] = useState(-1);

  function getChallenge() {
    let nextIndex = Math.floor(Math.random() * challenges.length);
    if (challenges.length > 1 && nextIndex === lastIndex) nextIndex = (nextIndex + 1) % challenges.length;
    setLastIndex(nextIndex);
    setChallenge(challenges[nextIndex]);
  }

  return (
    <main className="page-shell">
      <div className="sun-wash" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Touch Grass home">
          <LeafMark />
          <span>touch grass<span className="brand-period">.</span></span>
        </a>
        <span className="top-note"><span className="status-dot" /> A small nudge for a bigger day</span>
      </header>

      <section className="hero" id="home" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> YOUR INVITATION OUTSIDE</p>
          <h1 id="hero-title">The world is<br />better <em>out there.</em></h1>
          <p className="intro">A little help getting away from the screen and into the fresh air. Pick a simple outdoor challenge, take it at your own pace, and see what you notice.</p>
          <button className="challenge-button" onClick={getChallenge}>
            <span>{challenge ? 'Get another challenge' : 'Get a challenge'}</span>
            <span className="button-arrow" aria-hidden="true">↗</span>
          </button>
          <p className="gentle-note"><span aria-hidden="true">✳</span> No tracking. No streaks. Just a reason to step out.</p>
        </div>

        <div className="art-panel" aria-label="Illustration of a sunlit, rolling green landscape">
          <div className="art-sun" />
          <div className="art-cloud cloud-one" />
          <div className="art-cloud cloud-two" />
          <div className="hill hill-back" />
          <div className="hill hill-mid" />
          <div className="hill hill-front" />
          <div className="art-label"><span className="label-spark">✳</span><span>there's room to breathe</span></div>
          <div className="flower flower-one">✿</div>
          <div className="flower flower-two">✿</div>
          <div className="flower flower-three">✿</div>
        </div>
      </section>

      <section className={`challenge-card${challenge ? ' is-visible' : ''}`} aria-live="polite" aria-atomic="true">
        {challenge ? (
          <>
            <div className="challenge-icon" aria-hidden="true">{challenge.icon}</div>
            <div className="challenge-copy">
              <p className="card-kicker">YOUR LITTLE OUTDOOR PLAN <span>·</span> {challenge.time.toUpperCase()}</p>
              <h2>{challenge.title}</h2>
              <p>{challenge.detail}</p>
            </div>
            <span className="card-leaf" aria-hidden="true"><LeafMark /></span>
          </>
        ) : (
          <>
            <div className="challenge-icon waiting-icon" aria-hidden="true">✳</div>
            <div className="challenge-copy">
              <p className="card-kicker">A MOMENT FOR YOURSELF</p>
              <h2>Your next breath of fresh air starts here.</h2>
              <p>When you're ready, we'll find a small adventure for you.</p>
            </div>
            <span className="card-leaf" aria-hidden="true"><LeafMark /></span>
          </>
        )}
      </section>

      <footer className="footer">
        <span>Made for the moments between everything else.</span>
        <span className="footer-leaves" aria-hidden="true">❧ &nbsp; ☘</span>
      </footer>
    </main>
  );
}
