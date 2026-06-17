"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CIReviewRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/review");
  }, [router]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--muted)", fontSize: "15px" }}>
      Redirecting to Review Queue...
    </div>
  );
}
