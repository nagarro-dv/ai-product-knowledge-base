import { DsCreditScore } from "./CreditScore";
import "./CreditScoreShowcase.css";

const EXAMPLES = [
  { score: 724, badge: "Good", trend: "↑ 12 pts this month", provider: "Experian (UK)" },
  { score: 850, badge: "Excellent", trend: "↑ 5 pts this month", provider: "Equifax (UK)" },
  { score: 520, badge: "Fair", trend: "↓ 3 pts this month", provider: "TransUnion (UK)" },
  { score: 300, badge: "Poor", trend: "↓ 18 pts this month", provider: "Experian (UK)" },
];

/** Playground for **Credit Score** (Figma **XLKRFXYtGQPPHD9cq4JNn8 / 2033:70750**). */
export function CreditScoreShowcase() {
  return (
    <div className="credit-score-showcase" aria-label="Credit Score playground">
      <p className="credit-score-showcase__lead">
        Figma <strong>Credit Score</strong> (<span className="credit-score-showcase__mono">2033:70750</span>) —{" "}
        <span className="credit-score-showcase__mono">DsCreditScore</span> wraps a semicircular arc gauge with
        score value, trend indicator, status badge, and bureau label. Default range: 0–999.
      </p>

      <section className="credit-score-showcase__section" aria-labelledby="cs-examples-heading">
        <h3 id="cs-examples-heading" className="credit-score-showcase__title">
          Score examples
        </h3>
        <ul className="credit-score-showcase__list">
          {EXAMPLES.map((ex) => (
            <li key={ex.score} className="credit-score-showcase__item">
              <DsCreditScore
                score={ex.score}
                badge={ex.badge}
                trend={ex.trend}
                provider={ex.provider}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
