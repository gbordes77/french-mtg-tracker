import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Boundary global qui rattrape les erreurs de rendu React.
 *
 * Indispensable pour ce projet : les données viennent d'un scraper externe
 * (magic.gg → JSON), donc un champ `null` ou un format inattendu ne doit
 * pas crasher tout l'arbre — il doit afficher un état d'erreur isolé.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Log côté console pour le debug ; en prod on pourrait wrapper Sentry/PostHog ici.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="min-h-screen flex flex-col items-center justify-center gap-6 px-6"
        style={{
          background: "var(--surface-default)",
          color: "var(--text-primary)",
          fontFamily: "var(--font-body)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "2rem",
            fontWeight: "var(--fw-bold)",
            color: "var(--fr-red)",
          }}
        >
          Erreur d'affichage
        </h1>
        <p
          className="max-w-xl text-center"
          style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
        >
          Le tracker a rencontré une erreur en affichant les données. Tu peux
          réessayer ; si le problème persiste, ouvre une issue sur GitHub.
        </p>
        <pre
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "var(--text-secondary)",
            background: "var(--glass-secondary)",
            padding: "12px 16px",
            borderRadius: "var(--radius-lg)",
            maxWidth: "100%",
            overflowX: "auto",
          }}
        >
          {this.state.error?.message ?? "Erreur inconnue"}
        </pre>
        <button
          type="button"
          onClick={this.reset}
          className="ds-btn ds-btn--primary"
        >
          Réessayer
        </button>
      </div>
    );
  }
}
