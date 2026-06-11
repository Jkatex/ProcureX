type ProcurexLoadingPageProps = {
  title?: string;
  message?: string;
};

export function ProcurexLoadingPage({ title = 'Loading ProcureX...', message = 'Preparing the procurement workspace.' }: ProcurexLoadingPageProps) {
  return (
    <div className="procurex-loading-page" role="status" aria-live="polite" aria-label={title}>
      <div className="loading-animation-shell" aria-hidden="true">
        <dotlottie-player className="procurex-lottie procurex-lottie-lg" src="/assets/ProcureX.json" background="transparent" speed="1" loop autoplay />
      </div>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}
