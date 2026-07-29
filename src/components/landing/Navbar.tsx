import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/blavia-logo.png";

const BRAND = "#0d1f2d";
const GOLD = "#E7B008";

const WHATSAPP_URL =
  "https://wa.me/254791708828?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20Blavia";

const links = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  { label: "About", href: "#about" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

export const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 transition-shadow"
      style={{
        background: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(8px)",
        boxShadow: scrolled ? "0 1px 0 0 rgba(13,31,45,0.08)" : "none",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10">
        <a href="#home" className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg p-1.5"
            style={{ background: BRAND }}
          >
            <img src={logo} alt="BLAVIA" className="h-full w-full object-contain" />
          </div>
          <span className="text-base font-bold tracking-tight" style={{ color: BRAND }}>
            BLAVIA
          </span>
        </a>

        {/* Desktop links */}
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: BRAND }}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5"
              style={{ color: BRAND }}
            >
              <MessageCircle className="h-4 w-4" style={{ color: "#25D366" }} />
              WhatsApp
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/login" style={{ color: BRAND }}>Sign in</Link>
          </Button>
          <Button
            asChild
            size="sm"
            style={{ background: GOLD, color: BRAND, border: "none" }}
            className="hover:opacity-90"
          >
            <Link to="/signup">Get started</Link>
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg md:hidden"
          style={{ color: BRAND }}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="border-t px-6 py-4 md:hidden"
          style={{ borderColor: `${BRAND}15`, background: "white" }}
        >
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-black/5"
                style={{ color: BRAND }}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t pt-3" style={{ borderColor: `${BRAND}15` }}>
            <Button asChild variant="outline" style={{ borderColor: BRAND, color: BRAND }}>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5">
                <MessageCircle className="h-4 w-4" style={{ color: "#25D366" }} />
                Chat on WhatsApp
              </a>
            </Button>
            <Button asChild variant="ghost" style={{ color: BRAND }}>
              <Link to="/login" onClick={() => setOpen(false)}>Sign in</Link>
            </Button>
            <Button
              asChild
              style={{ background: GOLD, color: BRAND, border: "none" }}
              className="hover:opacity-90"
            >
              <Link to="/signup" onClick={() => setOpen(false)}>Get started</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};
