import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="empty-page section-pad">
      <span className="eyebrow">A LITTLE OFF THE PATH / 404</span>
      <h1>
        This way
        <br />
        <em>back to the coast.</em>
      </h1>
      <p>That page isn’t here. Your next quiet moment still could be.</p>
      <Link className="button dark" href="/">
        Back to TIDEHOUSE →
      </Link>
    </main>
  );
}
