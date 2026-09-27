import { Suspense } from "react";
import { Stay } from "@/components/Stay";
export const metadata = { title: "Find your stay" };
export default function Page() {
  return (
    <Suspense
      fallback={
        <main id="main" className="empty-page section-pad">
          <h1>Finding your quiet…</h1>
        </main>
      }
    >
      <Stay />
    </Suspense>
  );
}
