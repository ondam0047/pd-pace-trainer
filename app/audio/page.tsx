import Link from "next/link";
import MetronomeTrainer from "../../components/MetronomeTrainer";

export default function AudioPage() {
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

      <MetronomeTrainer />
    </main>
  );
}