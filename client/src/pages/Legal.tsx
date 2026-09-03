import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grain flex min-h-screen flex-col bg-cream">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20 pt-28">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          {title}
        </h1>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-soft">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

export function Terms() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        Welcome to Chessify. By creating an account or playing on this site you
        agree to these terms. This is a placeholder document — replace it with
        your real terms before launching publicly.
      </p>
      <section>
        <h2 className="mb-2 font-display text-xl font-semibold text-ink">Use of the service</h2>
        <p>
          Chessify is provided as-is for learning and playing chess. Don't abuse
          the service, attempt to disrupt games, or use automated tools to gain
          an unfair advantage against other players.
        </p>
      </section>
      <section>
        <h2 className="mb-2 font-display text-xl font-semibold text-ink">Accounts</h2>
        <p>
          You're responsible for keeping your credentials safe. We may remove
          accounts that violate these terms.
        </p>
      </section>
      <section>
        <h2 className="mb-2 font-display text-xl font-semibold text-ink">Liability</h2>
        <p>
          The service is provided without warranties of any kind, to the extent
          permitted by law.
        </p>
      </section>
    </LegalShell>
  );
}

export function Privacy() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This is a placeholder policy — replace it with your real policy before
        launching publicly.
      </p>
      <section>
        <h2 className="mb-2 font-display text-xl font-semibold text-ink">What we store</h2>
        <p>
          Account data (username, email, a hashed password) and the games you
          play. Sessions use an httpOnly cookie; guests get a random per-browser
          id stored locally so invite links work without an account.
        </p>
      </section>
      <section>
        <h2 className="mb-2 font-display text-xl font-semibold text-ink">What we don't do</h2>
        <p>
          We don't sell your data, run third-party ad trackers, or share your
          email with anyone.
        </p>
      </section>
      <section>
        <h2 className="mb-2 font-display text-xl font-semibold text-ink">Contact</h2>
        <p>Questions? Reach out to the site operator.</p>
      </section>
    </LegalShell>
  );
}
