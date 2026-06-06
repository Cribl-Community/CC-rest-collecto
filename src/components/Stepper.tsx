interface Step {
  label: string;
  path: string;
}

const STEPS: Step[] = [
  { label: 'Import Spec', path: '/spec' },
  { label: 'Select Endpoint', path: '/endpoint' },
  { label: 'Configure', path: '/configure' },
  { label: 'Schedule', path: '/schedule' },
  { label: 'Review & Export', path: '/review' },
];

interface StepperProps {
  currentPath: string;
}

export function Stepper({ currentPath }: StepperProps) {
  const currentIndex = STEPS.findIndex(s => currentPath.startsWith(s.path));

  return (
    <nav className="stepper" aria-label="Wizard steps">
      {STEPS.map((step, i) => {
        const state =
          i < currentIndex ? 'completed' : i === currentIndex ? 'active' : 'pending';
        return (
          <div key={step.path} className={`step step--${state}`}>
            <div className="step-indicator">
              {state === 'completed' ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7L5.5 10.5L12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
            <span className="step-label">{step.label}</span>
            {i < STEPS.length - 1 && <div className="step-connector" />}
          </div>
        );
      })}
    </nav>
  );
}
