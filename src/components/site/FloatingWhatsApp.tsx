import { useEffect, useState } from "react";
import { IconWhatsApp } from "./icons";
import { useSiteInfo, whatsappLink } from "../../lib/site";

/** Floating WhatsApp shortcut — appears once the visitor scrolls past the hero. */
export function FloatingWhatsApp() {
  const { contact_phone_raw } = useSiteInfo();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!contact_phone_raw) return null;

  return (
    <a
      href={whatsappLink(contact_phone_raw, "Hi RedSpark Digital, I'd like some help with…")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      data-where="floating"
      className={`group fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-emerald-500 py-3 pl-3 pr-3 text-white shadow-[0_10px_30px_-8px_rgb(16_185_129/0.6)] transition-all duration-300 hover:bg-emerald-400 sm:pr-4 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <IconWhatsApp className="h-6 w-6" />
      <span className="hidden text-sm font-semibold sm:inline">Chat with us</span>
    </a>
  );
}
