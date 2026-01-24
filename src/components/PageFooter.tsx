// src/components/PageFooter.tsx
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

export function PageFooter() {
  const { language } = useAppContext();

  const texts =
    language === "en"
      ? {
          hint: "Guided breathing sessions. Wim Hof Method.",
          about: "About",
        }
      : {
          hint: "Дыхательные практики с инструктором по методу Вима Хофа",
          about: "О проекте",
        };

  return (
    <footer className="page-footer">
      <span className="page-footer-hint">{texts.hint}</span>
      <div className="page-footer-links">
        <Link to="/about" className="page-footer-link">
          {texts.about}
        </Link>
      </div>
    </footer>
  );
}
