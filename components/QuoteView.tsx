import { formatDateTime, formatDay, formatMoney, formatRate, formatSek } from "../lib/format";
import { discountPct as volumeDiscountPct } from "../lib/pricing";
import type { Quote } from "../lib/types";

export default function QuoteView({ quote }: { quote: Quote | null }) {
  if (!quote || quote.lines.length === 0) {
    return <p className="muted">No priced lines. See the agent&apos;s assessment above for what is missing.</p>;
  }

  const discountLabel = quote.discountPct === volumeDiscountPct(quote.totalKg) ? "Volume discount" : "Manager discount";

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th className="r">Kg</th>
              <th className="r">SEK/kg</th>
              <th className="r">Line</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line) => (
              <tr key={line.sku}>
                <td>
                  {line.name}
                  <span className="sku">{line.sku}</span>
                  {line.belowMin && <span className="tag">Below {line.minKg} kg minimum</span>}
                </td>
                <td className="r">{line.kg}</td>
                <td className="r">{formatSek(line.unitPriceSek)}</td>
                <td className="r">{formatSek(line.lineSek)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="totals">
        <dt>Subtotal, {quote.totalKg} kg</dt>
        <dd>{formatSek(quote.subtotalSek)}</dd>
        {quote.discountPct > 0 && (
          <>
            <dt>
              {discountLabel} {quote.discountPct}%
            </dt>
            <dd>{formatSek(quote.discountSek)} off</dd>
            <dt className="strong">Goods after discount</dt>
            <dd className="strong">{formatSek(quote.goodsAfterDiscountSek)}</dd>
          </>
        )}
        <dt>Delivery</dt>
        <dd>{quote.deliverySek ? formatSek(quote.deliverySek) : "Free"}</dd>
        <dt className="strong">Total excl. VAT</dt>
        <dd className="strong">{formatSek(quote.totalExclVatSek)}</dd>
        <dt>VAT 25%</dt>
        <dd>{formatSek(quote.vatSek)}</dd>
        <dt className="grand">Total incl. VAT</dt>
        <dd className="grand">{formatSek(quote.totalInclVatSek)}</dd>
      </dl>

      {quote.fx && (
        <div className="notice notice-fx">
          <strong>
            In {quote.fx.currency}: {formatMoney(quote.fx.totalExclVat, quote.fx.currency)} excl. VAT,{" "}
            {formatMoney(quote.fx.totalInclVat, quote.fx.currency)} incl. VAT
          </strong>
          <span className="small">
            1 SEK = {formatRate(quote.fx.rate)} {quote.fx.currency} · ECB rate of {formatDay(quote.fx.rateDate)} ·
            fetched {formatDateTime(quote.fx.fetchedAt)} · {quote.fx.source}
          </span>
        </div>
      )}

      {quote.fxError && (
        <div className="notice notice-warn">
          <strong>Exchange rate lookup failed. Quote kept in SEK.</strong>
          <span className="small">{quote.fxError}</span>
        </div>
      )}
    </>
  );
}
