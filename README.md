# Warehouse Management System - Frontend Demo

React (Vite) front end only. No server or database needed: demo data is stored in the browser (localStorage), so changes persist on refresh.
Use "Reset demo data" in the sidebar to start again.

## Run it
1. Install Node.js 18+
2. `npm install`
3. `npm run dev` and open http://localhost:5173

To host it for the client (Netlify, Vercel, any static host): `npm run build`, then upload the `dist` folder.

## Demo logins
- admin@demo.com / admin123 (full access)
- store@demo.com / store123 (storekeeper)
- view@demo.com / view123 (view only, no action buttons)

## Suggested walk-through
1. Dashboard: low-stock alerts (bolts, nuts) and the batch expiring in 20 days.
2. Inbound: choose a bin, click "Receive goods" on PO-1001, then check Inventory and Stock ledger.
3. Outbound: move SO-1001 through Pick, Pack, Dispatch. Adhesive comes from the batch that expires first (FEFO).
4. Inventory: transfer stock between bins and run a stock count.
5. Returns: restock a returned item. Reports: export valuation to CSV.
6. Sign in as the viewer to show role-based access.

Demo only: the full build adds the real backend (Node/Express + MongoDB), multi-line orders, barcode scanning, GST invoices, integrations and alerts.
