/**
 * frontend/src/App.tsx
 */
import React from "react";
import OnboardingForm from "./components/OnboardingForm";

/**
 * Full-viewport centred shell.
 * bg-body  → picks up $body-bg from theme.scss ($light / #f8fafc)
 * min-vh-100 → at least full viewport height
 * d-flex / align-items-center → vertically centre the card
 * py-5 → breathing room on short viewports
 */
const App: React.FC = () => (
  <main className="min-vh-100 d-flex align-items-center bg-body py-5">
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
          <OnboardingForm />
        </div>
      </div>
    </div>
  </main>
);

export default App;
