// src/pages/AboutPage.tsx
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { TopBar } from "../components/TopBar";
import { BreathingIcon } from "../components/Icons";

export function AboutPage() {
  const navigate = useNavigate();
  const { language } = useAppContext();

  const handleBack = () => {
    navigate("/");
  };

  if (language === "ru") {
    return (
      <div className="wrap">
        <TopBar showBack onBack={handleBack} />

        <main className="main">
          <article className="abt">
            <header className="hdr">
              <BreathingIcon className="ico" />
              <h1>О методе Вим Хофа</h1>
            </header>

            <section className="abt-sec">
              <h2>Что такое метод Вим Хофа?</h2>
              <p>
                Метод Вим Хофа — это техника дыхания, разработанная голландцем
                Вимом Хофом, также известным как «Ледяной человек». Метод
                состоит из трёх компонентов: специальное дыхание, холодовая
                терапия и медитация.
              </p>
              <p>
                Основная идея метода — возможность сознательно влиять на
                автономную нервную систему, которая обычно работает
                бессознательно и контролирует дыхание, пищеварение и
                терморегуляцию.
              </p>
            </section>

            <section className="abt-sec">
              <h2>Как выполнять дыхание по Вим Хофу</h2>
              <ol>
                <li>Примите удобную позу сидя или лёжа</li>
                <li>
                  Сделайте 30-40 глубоких быстрых вдохов — вдыхайте через нос
                  или рот, выдыхайте через рот
                </li>
                <li>
                  Каждый вдох должен наполнять живот и грудь, дыхание —
                  короткими мощными циклами
                </li>
                <li>
                  После последнего выдоха задержите дыхание на максимально
                  комфортное время
                </li>
                <li>
                  Затем сделайте глубокий вдох и задержите воздух на 15 секунд
                </li>
                <li>Это один раунд. Выполните 3-4 раунда за сессию</li>
              </ol>
            </section>

            <section className="abt-sec">
              <h2>Возможные эффекты</h2>
              <ul>
                <li>Покалывание в теле, особенно в пальцах рук и ног</li>
                <li>Лёгкое головокружение</li>
                <li>Ощущение эйфории и спокойствия после практики</li>
              </ul>
              <p className="abt-warn">
                <strong>Важно:</strong> Никогда не выполняйте эту технику за
                рулём, в воде или в любой ситуации, где потеря сознания может
                быть опасна.
              </p>
            </section>

            <section className="abt-sec">
              <h2>Заявленные преимущества</h2>
              <ul>
                <li>Повышение уровня энергии</li>
                <li>Снижение стресса и тревожности</li>
                <li>Улучшение иммунной системы</li>
                <li>Улучшение качества сна</li>
                <li>Повышение концентрации и силы воли</li>
              </ul>
            </section>

            <section className="abt-sec abt-faq">
              <h2>Часто задаваемые вопросы</h2>

              <details>
                <summary>Безопасно ли дыхание по методу Вим Хофа?</summary>
                <p>
                  Для большинства здоровых людей техника безопасна. Однако она
                  не рекомендуется беременным, людям с эпилепсией, сердечными
                  заболеваниями или высоким кровяным давлением. При сомнениях
                  проконсультируйтесь с врачом.
                </p>
              </details>

              <details>
                <summary>Как часто нужно практиковать?</summary>
                <p>
                  Рекомендуется практиковать ежедневно, желательно утром
                  натощак. Одна сессия занимает около 15-20 минут.
                </p>
              </details>

              <details>
                <summary>Когда появятся результаты?</summary>
                <p>
                  Многие отмечают улучшение самочувствия уже после первой
                  сессии. Для устойчивых результатов рекомендуется регулярная
                  практика в течение нескольких недель.
                </p>
              </details>

              <details>
                <summary>Можно ли практиковать перед сном?</summary>
                <p>
                  Техника может быть стимулирующей, поэтому лучше практиковать
                  утром или днём. Если практикуете вечером, делайте это минимум
                  за 2 часа до сна.
                </p>
              </details>

              <details>
                <summary>Что такое «задержка дыхания»?</summary>
                <p>
                  После серии быстрых вдохов вы выдыхаете и не дышите, пока
                  комфортно. Это не соревнование — слушайте своё тело и дышите,
                  когда чувствуете необходимость.
                </p>
              </details>
            </section>

            <footer className="abt-ftr">
              <p>
                Это приложение — некоммерческий проект для совместных
                дыхательных практик. Аудио-инструкции принадлежат их авторам.
              </p>
            </footer>
          </article>
        </main>
      </div>
    );
  }

  // English version
  return (
    <div className="wrap">
      <TopBar showBack onBack={handleBack} />

      <main className="main">
        <article className="abt">
          <header className="hdr">
              <BreathingIcon className="ico" />
            <h1>About Wim Hof Method</h1>
          </header>

          <section className="abt-sec">
            <h2>What is the Wim Hof Method?</h2>
            <p>
              The Wim Hof Method is a breathing technique developed by Dutch
              athlete Wim Hof, also known as "The Iceman". The method consists
              of three components: specific breathing exercises, cold therapy,
              and meditation.
            </p>
            <p>
              The core idea is that you can consciously influence your autonomic
              nervous system, which normally operates unconsciously and controls
              breathing, digestion, and temperature regulation.
            </p>
          </section>

          <section className="abt-sec">
            <h2>How to Do Wim Hof Breathing</h2>
            <ol>
              <li>Get into a comfortable position, sitting or lying down</li>
              <li>
                Take 30-40 quick, deep breaths — inhale through nose or mouth,
                exhale through mouth
              </li>
              <li>
                Each breath should fill both belly and chest in short, powerful
                bursts
              </li>
              <li>
                After the last exhale, hold your breath for as long as
                comfortable
              </li>
              <li>
                Then take one deep breath and hold it for about 15 seconds
              </li>
              <li>This completes one round. Do 3-4 rounds per session</li>
            </ol>
          </section>

          <section className="abt-sec">
            <h2>Possible Effects</h2>
            <ul>
              <li>Tingling sensations, especially in fingers and toes</li>
              <li>Light-headedness or dizziness</li>
              <li>Feelings of euphoria and calm after practice</li>
            </ul>
            <p className="abt-warn">
              <strong>Important:</strong> Never practice while driving, in
              water, or in any situation where losing consciousness could be
              dangerous.
            </p>
          </section>

          <section className="abt-sec">
            <h2>Claimed Benefits</h2>
            <ul>
              <li>Increased energy levels</li>
              <li>Reduced stress and anxiety</li>
              <li>Improved immune system function</li>
              <li>Better sleep quality</li>
              <li>Enhanced focus and willpower</li>
            </ul>
          </section>

          <section className="abt-sec abt-faq">
            <h2>Frequently Asked Questions</h2>

            <details>
              <summary>Is Wim Hof breathing safe?</summary>
              <p>
                For most healthy people, the technique is safe. However, it's
                not recommended for pregnant women, people with epilepsy, heart
                conditions, or high blood pressure. Consult a doctor if you have
                concerns.
              </p>
            </details>

            <details>
              <summary>How often should I practice?</summary>
              <p>
                Daily practice is recommended, preferably in the morning on an
                empty stomach. One session takes about 15-20 minutes.
              </p>
            </details>

            <details>
              <summary>When will I see results?</summary>
              <p>
                Many people notice improved well-being after their first
                session. For lasting results, consistent practice over several
                weeks is recommended.
              </p>
            </details>

            <details>
              <summary>Can I practice before sleep?</summary>
              <p>
                The technique can be stimulating, so morning or afternoon
                practice is preferred. If practicing in the evening, do it at
                least 2 hours before bed.
              </p>
            </details>

            <details>
              <summary>What is the "breath hold"?</summary>
              <p>
                After the rapid breathing cycles, you exhale and hold your
                breath as long as comfortable. This is not a competition —
                listen to your body and breathe when you feel the need.
              </p>
            </details>
          </section>

          <footer className="abt-ftr">
            <p>
              This app is a non-commercial project for group breathing sessions.
              Audio instructions belong to their respective authors.
            </p>
          </footer>
        </article>
      </main>
    </div>
  );
}
