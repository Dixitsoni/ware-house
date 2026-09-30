// In-browser stand-in for the Express/MongoDB API. Data lives in localStorage, so the demo needs no backend.
const KEY = 'wms_db', iso = n => new Date(Date.now() + n * 864e5).toISOString();
const USERS = [{ name: 'Dixit (Admin)', email: 'admin@demo.com', password: 'admin123', role: 'Admin' }, { name: 'Ravi (Storekeeper)', email: 'store@demo.com', password: 'store123', role: 'Storekeeper' }, { name: 'Meera (Viewer)', email: 'view@demo.com', password: 'view123', role: 'Viewer' }];
const seed = () => {
  const products = [['HW-001', 'Steel bolt M8', 'Hardware', 'pcs', 200, 4], ['HW-002', 'Hex nut M8', 'Hardware', 'pcs', 100, 2], ['CH-010', 'Industrial adhesive 1L', 'Chemicals', 'can', 40, 350], ['PK-020', 'Corrugated box 12x12', 'Packaging', 'pcs', 50, 25], ['EL-030', 'LED panel 18W', 'Electrical', 'pcs', 30, 420], ['PK-021', 'Stretch wrap roll', 'Packaging', 'roll', 40, 180]]
    .map(([sku, name, category, uom, reorderLevel, price], i) => ({ _id: 'p' + i, sku, name, category, uom, reorderLevel, price }));
  const locations = ['A-01-01', 'A-01-02', 'A-02-01', 'B-01-01', 'B-02-01', 'R-01-01'].map((code, i) => ({ _id: 'l' + i, code, zone: code[0] }));
  const stock = [[0, 0, 'B100', null, 500], [1, 1, 'B101', null, 80], [2, 2, 'B102', iso(20), 60], [2, 3, 'B103', iso(200), 120], [3, 4, 'B104', null, 40], [4, 0, 'B105', null, 65], [5, 1, 'B106', null, 300]]
    .map(([p, l, batch, expiry, qty], i) => ({ _id: 's' + i, product: 'p' + p, location: 'l' + l, batch, expiry, qty }));
  const ledger = stock.map((s, i) => ({ _id: 'g' + i, product: s.product, location: s.location, type: 'IN', qty: s.qty, refNo: 'OPENING', user: 'seed', at: iso(-7) }));
  const orders = [{ _id: 'o1', type: 'PO', number: 'PO-1001', party: 'Bharat Supplies', status: 'Open', lines: [{ product: 'p1', qty: 150 }] }, { _id: 'o2', type: 'SO', number: 'SO-1001', party: 'Shree Traders', status: 'Open', lines: [{ product: 'p2', qty: 70 }] }];
  return { products, locations, stock, ledger, orders, returns: [], n: 100 };
};
let db = JSON.parse(localStorage[KEY] || 'null') || seed();
const save = () => localStorage[KEY] = JSON.stringify(db), id = () => 'x' + db.n++;
const P = i => db.products.find(x => x._id === i), L = i => db.locations.find(x => x._id === i), fail = m => { throw new Error(m); };
const exp = s => s.expiry ? +new Date(s.expiry) : 8.64e15;

function move(product, location, qty, type, refNo, user, batch = '', expiry = null) {
  let s = db.stock.find(x => x.product === product && x.location === location && x.batch === batch);
  if (!s) { if (qty < 0) fail('Insufficient stock'); s = { _id: id(), product, location, batch, expiry, qty: 0 }; db.stock.push(s); }
  if (s.qty + qty < 0) fail('Insufficient stock');
  s.qty += qty; db.ledger.push({ _id: id(), product, location, type, qty, refNo, user, at: new Date().toISOString() });
}
function pick(product, qty, refNo, user) { // FEFO: earliest expiry first
  for (const s of db.stock.filter(s => s.product === product && s.qty > 0).sort((a, b) => exp(a) - exp(b))) { if (qty <= 0) break; const t = Math.min(s.qty, qty); move(product, s.location, -t, 'OUT', refNo, user, s.batch); qty -= t; }
}
const popLines = o => ({ ...o, lines: o.lines.map(l => ({ ...l, product: P(l.product) })) });

function route(path, m, b, q, by) {
  if (path === '/auth/login') { const u = USERS.find(x => x.email === b.email && x.password === b.password); if (!u) fail('Wrong email or password'); return { token: 'demo', user: { name: u.name, role: u.role } }; }
  if (path === '/products') {
    if (m === 'POST') { if (db.products.some(x => x.sku === b.sku)) fail('SKU already exists'); const p = { ...b, _id: id(), reorderLevel: +b.reorderLevel || 0, price: +b.price || 0 }; db.products.push(p); return p; }
    return [...db.products].sort((a, c) => a.sku.localeCompare(c.sku));
  }
  if (path.startsWith('/products/') && m === 'DELETE') { db.products = db.products.filter(x => x._id !== path.slice(10)); return { ok: 1 }; }
  if (path === '/locations') return db.locations;
  if (path === '/stock') return db.stock.filter(s => s.qty > 0).map(s => ({ ...s, product: P(s.product), location: L(s.location) }));
  if (path === '/ledger') return [...db.ledger].reverse().slice(0, 100).map(g => ({ ...g, product: P(g.product), location: L(g.location) }));
  if (path === '/stock/transfer') {
    const s = db.stock.find(x => x._id === b.stock), n = +b.qty; if (!n || n <= 0) fail('Enter a quantity');
    move(s.product, s.location, -n, 'TRANSFER-OUT', '', by, s.batch); move(s.product, b.to, n, 'TRANSFER-IN', '', by, s.batch, s.expiry); return { ok: 1 };
  }
  if (path === '/stock/adjust') { const s = db.stock.find(x => x._id === b.stock), diff = +b.qty - s.qty; if (diff) move(s.product, s.location, diff, 'ADJUST', 'COUNT', by, s.batch); return { ok: 1 }; }
  if (path === '/orders') {
    if (m === 'POST') { const o = { _id: id(), type: b.type, party: b.party, lines: b.lines, status: 'Open', number: b.type + '-' + (1001 + db.orders.filter(x => x.type === b.type).length) }; db.orders.push(o); return o; }
    return db.orders.filter(o => o.type === q.get('type')).reverse().map(popLines);
  }
  if (path.endsWith('/advance')) {
    const o = db.orders.find(x => x._id === path.split('/')[2]);
    if (o.type === 'PO') {
      if (o.status !== 'Open') fail('Already received'); if (!b.location) fail('Choose a bin to receive into');
      o.lines.forEach(l => move(l.product, b.location, l.qty, 'IN', o.number, by, o.number, b.expiry ? new Date(b.expiry).toISOString() : null)); o.status = 'Received';
    } else {
      const flow = ['Open', 'Picked', 'Packed', 'Dispatched'], i = flow.indexOf(o.status); if (i === 3) fail('Already dispatched');
      if (flow[i + 1] === 'Dispatched') { o.lines.forEach(l => { if (db.stock.filter(s => s.product === l.product).reduce((a, s) => a + s.qty, 0) < l.qty) fail('Not enough stock to dispatch'); }); o.lines.forEach(l => pick(l.product, l.qty, o.number, by)); }
      o.status = flow[i + 1];
    }
    return o;
  }
  if (path === '/returns') {
    if (m === 'POST') { if (b.action === 'Restock') move(b.product, b.location, +b.qty, 'RETURN', 'RMA', by, 'RETURN'); const r = { _id: id(), product: b.product, qty: +b.qty, action: b.action, at: new Date().toISOString() }; db.returns.push(r); return r; }
    return [...db.returns].reverse().map(r => ({ ...r, product: P(r.product) }));
  }
  if (path === '/dashboard') {
    const stock = db.stock.filter(s => s.qty > 0), by2 = {}; stock.forEach(s => by2[s.product] = (by2[s.product] || 0) + s.qty);
    const rows = db.products.map(p => { const qty = by2[p._id] || 0; return { sku: p.sku, name: p.name, qty, reorderLevel: p.reorderLevel, price: p.price, value: qty * p.price, low: qty <= p.reorderLevel }; });
    return { products: db.products.length, units: rows.reduce((a, x) => a + x.qty, 0), value: rows.reduce((a, x) => a + x.value, 0), openPO: db.orders.filter(o => o.type === 'PO' && o.status === 'Open').length,
      openSO: db.orders.filter(o => o.type === 'SO' && o.status !== 'Dispatched').length, expiring: stock.filter(s => s.expiry && +new Date(s.expiry) < Date.now() + 30 * 864e5).length, low: rows.filter(x => x.low), rows };
  }
  fail('Not found');
}
export async function api(p, o = {}) {
  const [path, qs] = p.split('?'), by = JSON.parse(localStorage.user || '{}').name || 'demo';
  const out = route(path, o.method || 'GET', o.body || {}, new URLSearchParams(qs), by); save();
  return JSON.parse(JSON.stringify(out));
}
