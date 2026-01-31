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
    <footer className="ftr">
      <span className="ftr-hint">{texts.hint}</span>
      <div className="ftr-nav">
        <Link to="/about" className="ftr-link">
          {texts.about}
        </Link>
      </div>
    </footer>
  );
}
