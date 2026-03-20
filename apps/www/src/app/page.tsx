import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { Comparison } from "@/components/comparison";
import { InstallSection } from "@/components/install-section";
import { Footer } from "@/components/footer";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Hero />
      <Features />
      <Comparison />
      <InstallSection />
      <Footer />
    </main>
  );
}
