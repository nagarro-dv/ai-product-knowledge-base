/**
 * A stand-in for the Start page behind the password screen: the topbar,
 * the sidebar menu, the grid of cards and the prompt box, drawn as simple
 * shapes in the app's colours. It's blurred heavily and can't be used —
 * just an impression of what's past the password. No real data.
 */
export function GateBackdrop() {
  return (
    <div className="gateScene" aria-hidden inert>
      <div className="gateScene__topbar">
        <span className="gateScene__logo" />
        <span className="gateScene__bar gateScene__bar--title" />
        <span className="gateScene__pill gateScene__pill--settings" />
      </div>
      <div className="gateScene__body">
        <aside className="gateScene__sidebar">
          <span className="gateScene__nav gateScene__nav--active" />
          <span className="gateScene__nav" />
          <span className="gateScene__nav" />
          <span className="gateScene__bar gateScene__bar--label" />
          <span className="gateScene__bar" />
          <span className="gateScene__bar" />
          <span className="gateScene__bar gateScene__bar--short" />
        </aside>
        <main className="gateScene__main">
          <span className="gateScene__bar gateScene__bar--heading" />
          <span className="gateScene__bar gateScene__bar--subtitle" />
          <div className="gateScene__grid">
            <div className="gateScene__card gateScene__card--proposal">
              <span className="gateScene__bar gateScene__bar--label" />
              <span className="gateScene__bar gateScene__bar--strong" />
              <span className="gateScene__bar" />
              <span className="gateScene__bar gateScene__bar--short" />
              <span className="gateScene__chips">
                <span className="gateScene__pill" />
                <span className="gateScene__pill gateScene__pill--score" />
              </span>
            </div>
            <div className="gateScene__card">
              <span className="gateScene__bar gateScene__bar--label" />
              <span className="gateScene__bar gateScene__bar--number" />
              <span className="gateScene__spark" />
              <span className="gateScene__row" />
              <span className="gateScene__row" />
              <span className="gateScene__row" />
            </div>
            <div className="gateScene__card gateScene__card--tall">
              <span className="gateScene__bar gateScene__bar--label" />
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="gateScene__timeline">
                  <span className="gateScene__dot" data-tone={i === 0 ? "accent" : i < 4 ? "up" : undefined} />
                  <span className="gateScene__bar" />
                </span>
              ))}
            </div>
            <div className="gateScene__card">
              <span className="gateScene__bar gateScene__bar--label" />
              <span className="gateScene__block" />
              <span className="gateScene__block" />
            </div>
            <div className="gateScene__card">
              <span className="gateScene__bar gateScene__bar--label" />
              <span className="gateScene__row" />
              <span className="gateScene__row" />
              <span className="gateScene__row" />
            </div>
          </div>
          <span className="gateScene__composer" />
        </main>
      </div>
    </div>
  );
}
