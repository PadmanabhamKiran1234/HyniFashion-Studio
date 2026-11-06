import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingBag, ArrowUpRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';

export const money = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

const stockMessage = (stock) => {
  const value = Number(stock) || 0;
  if (value <= 0) return { text: 'Out of stock', className: 'out-of-stock' };
  if (value <= 5) return { text: `Only ${value} ${value === 1 ? 'piece' : 'pieces'} left!`, className: 'low-stock' };
  return { text: 'Ready to make it yours', className: '' };
};

export default function ProductCard({ product: p }) {
  const { addToCart, toggleWishlist, wishlist } = useStore();
  const toast = useToast();
  const navigate = useNavigate();

  const handleAuthError = (e) => {
    toast.error(e.message);
    if (!localStorage.getItem('hyni_token')) navigate('/login');
  };

  const handleCart = async () => {
    try {
      await addToCart(p);
      toast.success(`${p.name} added to your bag.`);
    } catch (e) {
      handleAuthError(e);
    }
  };

  const handleWish = async () => {
    try {
      await toggleWishlist(p);
    } catch (e) {
      handleAuthError(e);
    }
  };

  const saved = wishlist.some((x) => x.id === p.id);
  const price = Number(p.customerPrice ?? ((p.sellingPrice || p.price) * (1 - p.discount / 100)));
  const stock = stockMessage(p.stock);

  return (
    <article className="product-card">
      <div className="product-image">
        <Link to={`/product/${p.id}`}>
          <img src={p.image} alt={p.name} loading="lazy" />
        </Link>
        {p.discount > 0 && <span className="sale-badge">{p.discount}% OFF</span>}
        {p.isNew && <span className="new-badge">NEW</span>}
        <button className={`wish-button ${saved ? 'saved' : ''}`} aria-label="Toggle wishlist" onClick={handleWish}>
          <Heart size={17} fill={saved ? 'currentColor' : 'none'} />
        </button>
        <button className="quick-add" onClick={handleCart} disabled={!p.stock}>
          <ShoppingBag size={15} /> Quick add
        </button>
      </div>
      <div className="product-info">
        <div className="product-category">{p.category} · {p.code}</div>
        <Link to={`/product/${p.id}`} className="product-name">{p.name}<ArrowUpRight size={14} /></Link>
        <div className="price-row"><b>{money(price)}</b>{p.discount > 0 && <del>{money(p.price)}</del>}</div>
        <div className={`stock-note ${stock.className}`}>{stock.text}</div>
      </div>
    </article>
  );
}
