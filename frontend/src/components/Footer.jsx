import React from "react";
import { Link } from "react-router-dom";
import { Instagram, ArrowUpRight } from "lucide-react";
import { BRAND } from "../config/brand";

export default function Footer() {
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
          <div className="newsletter-unavailable">
            <b>Newsletter sign-up is not available yet.</b>
            <p>
              The backend does not expose a subscription endpoint, so no email
              can be stored. Reach the studio through the contact page instead.
            </p>
            <Link className="button outline" to="/contact">
              Contact the studio
            </Link>
          </div>
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
            <a
              className="social-link"
              href={BRAND.instagram}
              target="_blank"
              rel="noreferrer"
            >
              <Instagram size={17} /> Follow our journey <ArrowUpRight size={15} />
            </a>
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
          <span>Live catalogue · Backend checkout</span>
        </div>
      </footer>
    </>
  );
}
