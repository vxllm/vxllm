import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { Comparison } from "@/components/comparison";
import { Download } from "@/components/download";
import { DockerSection } from "@/components/docker-section";
import { Footer } from "@/components/footer";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <Hero />
      <Features />
      <Comparison />
      <DockerSection />
      <Download />
      <Footer />
    </main>
  );
}
