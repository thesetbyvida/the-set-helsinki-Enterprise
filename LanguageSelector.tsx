import { useApp } from "../context/AppContext";
import type { Language } from "../types/app";

export function LanguageSelector() {
  const { language, setLanguage } = useApp();

  return (
    <select
      className="language-selector"
      value={language}
      onChange={(event) => setLanguage(event.target.value as Language)}
      aria-label="Language"
    >
      <option value="es">Español</option>
      <option value="en">English</option>
      <option value="fi">Suomi</option>
    </select>
  );
}
