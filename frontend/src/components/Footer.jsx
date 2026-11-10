import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { BRAND } from "../config/brand";
import { api } from "../config/api";
import { useToast } from "../context/ToastContext";

export default function Footer() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [statusError, setStatusError] = useState(false);

  const subscribe = async (event) => {
    event.preventDefault();
    if (busy) return;
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setStatus("Please enter a valid email address.");
      setStatusError(true);
      toast.error("Please enter a valid email address.");
      return;
    }

    setBusy(true);
    setStatus("");
    setStatusError(false);
    try {
      const result = await api.subscribeNewsletter(value);
      const message = result.message || "Thank you for subscribing!";
      setStatus(message);
      setEmail("");
      if (result.alreadySubscribed) toast.info(message);
      else toast.success(message);
    } catch (error) {
      setStatus(error.message);
      setStatusError(true);
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="footer-letter">
        <div>
          <span className="eyebrow">A LETTER FROM US</span>
          <h2>
            Good things, <em>occasionally.</em>
          </h2>
          <p>New collections, thoughtful notes and first dibs on the good stuff.</p>
        </div>
        <div>
          <form className="newsletter" onSubmit={subscribe} noValidate>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Your email address"
              aria-label="Email address for newsletter"
              required
            />
            <button type="submit" disabled={busy} aria-label="Subscribe to newsletter">
              {busy ? "…" : <ArrowUpRight size={18} />}
            </button>
          </form>
          {status && (
            <p className={`newsletter-status${statusError ? " is-error" : ""}`} role="status">
              {status}
            </p>
          )}
        </div>
      </section>
      <footer className="footer">
        <div className="footer-top">
          <div>
            <Link to="/" className="brand footer-brand">
              <img src="/images/hyni-logo-footer.png" alt="Hyni Fashion Studio" />
            </Link>
            <p>
              Thoughtful styles for every version of you. A boutique wardrobe,
              made to feel personal.
            </p>
            <address className="footer-address">
              Ground Floor, Gupta Villa, 9-29-19/A, Balaji Nagar, Asilmetta,
              Visakhapatnam, Andhra Pradesh 530003
            </address>
          </div>
          <div>
            <h4>EXPLORE</h4>
            <Link to="/shop">Shop all</Link>
            <Link to="/hot-sales">Hot sales</Link>
            <Link to="/new-arrivals">New arrivals</Link>
            <Link to="/about">Our story</Link>
          </div>
          <div>
            <h4>HELP DESK</h4>
            <Link to="/contact">Contact us</Link>
            <Link to="/login">My account</Link>
            <Link to="/cart">Shopping bag</Link>
            <a href={BRAND.instagram} target="_blank" rel="noreferrer">
              Instagram
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Hyni Fashion Studio</span>
          <span>Made for the moments that matter.</span>
        </div>
      </footer>
    </>
  );
}
