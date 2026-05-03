import { Navbar } from "../components/site/Navbar";
import { Hero } from "../components/site/Hero";
import { Services } from "../components/site/Services";
import { Process } from "../components/site/Process";
import { Pricing } from "../components/site/Pricing";
import { Portfolio } from "../components/site/Portfolio";
import { Testimonials } from "../components/site/Testimonials";
import { About } from "../components/site/About";
import { Contact } from "../components/site/Contact";
import { Footer } from "../components/site/Footer";


export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Services />
        <Process />
        <Pricing />
        <Portfolio />
        <Testimonials />
        <About />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
