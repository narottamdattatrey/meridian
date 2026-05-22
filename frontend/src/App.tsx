/**
 * frontend/src/App.tsx
 */
import React from "react";
import OnboardingForm from "./components/OnboardingForm";

const App: React.FC = () => (
  <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
    <OnboardingForm />
  </main>
);

export default App;
