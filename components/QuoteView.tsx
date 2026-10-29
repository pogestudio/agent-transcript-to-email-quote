import { formatDateTime, formatDay, formatQuoteAmount, formatRate } from "../lib/format";
import { discountPct as volumeDiscountPct } from "../lib/pricing";
import type { Quote } from "../lib/types";

export default function QuoteView({ quote }: { quote: Quote | null }) {
  if (!quote || quote.lines.length === 0) {
    return <p className="muted">No priced lines. See the agent&apos;s assessment above for what is missing.</p>;
  }

  const discountLabel = quote.discountPct === volumeDiscountPct(quote.totalKg) ? "Volume discount" : "Manager discount";
  const { fx } = quote;
  const amount = (sek: number) => formatQuoteAmount(sek, fx);

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th className="r">Kg</th>
              <th className="r">{fx?.currency ?? "SEK"}/kg</th>
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
                <td className="r">{amount(line.unitPriceSek)}</td>
                <td className="r">{amount(line.lineSek)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="totals">
        <dt>Subtotal, {quote.totalKg} kg</dt>
        <dd>{amount(quote.subtotalSek)}</dd>
        {quote.discountPct > 0 && (
          <>
            <dt>
              {discountLabel} {quote.discountPct}%
            </dt>
            <dd>{amount(quote.discountSek)} off</dd>
            <dt className="strong">Goods after discount</dt>
            <dd className="strong">{amount(quote.goodsAfterDiscountSek)}</dd>
          </>
        )}
        <dt>Delivery</dt>
        <dd>{quote.deliverySek ? amount(quote.deliverySek) : "Free"}</dd>
        <dt className="strong">Total excl. VAT</dt>
        <dd className="strong">{amount(quote.totalExclVatSek)}</dd>
        <dt>VAT 25%</dt>
        <dd>{amount(quote.vatSek)}</dd>
        <dt className="grand">Total incl. VAT</dt>
        <dd className="grand">{amount(quote.totalInclVatSek)}</dd>
      </dl>

      {fx && (
        <div className="notice notice-fx">
          <strong>Quoted in {fx.currency}. Each amount is converted on its own and rounded to the cent.</strong>
          <span className="small">
            1 SEK = {formatRate(fx.rate)} {fx.currency} · ECB rate of {formatDay(fx.rateDate)} ·
            fetched {formatDateTime(fx.fetchedAt)} · {fx.source}
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
