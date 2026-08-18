function Block({ className = "" }) {
  return <div className={`home-skeleton-block ${className}`} aria-hidden="true" />;
}

export default function HomeSkeleton() {
  return (
    <div className="home-skeleton" aria-label="Loading home content" role="status">
      <div className="home-skeleton-hero">
        <Block className="home-skeleton-hero-art" />
        <div className="home-skeleton-hero-copy">
          <Block className="home-skeleton-title" />
          <Block className="home-skeleton-line" />
          <Block className="home-skeleton-line short" />
          <Block className="home-skeleton-action" />
        </div>
      </div>
      {["Continue Watching", "Trending", "Popular"].map((label) => (
        <section className="home-skeleton-row" key={label}>
          <Block className="home-skeleton-row-title" />
          <div className="home-skeleton-cards">
            {Array.from({ length: 6 }, (_, index) => <Block className="home-skeleton-card" key={index} />)}
          </div>
        </section>
      ))}
      <span className="sr-only">Loading your home screen</span>
    </div>
  );
}
