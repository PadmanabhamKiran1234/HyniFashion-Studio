# Hyni Fashion Studio — Frontend + Backend Connection

The current UI and styles are retained. The frontend now calls the Express API instead of using browser-only demo records for the connected flows.

## 1. Folder arrangement

Keep the two projects side by side:

```text
hyni-fashion-studio/
  frontend/   # this React/Vite project
  backend/    # your supplied Node/Express project
```

You can also keep the frontend folder name as-is; the paths below only require separate terminals.

## 2. Start MongoDB and backend

1. Start MongoDB Community Server (or use your configured MongoDB URI).
2. In `backend/.env`, set at least:

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/hyni_fashion_studio
JWT_SECRET=replace_with_a_random_secret_at_least_32_characters_long
JWT_EXPIRES_IN=1d
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=use_a_unique_password_at_least_12_chars
ADMIN_UPI_ID=your-upi-id@bank
ADMIN_UPI_NAME=Hyni Fashion Studio
```

3. Set the real `ADMIN_UPI_ID` and `ADMIN_UPI_NAME`; checkout cannot generate a payment QR without them. Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` if you plan to upload product images. Do not commit `.env` or share its secrets.
4. In a terminal opened inside `backend`:

```bash
npm install
npm run seed:categories
npm run seed:admin
npm run dev
```

`seed:admin` requires `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env`; the password must be at least 12 characters. Use those credentials to sign in as Admin.

5. Check `http://localhost:5000/api/health`. It should report a healthy API and connected database.

## 3. Start frontend

1. Copy `.env.example` to `.env` in the frontend folder (or create `.env`).
2. Set:

```env
VITE_API_URL=http://localhost:5000/api
```

3. In a second terminal inside the frontend folder:

```bash
npm install
npm run dev
```

4. Open `http://localhost:5173`.

If Vite runs on a different port, update `CLIENT_URL` in the backend `.env` to that exact origin and restart the backend.

## 4. Authentication and usage

- Customer: create an account at `/register`, then sign in with the registered email and password.
- Admin: sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` configured for the backend seeder.
- Employee: sign in with the employee email and password created by the admin. The backend login endpoint expects email, not employee code.
- Wholesale: registration is available in the backend API, but account approval is required before login. The frontend currently does not include a wholesale registration form.
- Products must exist in MongoDB. The frontend does not seed the sample browser-only products into the database.

## 5. Connected flows

- Public product catalogue and product details.
- Customer registration/login and token-based API requests.
- Customer cart and wishlist.
- Customer address creation and checkout order creation.
- UPI QR display and payment screenshot + UTR submission.
- Customer order history.
- Admin dashboard summary, product create/update/deactivate, category list, inventory list and orders list.
- Employee account creation/list/update and offline sale creation (requires the appropriate employee permission in the backend).
- Customer chatbot order options, previous orders and current order lookup.

## 6. Known backend API gaps (not fabricated in the frontend)

The supplied backend does not currently expose all endpoints expected by the existing screens:

1. Employee attendance check-in/check-out and attendance history endpoints are absent. The attendance screens remain present but cannot persist attendance.
2. Employee password reset endpoint is absent; the UI marks this action unavailable.
3. Admin customer-list endpoint is absent; the Customers admin screen reports this limitation.
4. Wholesale addresses are not supported by the address router (it currently authorizes only `customer`), although checkout accepts both `customer` and `wholesale`. Wholesale order creation therefore needs backend address-route support.
5. Employee permissions default to an empty array. Assign `offlineSales.manage` (and any other required permissions) to an employee in the backend before that employee can create offline sales. The frontend does not silently grant elevated permissions.
6. Admin order and inventory pages currently display backend records; dedicated status/tracking and stock-adjustment controls are not implemented in the current UI.

These are backend/API coverage gaps, not frontend connection errors. Add the corresponding backend routes or UI controls before relying on those workflows in production.

## 7. Troubleshooting

- `Failed to fetch`: ensure backend is running on port 5000 and `VITE_API_URL` is correct.
- CORS error: `CLIENT_URL` must exactly match the frontend origin (including port).
- `401 Invalid token`: sign out and sign in again; JWT tokens are stored in `localStorage` under `hyni_token`.
- Empty catalogue: run the category seeder and create products through the Admin product page. The old sample products in `src/data/products.js` are no longer treated as live database records.
- Checkout fails with inventory errors: ensure each product has available inventory units; changing the product stock number alone is not sufficient.
