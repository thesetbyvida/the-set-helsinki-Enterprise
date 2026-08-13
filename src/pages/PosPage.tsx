import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { formatError } from "../lib/errors";
import { addPosSale, deletePosSale, listPosSales, type PosSale } from "../lib/pos";
import { listRestaurants } from "../lib/restaurants";
import type { Restaurant } from "../types/app";

function iso(d: Date) { return d.toISOString().slice(0, 10); }
function firstOfMonth() { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)); }
function today() { return iso(new Date()); }

export function PosPage() {
  const { profile, language, t } = useApp();
  const canEdit = Boolean(profile && ["super_admin", "admin", "manager"].includes(profile.role));
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [sales, setSales] = useState<PosSale[]>([]);
  const [businessDate, setBusinessDate] = useState(today());
  const [receiptNo, setReceiptNo] = useState("");
  const [gross, setGross] = useState("");
  const [net, setNet] = useState("");
  const [source, setSource] = useState("manual");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const labels = language === "fi" ? {
    title: "POS / Myynti", desc: "Päivittäisen myynnin tuonti ja tarkistus ravintoloittain.", from: "Alkaen", to: "Päättyen", date: "Päivä", receipt: "Kuitti", gross: "Brutto €", net: "Netto €", source: "Lähde", add: "Lisää myynti", empty: "Ei myyntitietoja valitulla jaksolla.", saved: "Myynti tallennettu.", total: "Yhteensä", delete: "Poista"
  } : language === "es" ? {
    title: "POS / Ventas", desc: "Importación y revisión de ventas diarias por restaurante.", from: "Desde", to: "Hasta", date: "Fecha", receipt: "Recibo", gross: "Bruto €", net: "Neto €", source: "Fuente", add: "Agregar venta", empty: "No hay ventas en el periodo seleccionado.", saved: "Venta guardada.", total: "Total", delete: "Eliminar"
  } : {
    title: "POS / Sales", desc: "Daily sales import and review by restaurant.", from: "From", to: "To", date: "Date", receipt: "Receipt", gross: "Gross €", net: "Net €", source: "Source", add: "Add sale", empty: "No sales for the selected period.", saved: "Sale saved.", total: "Total", delete: "Delete"
  };

  async function loadSales(targetRestaurantId = restaurantId) {
    if (!targetRestaurantId) return;
    try { setLoading(true); setError(""); setSales(await listPosSales(targetRestaurantId, from, to)); }
    catch (e) { setError(formatError(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { (async () => {
    try {
      const data = (await listRestaurants()).filter(r => r.active);
      setRestaurants(data);
      if (data.length) setRestaurantId(data[0].id);
    } catch (e) { setError(formatError(e)); }
    finally { setLoading(false); }
  })(); }, []);

  useEffect(() => { if (restaurantId) void loadSales(restaurantId); }, [restaurantId, from, to]);

  const totals = useMemo(() => sales.reduce((a, s) => ({ gross: a.gross + Number(s.gross_amount || 0), net: a.net + Number(s.net_amount || 0) }), { gross: 0, net: 0 }), [sales]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !restaurantId || !businessDate) return;
    try {
      setSaving(true); setError(""); setMessage("");
      await addPosSale({ restaurant_id: restaurantId, business_date: businessDate, receipt_no: receiptNo, gross_amount: Number(gross || 0), net_amount: Number(net || 0), source });
      setReceiptNo(""); setGross(""); setNet(""); setMessage(labels.saved); await loadSales();
    } catch (e) { setError(formatError(e)); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!canEdit || !window.confirm(labels.delete + "?")) return;
    try { await deletePosSale(id); await loadSales(); } catch (e) { setError(formatError(e)); }
  }

  return <div className="pos-page">
    <div className="panel pos-toolbar">
      <div><h2>{labels.title}</h2><p className="muted">{labels.desc}</p></div>
      <div className="pos-controls">
        <label><span>{t.restaurant || "Restaurant"}</span><select value={restaurantId} onChange={e=>setRestaurantId(e.target.value)}>{restaurants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label><span>{labels.from}</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label>
        <label><span>{labels.to}</span><input type="date" value={to} onChange={e=>setTo(e.target.value)} /></label>
      </div>
    </div>
    {error && <div className="alert">{error}</div>}{message && <div className="notice">{message}</div>}
    {canEdit && <form className="panel pos-entry" onSubmit={submit}>
      <label><span>{labels.date}</span><input type="date" value={businessDate} onChange={e=>setBusinessDate(e.target.value)} required /></label>
      <label><span>{labels.receipt}</span><input value={receiptNo} onChange={e=>setReceiptNo(e.target.value)} /></label>
      <label><span>{labels.gross}</span><input type="number" step="0.01" value={gross} onChange={e=>setGross(e.target.value)} /></label>
      <label><span>{labels.net}</span><input type="number" step="0.01" value={net} onChange={e=>setNet(e.target.value)} /></label>
      <label><span>{labels.source}</span><input value={source} onChange={e=>setSource(e.target.value)} /></label>
      <button disabled={saving || !restaurantId}>{saving ? (t.saving || "Saving…") : labels.add}</button>
    </form>}
    <div className="panel pos-table-wrap">
      <table className="pos-table"><thead><tr><th>{labels.date}</th><th>{labels.receipt}</th><th>{labels.source}</th><th>{labels.gross}</th><th>{labels.net}</th>{canEdit&&<th className="no-print"></th>}</tr></thead>
      <tbody>{sales.map(s=><tr key={s.id}><td>{s.business_date}</td><td>{s.receipt_no || "—"}</td><td>{s.source || "—"}</td><td>{Number(s.gross_amount).toFixed(2)}</td><td>{Number(s.net_amount).toFixed(2)}</td>{canEdit&&<td className="no-print"><button className="danger" type="button" onClick={()=>void remove(s.id)}>{labels.delete}</button></td>}</tr>)}</tbody>
      <tfoot><tr><td colSpan={3}>{labels.total}</td><td>{totals.gross.toFixed(2)}</td><td>{totals.net.toFixed(2)}</td>{canEdit&&<td className="no-print"></td>}</tr></tfoot></table>
      {!loading && !sales.length && <p className="muted pos-empty">{labels.empty}</p>}
    </div>
  </div>;
}
