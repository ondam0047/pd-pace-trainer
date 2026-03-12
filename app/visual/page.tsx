import Link from "next/link";
import PacingBar from "../../components/PacingBar";

export default function VisualPage() {
  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "24px 20px 40px",
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <Link href="/" style={{ textDecoration: "none" }}>
          ← 홈으로
        </Link>
      </div>

      <PacingBar />
    </main>
  );
}