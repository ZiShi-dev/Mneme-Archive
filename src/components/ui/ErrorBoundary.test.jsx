import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary.jsx";
import { setRuntimeLocale } from "../../i18n/runtime.js";

function Boom() {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    setRuntimeLocale("fr");
    render(
      <ErrorBoundary>
        <p>Contenu OK</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Contenu OK")).toBeInTheDocument();
  });

  it("shows fallback UI and recovers on retry", () => {
    setRuntimeLocale("fr");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let shouldThrow = true;

    function MaybeBoom() {
      if (shouldThrow) throw new Error("boom");
      return <p>Recovered</p>;
    }

    render(
      <ErrorBoundary>
        <MaybeBoom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/application a rencontré une erreur/i)).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: /réessayer/i }));
    expect(screen.getByText("Recovered")).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
