import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { formatError } from "../lib/errors";
import { addPosSale, deletePosSale, importPosSales, listPosSales, type PosSale } from "../lib/pos";
import { parsePosCsv, validCsvRows, type CsvPreviewRow } from "../lib/posCsv";
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
  const [csvRows, setCsvRows] = useState<CsvPreviewRow[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvSource, setCsvSource] = useState("csv");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const labels = language === "fi" ? {
    title: "POS / Myynti", desc: "Päivittäisen myynnin tuonti ja tarkistus ravintoloittain.", from: "Alkaen", to: "Päättyen", date: "Päivä", receipt: "Kuitti", gross: "Brutto €", net: "Netto €", source: "Lähde", add: "Lisää myynti", empty: "Ei myyntitietoja valitulla jaksolla.", saved: "Myynti tallennettu.", total: "Yhteensä", delete: "Poista",
    csv: "CSV-tuonti", choose: "Valitse CSV", import: "Tuo kelvolliset rivit", clear: "Tyhjennä", preview: "Esikatselu", line: "Rivi", status: "Tila", ready: "Valmis", invalid: "Virhe", validRows: "kelvollista", invalidRows: "virheellistä", csvHelp: "Sarakkeet: Date/Business Date, Receipt, Gross, Net, Source. Tukee pilkkua tai puolipistettä ja päivämääriä YYYY-MM-DD tai DD.MM.YYYY.", imported: "Tuonti valmis", duplicate: "ohitettu / kaksoiskappale", failed: "epäonnistui"
  } : language === "es" ? {
    title: "POS / Ventas", desc: "Importación y revisión de ventas diarias por restaurante.", from: "Desde", to: "Hasta", date: "Fecha", receipt: "Recibo", gross: "Bruto €", net: "Neto €", source: "Fuente", add: "Agregar venta", empty: "No hay ventas en el periodo seleccionado.", saved: "Venta guardada.", total: "Total", delete: "Eliminar",
    csv: "Importar CSV", choose: "Seleccionar CSV", import: "Importar filas válidas", clear: "Limpiar", preview: "Vista previa", line: "Línea", status: "Estado", ready: "Lista", invalid: "Error", validRows: "válidas", invalidRows: "con error", csvHelp: "Columnas: Date/Business Date, Receipt, Gross, Net, Source. Admite coma o punto y coma y fechas YYYY-MM-DD o DD.MM.YYYY.", imported: "Importación terminada", duplicate: "omitidas / duplicadas", failed: "fallidas"
  } : {
    title: "POS / Sales", desc: "Daily sales import and review by restaurant.", from: "From", to: "To", date: "Date", receipt: "Receipt", gross: "Gross €", net: "Net €", source: "Source", add: "Add sale", empty: "No sales for the selected period.", saved: "Sale saved.", total: "Total", delete: "Delete",
    csv: "CSV import", choose: "Choose CSV", import: "Import valid rows", clear: "Clear", preview: "Preview", line: "Line", status: "Status", ready: "Ready", invalid: "Error", validRows: "valid", invalidRows: "invalid", csvHelp: "Columns: Date/Business Date, Receipt, Gross, Net, Source. Supports comma or semicolon CSV and YYYY-MM-DD or DD.MM.YYYY dates.", imported: "Import completed", duplicate: "skipped / duplicate", failed: "failed"
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
  const validCount = csvRows.filter(r => r.valid).length;
  const invalidCount = csvRows.length - validCount;

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

  async function chooseCsv(file?: File) {
    if (!file) return;
    setError(""); setMessage("");
    try {
      const text = await file.text();
      setCsvRows(parsePosCsv(text, csvSource));
      setCsvFileName(file.name);
    } catch (e) {
      setCsvRows([]); setCsvFileName(""); setError(formatError(e));
    }
  }

  async function runImport() {
    if (!canEdit || !restaurantId || !validCount) return;
    try {
      setImporting(true); setError(""); setMessage("");
      const rows = validCsvRows(csvRows, restaurantId).map(r => ({ ...r, source: r.source || csvSource }));
      const result = await importPosSales(restaurantId, rows, csvSource, csvFileName || "import.csv");
      setMessage(`${labels.imported}: ${result.imported} ${labels.validRows}, ${result.skipped} ${labels.duplicate}, ${result.failed} ${labels.failed}.`);
      setCsvRows([]); setCsvFileName(""); if (fileRef.current) fileRef.current.value = "";
      await loadSales();
    } catch (e) { setError(formatError(e)); }
    finally { setImporting(false); }
  }

  function clearCsv() {
    setCsvRows([]); setCsvFileName(""); if (fileRef.current) fileRef.current.value = "";
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

    {canEdit && <section className="panel pos-csv no-print">
      <div className="pos-csv-head">
        <div><h3>{labels.csv}</h3><p className="muted">{labels.csvHelp}</p></div>
        <div className="pos-csv-actions">
          <label className="pos-source"><span>{labels.source}</span><input value={csvSource} onChange={e=>setCsvSource(e.target.value)} /></label>
          <input ref={fileRef} className="pos-file-input" id="pos-csv-file" type="file" accept=".csv,text/csv" onChange={e=>void chooseCsv(e.target.files?.[0])} />
          <label className="button secondary" htmlFor="pos-csv-file">{labels.choose}</label>
          {csvRows.length > 0 && <button className="secondary" type="button" onClick={clearCsv}>{labels.clear}</button>}
          <button type="button" disabled={!validCount || importing || !restaurantId} onClick={()=>void runImport()}>{importing ? (t.saving || "Saving…") : labels.import}</button>
        </div>
      </div>
      {csvRows.length > 0 && <>
        <div className="pos-csv-summary"><strong>{csvFileName}</strong><span>{validCount} {labels.validRows}</span><span>{invalidCount} {labels.invalidRows}</span></div>
        <div className="pos-csv-preview">
          <table className="pos-table"><thead><tr><th>{labels.line}</th><th>{labels.date}</th><th>{labels.receipt}</th><th>{labels.source}</th><th>{labels.gross}</th><th>{labels.net}</th><th>{labels.status}</th></tr></thead>
          <tbody>{csvRows.slice(0,100).map(r=><tr key={r.line} className={r.valid ? "" : "pos-invalid-row"}><td>{r.line}</td><td>{r.business_date || "—"}</td><td>{r.receipt_no || "—"}</td><td>{r.source}</td><td>{r.gross_amount.toFixed(2)}</td><td>{r.net_amount.toFixed(2)}</td><td>{r.valid ? `✓ ${labels.ready}` : `⚠ ${r.error || labels.invalid}`}</td></tr>)}</tbody></table>
          {csvRows.length > 100 && <p className="muted pos-empty">{labels.preview}: 100 / {csvRows.length}</p>}
        </div>
      </>}
    </section>}

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
