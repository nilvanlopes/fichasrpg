import React from "react";
import { SheetsDashboard } from "../features/portal/SheetsDashboard";
import { SignupPage } from "../features/portal/SignupPage";
import { SheetRoute } from "../features/sheets/SheetRoute";

export default function App() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments[0] === "cadastro") return <SignupPage />;
  if (segments[0] === "sistemas" && segments.length === 3) {
    return <SheetRoute system={segments[1]} sheetId={segments[2]} />;
  }
  if (segments.length > 0 && !(segments.length === 1 && segments[0] === "fichas")) {
    return <main className="account-notice"><h1>Página não encontrada</h1><a href="/fichas">Voltar às fichas</a></main>;
  }
  return <SheetsDashboard />;
}
