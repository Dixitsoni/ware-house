import { useState, useEffect, useCallback } from 'react';
import { api } from './mockApi.js';

const useLoad = p => { const [d, setD] = useState(null); const load = useCallback(() => api(p).then(setD).catch(e => alert(e.message)), [p]); useEffect(() => { load(); }, [load]); return [d, load]; };
const act = async (fn, reload) => { try { await fn(); reload && reload(); } catch (e) { alert(e.message); } };
const date = d => d ? new Date(d).toLocaleDateString() : '-';
const Tbl = ({ cols, rows }) => <table><thead><tr>{cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>;
const Opts = ({ list, label }) => <>{(list || []).map(x => <option key={x._id} value={x._id}>{label(x)}</option>)}</>;

function Login({ onLogin }) {
  const [f, setF] = useState({ email: 'admin@demo.com', password: 'admin123' }); const [err, setErr] = useState('');
  const go = e => { e.preventDefault(); api('/auth/login', { method: 'POST', body: f }).then(d => { localStorage.token = d.token; localStorage.user = JSON.stringify(d.user); onLogin(d.user); }).catch(e => setErr(e.message)); };
  return <form className="login" onSubmit={go}><h1>Warehouse Management</h1><p>Sign in to the client demo</p>
    <input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="Email" />
    <input type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} placeholder="Password" />
    <button>Sign in</button>{err && <p className="err">{err}</p>}
    <p>Demo logins: admin@demo.com / admin123, store@demo.com / store123 (storekeeper), view@demo.com / view123 (view only)</p></form>;
}

function Dashboard() {
  const [d] = useLoad('/dashboard'); if (!d) return null;
  const cards = [['Products', d.products], ['Units in stock', d.units], ['Stock value', '₹' + d.value.toLocaleString()], ['Open purchase orders', d.openPO], ['Open sales orders', d.openSO], ['Expiring in 30 days', d.expiring]];
  return <><div className="cards">{cards.map(([k, v]) => <div className="card" key={k}><b>{v}</b><span>{k}</span></div>)}</div>
    <h3>Low stock alerts</h3><Tbl cols={['SKU', 'Product', 'On hand', 'Reorder level']} rows={d.low.map(p => [p.sku, p.name, <span className="low">{p.qty}</span>, p.reorderLevel])} /></>;
}

function Products({ can }) {
  const [ps, load] = useLoad('/products'), [f, setF] = useState({}), set = k => e => setF({ ...f, [k]: e.target.value });
  return <>{can && <form className="row" onSubmit={e => { e.preventDefault(); act(async () => { await api('/products', { method: 'POST', body: f }); setF({}); }, load); }}>
    {['sku', 'name', 'category', 'uom'].map(k => <input key={k} placeholder={k === 'uom' ? 'Unit (pcs)' : k[0].toUpperCase() + k.slice(1)} value={f[k] || ''} onChange={set(k)} required />)}
    <input type="number" placeholder="Reorder level" value={f.reorderLevel || ''} onChange={set('reorderLevel')} /><input type="number" placeholder="Price" value={f.price || ''} onChange={set('price')} /><button>Add product</button></form>}
    <Tbl cols={['SKU', 'Name', 'Category', 'Unit', 'Reorder level', 'Price', '']} rows={(ps || []).map(p => [p.sku, p.name, p.category, p.uom, p.reorderLevel, '₹' + p.price,
      can && <button className="ghost" onClick={() => confirm('Delete ' + p.name + '?') && act(() => api('/products/' + p._id, { method: 'DELETE' }), load)}>Delete</button>])} /></>;
}

function Orders({ type, can }) {
  const [os, load] = useLoad('/orders?type=' + type), [ps] = useLoad('/products'), [ls] = useLoad('/locations');
  const [f, setF] = useState({ qty: 1 }), [bin, setBin] = useState(''), [exp, setExp] = useState(''); const next = { Open: 'Pick', Picked: 'Pack', Packed: 'Dispatch' };
  const isPO = type === 'PO';
  return <>{can && <form className="row" onSubmit={e => { e.preventDefault(); act(async () => { await api('/orders', { method: 'POST', body: { type, party: f.party, lines: [{ product: f.product, qty: +f.qty }] } }); setF({ qty: 1 }); }, load); }}>
    <input placeholder={isPO ? 'Supplier' : 'Customer'} value={f.party || ''} onChange={e => setF({ ...f, party: e.target.value })} required />
    <select value={f.product || ''} onChange={e => setF({ ...f, product: e.target.value })} required><option value="">Product</option><Opts list={ps} label={p => p.sku + ' - ' + p.name} /></select>
    <input type="number" min="1" style={{ width: 90 }} value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} /><button>{isPO ? 'Create purchase order' : 'Create sales order'}</button></form>}
    {isPO && can && <div className="row"><span>Receive into bin:</span><select value={bin} onChange={e => setBin(e.target.value)}><option value="">Choose bin</option><Opts list={ls} label={l => l.code} /></select>
      <span>Expiry (optional):</span><input type="date" value={exp} onChange={e => setExp(e.target.value)} /></div>}
    <Tbl cols={['Number', isPO ? 'Supplier' : 'Customer', 'Items', 'Status', '']} rows={(os || []).map(o => [o.number, o.party, o.lines.map(l => (l.product?.name || '?') + ' x ' + l.qty).join(', '), <span className={'tag ' + o.status}>{o.status}</span>,
      can && (isPO ? o.status === 'Open' : o.status !== 'Dispatched') && <button onClick={() => act(() => api(`/orders/${o._id}/advance`, { method: 'POST', body: { location: bin, expiry: exp } }), load)}>{isPO ? 'Receive goods' : next[o.status]}</button>])} /></>;
}

function Inventory({ can }) {
  const [s, load] = useLoad('/stock'), [ls] = useLoad('/locations');
  const transfer = x => {
    const qty = prompt(`Quantity to move (max ${x.qty})`); if (!qty) return;
    const to = (ls || []).find(l => l.code === (prompt('Move to bin (e.g. ' + ls[0].code + ')') || '').trim().toUpperCase()); if (!to) return alert('Bin not found');
    act(() => api('/stock/transfer', { method: 'POST', body: { stock: x._id, to: to._id, qty } }), load);
  };
  const adjust = x => { const qty = prompt('Counted quantity', x.qty); if (qty !== null && qty !== '') act(() => api('/stock/adjust', { method: 'POST', body: { stock: x._id, qty } }), load); };
  return <Tbl cols={['SKU', 'Product', 'Bin', 'Batch', 'Expiry', 'Qty', '']} rows={(s || []).map(x => [x.product?.sku, x.product?.name, x.location?.code, x.batch || '-', date(x.expiry), x.qty,
    can && <><button onClick={() => transfer(x)}>Transfer</button> <button onClick={() => adjust(x)}>Count</button></>])} />;
}

function Returns({ can }) {
  const [rs, load] = useLoad('/returns'), [ps] = useLoad('/products'), [ls] = useLoad('/locations'), [f, setF] = useState({ qty: 1, action: 'Restock' });
  return <>{can && <form className="row" onSubmit={e => { e.preventDefault(); act(() => api('/returns', { method: 'POST', body: f }), load); }}>
    <select required value={f.product || ''} onChange={e => setF({ ...f, product: e.target.value })}><option value="">Product</option><Opts list={ps} label={p => p.name} /></select>
    <input type="number" min="1" style={{ width: 90 }} value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} />
    <select value={f.action} onChange={e => setF({ ...f, action: e.target.value })}><option>Restock</option><option>Scrap</option><option>Repair</option></select>
    {f.action === 'Restock' && <select required value={f.location || ''} onChange={e => setF({ ...f, location: e.target.value })}><option value="">Restock into bin</option><Opts list={ls} label={l => l.code} /></select>}
    <button>Record return</button></form>}
    <Tbl cols={['Date', 'Product', 'Qty', 'Decision']} rows={(rs || []).map(r => [date(r.at), r.product?.name, r.qty, r.action])} /></>;
}

function Reports() {
  const [d] = useLoad('/dashboard'); if (!d) return null;
  const csv = () => { const t = 'SKU,Product,On hand,Price,Value\n' + d.rows.map(r => [r.sku, r.name, r.qty, r.price, r.value].join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv' })); a.download = 'stock-valuation.csv'; a.click(); };
  return <><div className="row"><button onClick={csv}>Export to CSV</button></div>
    <Tbl cols={['SKU', 'Product', 'On hand', 'Price', 'Value']} rows={[...d.rows.map(r => [r.sku, r.name, r.qty, '₹' + r.price, '₹' + r.value.toLocaleString()]), [<b>Total</b>, '', <b>{d.units}</b>, '', <b>₹{d.value.toLocaleString()}</b>]]} /></>;
}

function Ledger() {
  const [l] = useLoad('/ledger');
  return <Tbl cols={['Time', 'Type', 'Product', 'Bin', 'Qty', 'Reference', 'By']} rows={(l || []).map(x => [new Date(x.at).toLocaleString(), x.type, x.product?.name, x.location?.code, x.qty > 0 ? '+' + x.qty : x.qty, x.refNo || '-', x.user])} />;
}

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.user || 'null')), [tab, setTab] = useState('Dashboard');
  if (!user) return <Login onLogin={setUser} />;
  const can = user.role !== 'Viewer';
  const pages = { Dashboard: <Dashboard />, Products: <Products can={can} />, Inbound: <Orders key="PO" type="PO" can={can} />, Inventory: <Inventory can={can} />, Outbound: <Orders key="SO" type="SO" can={can} />, Returns: <Returns can={can} />, Reports: <Reports />, 'Stock ledger': <Ledger /> };
  return <div className="shell"><nav><h2>WMS Demo</h2>{Object.keys(pages).map(t => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
    <div className="me">{user.name}<br />{user.role}<br /><button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); }}>Sign out</button><br /><button onClick={() => { localStorage.clear(); location.reload(); }}>Reset demo data</button></div></nav>
    <main><h1>{tab}</h1>{pages[tab]}</main></div>;
}
